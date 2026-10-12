#!/usr/bin/env node
/**
 * ETAP 1 static safety gate only. This does not prove a live Supabase pilot.
 * Runtime 2-bidder acceptance is explicitly mandatory in the runbook.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=(name)=>readFileSync(resolve(root,name),"utf8");
const gateway=read("app/lib/etap1-server.ts");
const api=read("app/api/etap1/[action]/route.ts");
const sql=read("supabase/migrations/20261010131500_enchev_etap1_live_pilot.sql");
const client=read("app/live-auctions/etap-1/page.tsx");
const css=read("app/live-auctions/etap-1/etap1.css");
const krumSql=read("supabase/migrations/20261012160000_enchev_etap1_krum_preview_bidder.sql");
const admissionSql=read("supabase/migrations/20261012170000_enchev_etap1_session_admission.sql");

const gates=[
  ["dedicated DB and explicit activation", gateway.includes('ENCHEV_ETAP1_ENABLED !== "true"')&&gateway.includes("SHARED_SOULFLAME_PROJECT")],
  ["no client access to service key", !client.includes("SERVICE_ROLE_KEY") && !css.includes("SERVICE_ROLE_KEY")],
  ["server-only secret gateway",gateway.includes('import "server-only"') && gateway.includes("ENCHEV_ETAP1_SERVICE_ROLE_KEY")],
  ["separate participant codes",gateway.includes("new Set(Object.values(codes)).size !== ETAP1_ROLES.length")],
  ["signed HTTP-only session",gateway.includes("timingSafeEqual") && gateway.includes("httpOnly: true") && gateway.includes('sameSite: "strict"')],
  ["same-origin enforced on writes",api.includes("sameOriginPost(request)")],
  ["admin-only operator action rejected",api.includes('role !== "admin"')],
  ["bidder-only bid endpoint",api.includes('role !== "mitko" && role !== "borko"')],
  ["atomic lock ordering",sql.includes("where name='stage-one' for update") && sql.includes("for update;")],
  ["unique idempotency and server sequence",sql.includes("unique (auction_id, actor, request_nonce)")&&sql.includes("unique (auction_id, sequence)")],
  ["immutable bid ledger",sql.includes("create table if not exists public.enchev_etap1_bids")&&!/delete\s+from\s+public\.enchev_etap1_bids/i.test(sql)],
  ["no client-controlled amount",!api.includes("p_amount") && sql.includes("v_auction.current_amount+v_auction.increment")],
  ["server deadline is authoritative",sql.includes("v_now>=v_auction.ends_at")],
  ["database deterministic close",sql.includes("set status='closed'") && sql.includes("v_auction.leading_role")],
  ["database RLS on all three tables",["auctions","rooms","bids"].every(x=>sql.includes("alter table public.enchev_etap1_"+x+" enable row level security"))],
  ["explicit service_role-only RPC",sql.includes("grant execute on function public.etap1_bid(text,uuid) to service_role")],
  ["three live bidders with independent admin",client.includes('role==="mitko"||role==="borko"||role==="enchev"') && client.includes('Enchev — bidder')],
  ["exact three current invited bidders and independent admin",
    !gateway.includes('ENCHEV_ETAP1_KRUM_CODE') &&
    !client.includes('<option value="krum">') &&
    client.includes('<option value="enchev">Enchev — bidder</option>') &&
    api.includes('role !== "borko" && role !== "enchev"') &&
    api.includes('"etap1_join_lobby_automatic"') &&
    krumSql.includes("check (actor in ('mitko','borko','krum'))")],
  ["winner -> new login must return to session-bound READY lobby",
    admissionSql.includes("p_rejoin boolean default false") &&
    admissionSql.includes("if p_ready is true and not v_running") &&
    admissionSql.includes("enchev_etap1_admissions") &&
    admissionSql.includes("Press READY for the NEXT auction") &&
    admissionSql.includes("a.session_id=p_session_id") &&
    api.includes('"etap1_ready_lobby_secure"') &&
    api.includes('"etap1_bid_admitted"') &&
    client.includes('const admitted=lobby?.admitted===true') &&
    client.includes('const showAuction=status==="live"&&(admitted||role==="admin")') &&
    client.includes("This round started without your current login")],
  ["opt-in Web Audio",client.includes("new AudioContext()") && client.includes("ENABLE SOUND")],
  ["response snapshots every second",client.includes('window.setInterval(()=>void poll(),1000)')],
  ["mobile width CSS",css.includes("@media(max-width:480px)")],
];
const failed=gates.filter(([_,pass])=>!pass);
for(const [name,pass] of gates) console.log(`${pass?"PASS":"FAIL"} ETAP1: ${name}`);
assert.equal(failed.length,0,`${failed.length} safety contracts failed`);
console.log("Static gates passed. This is NOT runtime 2-device acceptance.");
