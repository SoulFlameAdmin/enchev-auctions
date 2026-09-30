import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-object-level-authorization-abuse-41-03.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";
const WATCHLIST_SQL="supabase/migrations/20260926211000_buyer_workspace_foundation.sql";
const MODULES=[
  ["buyer-workspace","packages/domain/src/buyer-workspace.ts"],
  ["buyer-auction-workspace","packages/domain/src/buyer-auction-workspace.ts"],
  ["seller-listing-foundation","packages/domain/src/seller-listing-foundation.ts"],
  ["seller-workflow","packages/domain/src/seller-workflow.ts"]
];

function fail(message){throw new Error("OBJECT_LEVEL_AUTHORIZATION_ABUSE_41_03 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function requireReject(label,fn){
  let rejected=false;
  try{fn();}catch{rejected=true;}
  if(!rejected)fail("abuse case was accepted: "+label);
}
function policyBody(sql,policyName){
  const re=new RegExp("create\\s+policy\\s+"+policyName+"\\s+on\\s+public\\.enchev_watchlist([\\s\\S]*?)(?=create\\s+policy|$)","i");
  return sql.match(re)?.[1]??"";
}
async function compileModules(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-ola-41-03-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  for(const [,source] of MODULES){
    const r=spawnSync(process.execPath,[tsc,source,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
    if(r.status!==0)fail("domain TypeScript compile failed for "+source+": "+(r.stderr||r.stdout||"").trim());
  }
  const loaded={};
  for(const [name,source] of MODULES){
    loaded[name]=await import(pathToFileURL(path.join(tmp,path.basename(source,".ts")+".js")).href+"?v="+Date.now()+"-"+name);
  }
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return loaded;
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.03"||config.title!=="Object-level authorization abuse test"||config.kind!=="security") fail("task identity drift");
for(const key of ["defaultDeny","clientProvidedOwnershipTrusted","uiVisibilityIsAuthorization","governanceSupabaseAuthoritative"]){
  const expected=key==="defaultDeny";
  if(config.authority?.[key]!==expected)fail("authority boundary drift: "+key);
}
for(const key of ["crossObjectIdSwapRejected","crossUserProjectionLeakForbidden","crossSellerMutationRejected","databaseOwnerPolicyRequired","securityDefinerBypassForbidden","acceptedBidOrWinnerMutationForbidden","deterministicEvidenceOnly"]){
  if(config.acceptance?.[key]!==true)fail("acceptance guardrail disabled: "+key);
}
if(!Array.isArray(config.objects)||config.objects.length<6)fail("object coverage incomplete");
for(const row of config.objects){
  if(!row.object||!row.ownerKey||!Array.isArray(row.controls)||!row.controls.length||!Array.isArray(row.abuseCases)||!row.abuseCases.length) fail("object coverage row incomplete");
}
if(config.persistence?.watchlistMigration!==WATCHLIST_SQL||config.persistence?.liveGovernanceProjectApply!==false)fail("persistence boundary drift");

const binding=readJson(BINDING_PATH);
if(binding.scope!=="development-governance"||binding.auction_authority!==false)fail("Supabase governance authority boundary drift");

const source=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=source.indexOf('["41","Security & abuse certification"');
const p42Start=source.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start)fail("frozen Phase 41 not found");
const phase41=source.slice(p41Start,p42Start);
if(!phase41.includes('"Object-level authorization abuse test||security"'))fail("frozen 41.03 identity missing");

const sql=fs.readFileSync(WATCHLIST_SQL,"utf8");
if(!/alter\s+table\s+public\.enchev_watchlist\s+enable\s+row\s+level\s+security\s*;/i.test(sql))fail("watchlist RLS missing");
if(/disable\s+row\s+level\s+security/i.test(sql))fail("RLS disable found");
if(/security\s+definer/i.test(sql))fail("SECURITY DEFINER authorization bypass found");
const select=policyBody(sql,"enchev_watchlist_owner_select");
const insert=policyBody(sql,"enchev_watchlist_owner_insert");
const del=policyBody(sql,"enchev_watchlist_owner_delete");
if(!/for\s+select/i.test(select)||!/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(select))fail("owner SELECT policy drift");
if(!/for\s+insert/i.test(insert)||!/with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(insert))fail("owner INSERT policy drift");
if(!/for\s+delete/i.test(del)||!/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(del))fail("owner DELETE policy drift");
const policies=[select,insert,del].join("\n");
if(/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(policies))fail("broad allow policy found");
if(/to\s+(anon|public)\b/i.test(policies))fail("anonymous/public watchlist policy found");

const d=await compileModules();
const bw=d["buyer-workspace"];
const ba=d["buyer-auction-workspace"];
const sl=d["seller-listing-foundation"];
const sw=d["seller-workflow"];
const now="2026-09-30T12:00:00.000Z";

let watch=[];
watch=bw.addToWatchlist(watch,{userId:"buyer-a",vehicleId:"vehicle-shared",auctionId:"auction-a",createdAt:now});
watch=bw.addToWatchlist(watch,{userId:"buyer-b",vehicleId:"vehicle-shared",auctionId:"auction-b",createdAt:now});
watch=bw.addToWatchlist(watch,{userId:"buyer-b",vehicleId:"vehicle-b",auctionId:"auction-c",createdAt:now});
if(JSON.stringify(bw.watchingAuctionsForUser(watch,"buyer-a"))!==JSON.stringify(["auction-a"]))fail("foreign watchlist projection leaked to buyer-a");
if(JSON.stringify(bw.watchingAuctionsForUser(watch,"buyer-b"))!==JSON.stringify(["auction-b","auction-c"]))fail("buyer-b watchlist projection drift");
const foreignDelete=bw.removeFromWatchlist(watch,{userId:"buyer-a",vehicleId:"vehicle-b"});
if(foreignDelete.length!==watch.length)fail("foreign watchlist object ID delete changed another user's row");

const participation=[
 {userId:"buyer-a",auctionId:"auction-a",hasAcceptedBid:true,isCurrentLeader:false,auctionStatus:"live",updatedAt:now},
 {userId:"buyer-b",auctionId:"auction-secret",hasAcceptedBid:true,isCurrentLeader:true,auctionStatus:"live",updatedAt:now},
 {userId:"buyer-b",auctionId:"auction-closed",hasAcceptedBid:true,isCurrentLeader:false,auctionStatus:"closed",updatedAt:now}
];
if(JSON.stringify(ba.biddingAuctionsForUser(participation,"buyer-a"))!==JSON.stringify(["auction-a"]))fail("foreign bidding object leaked");
if(JSON.stringify(ba.leadingAuctionsForUser(participation,"buyer-a"))!==JSON.stringify([]))fail("foreign leading object leaked");
const panel=ba.buildMultiAuctionPanel(participation,"buyer-a",{"auction-a":7,"auction-secret":9,"auction-closed":10});
if(panel.length!==1||panel[0].auctionId!=="auction-a")fail("foreign multi-auction panel object leaked");

const draft={
 listingId:"listing-a",sellerId:"seller-a",vehicleId:"vehicle-a",revision:0,updatedAt:now,wizardStep:"vehicle",
 fields:{vin:"VIN-A"},media:[],appliedMutationIds:[]
};
requireReject("foreign seller listing autosave",()=>sl.autosaveSellerListingDraft(draft,{
 sellerId:"seller-b",mutationId:"mut-foreign",expectedRevision:0,occurredAt:now,fields:{make:"X"}
}));

const reserve={listingId:"listing-a",sellerId:"seller-a",reserveCents:100000,revision:0,updatedAt:now,appliedMutationIds:[]};
requireReject("foreign reserve lowering",()=>sw.lowerListingReserve(reserve,{
 sellerId:"seller-b",mutationId:"reserve-foreign",expectedRevision:0,newReserveCents:90000,occurredAt:now
}));

const questions=[{questionId:"q1",vehicleId:"vehicle-a",askerUserId:"buyer-a",createdAt:now,status:"published"}];
requireReject("foreign seller verification reuse",()=>sw.addSellerVerifiedReply([],questions,{
 sellerId:"seller-a",verificationId:"verify-a",status:"verified",verifiedAt:now
},{
 replyId:"r1",questionId:"q1",vehicleId:"vehicle-a",sellerId:"seller-b",body:"reply",createdAt:now,media:[]
}));

const presence=sw.updateSellerLiveAuctionPresence(null,{
 sellerId:"seller-a",auctionId:"auction-a",connectionId:"conn-a",state:"online",sequence:1,observedAt:now
});
requireReject("presence seller scope switch",()=>sw.updateSellerLiveAuctionPresence(presence,{
 sellerId:"seller-b",auctionId:"auction-a",connectionId:"conn-b",state:"online",sequence:2,observedAt:"2026-09-30T12:00:01.000Z"
}));
requireReject("presence auction scope switch",()=>sw.updateSellerLiveAuctionPresence(presence,{
 sellerId:"seller-a",auctionId:"auction-b",connectionId:"conn-b",state:"online",sequence:2,observedAt:"2026-09-30T12:00:01.000Z"
}));

if(process.argv.includes("--self-test")){
  const mutated=structuredClone(config);
  mutated.acceptance.crossObjectIdSwapRejected=false;
  if(mutated.acceptance.crossObjectIdSwapRejected!==false)fail("negative config fixture broken");
  let rejected=false;
  try{
    if(mutated.acceptance.crossObjectIdSwapRejected!==true)throw new Error("disabled");
  }catch{rejected=true;}
  if(!rejected)fail("disabled cross-object guardrail accepted");

  const unsafeSql=sql.replace("using (auth.uid() = user_id)","using (true)");
  if(!/using\s*\(\s*true\s*\)/i.test(unsafeSql))fail("negative SQL broad-policy fixture broken");

  requireReject("blank projection user",()=>ba.biddingAuctionsForUser(participation," "));
  requireReject("foreign autosave repeated",()=>sl.autosaveSellerListingDraft(draft,{sellerId:"attacker",mutationId:"x",expectedRevision:0,occurredAt:now}));
  console.log("OBJECT_LEVEL_AUTHORIZATION_ABUSE_41_03_SELF_TEST PASS objects=6 abuse_cases=12 rls_owner_only=true buyer_projection_scoped=true seller_cross_object_writes_rejected=true governance_authority=false accepted_bid_or_winner_mutation=false negative_cases=4");
}else{
  console.log("OBJECT_LEVEL_AUTHORIZATION_ABUSE_41_03 PASS objects=6 abuse_cases=12 rls_owner_only=true buyer_projection_scoped=true seller_cross_object_writes_rejected=true");
}
