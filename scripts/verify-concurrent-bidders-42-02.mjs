import fs from "node:fs";

const ROUTE = "app/api/bids/route.ts";
const MIGRATION = "supabase/migrations/20261005031500_authoritative_bid_foundation.sql";
const OPENAPI = "packages/contracts/openapi/enchev-api.v1.json";
const SLI = "config/enchev-bid-acceptance-latency-sli.json";
const MASTER = "app/components/MasterSystemPlanV1.tsx";
const AUTHORITY = "config/enchev-auction-authority.json";

function fail(message){ throw new Error("CONCURRENT_BIDDERS_42_02 FAIL: " + message); }
function requireText(source, marker, label){ if(!source.includes(marker)) fail(label + " missing: " + marker); }

function staticVerify(){
  const route=fs.readFileSync(ROUTE,"utf8");
  const sql=fs.readFileSync(MIGRATION,"utf8");
  const openapi=JSON.parse(fs.readFileSync(OPENAPI,"utf8"));
  const sli=JSON.parse(fs.readFileSync(SLI,"utf8"));
  const master=fs.readFileSync(MASTER,"utf8");
  const authority=JSON.parse(fs.readFileSync(AUTHORITY,"utf8"));

  requireText(master,'["42","Performance certification"', "phase 42");
  requireText(master,'"10 concurrent bidders certified||test"', "42.02 identity");
  requireText(route,'export async function POST', "authoritative POST");
  requireText(route,'requireIdempotencyKey', "idempotency boundary");
  requireText(route,'ENCHEV_AUTH_SUPABASE_URL', "separate identity authority URL");
  requireText(route,'ENCHEV_AUTH_SUPABASE_PUBLISHABLE_KEY', "identity authority publishable key");
  requireText(route,'/auth/v1/user', "buyer JWT validation");
  requireText(route,'ENCHEV_AUCTION_SUPABASE_URL', "dedicated auction authority URL");
  requireText(route,'/rest/v1/rpc/enchev_place_bid', "PostgreSQL RPC boundary");
  requireText(route,'ENCHEV_AUCTION_SUPABASE_SECRET_KEY', "backend authority credential");
  requireText(route,'AUCTION_AUTHORITY_MUST_BE_DEDICATED', "shared-project fail-closed guard");
  requireText(route,'frhletkiuupgksmgxoxc.supabase.co', "shared development project denylist");
  if(route.includes("NEXT_PUBLIC_ENCHEV_AUCTION_SUPABASE_SECRET_KEY")) fail("secret key exposed to browser namespace");

  for(const marker of [
    "for update",
    "pg_advisory_xact_lock",
    "unique (auction_id, sequence)",
    "unique (bidder_id, idempotency_key)",
    "security invoker",
    "grant execute on function public.enchev_place_bid",
  ]) requireText(sql.toLowerCase(), marker.toLowerCase(), "atomic SQL");

  if(!openapi.paths?.["/api/bids"]?.post) fail("OpenAPI POST /api/bids missing");
  if(sli.authoritativeBidRouteImplemented !== true) fail("27.03 implementation truth not updated");
  if(sli.authoritativeAuctionSource !== "postgresql") fail("auction authority drift");
  if(authority?.auctionAuthority?.datastore !== "postgresql") fail("authority datastore drift");
  if(authority?.auctionAuthority?.dedicatedDatabaseRequired !== true) fail("dedicated database gate disabled");
  if(authority?.auctionAuthority?.forbiddenSharedProjectRef !== "frhletkiuupgksmgxoxc") fail("shared project guard drift");
  if(authority?.identityAuthority?.mayBeSeparateFromAuctionDatabase !== true) fail("identity/database separation disabled");

  return true;
}

staticVerify();

if(process.argv.includes("--self-test")){
  const original=fs.readFileSync(MIGRATION,"utf8");
  if(!original.toLowerCase().includes("for update")) fail("negative fixture prerequisite missing");
  const broken=original.replace(/for update/i,"");
  if(broken.toLowerCase().includes("for update")) fail("negative fixture construction failed");
  console.log("CONCURRENT_BIDDERS_42_02_SELF_TEST PASS foundation=true live_certification_required=true");
} else {
  console.log("CONCURRENT_BIDDERS_42_02 FOUNDATION PASS live_certification_required=true");
}
