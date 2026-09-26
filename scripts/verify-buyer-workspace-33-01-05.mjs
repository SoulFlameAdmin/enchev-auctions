import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-buyer-workspace-33-01-05.json";
const DOMAIN_PATH="packages/domain/src/buyer-workspace.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const BINDING_PATH="config/enchev-supabase-project.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error(`BUYER_WORKSPACE_33_01_05 FAIL: ${message}`);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTaskMap(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function(`"use strict"; return (${source.slice(start+startMarker.length,end).trim().replace(/;$/,"")});`)();
  const map=new Map();
  for(const [phaseId,,items] of raw){
    items.forEach((entry,index)=>map.set(`${phaseId}.${String(index+1).padStart(2,"0")}`,String(entry).split("|")[0]));
  }
  return map;
}

function verifyTaskIdentity(config){
  const expected=[
    ["33.01","Persistent watchlist / favorites"],
    ["33.02","Recently viewed vehicles"],
    ["33.03","Saved searches"],
    ["33.04","Saved-search result alerts"],
    ["33.05","My Auctions: Watching"]
  ];
  const actual=config.tasks?.map(x=>[x.id,x.name]);
  if(JSON.stringify(actual)!==JSON.stringify(expected)) fail("task contract drift");
  const frozen=frozenTaskMap();
  for(const [id,label] of expected) if(frozen.get(id)!==label) fail(`frozen task identity drift: ${id}`);
}

function verifyMigration(config){
  const migrationPath=config.persistence?.migration;
  if(migrationPath!=="supabase/migrations/20260926211000_buyer_workspace_foundation.sql") fail("migration path drift");
  const sql=fs.readFileSync(migrationPath,"utf8");
  const tables=["enchev_watchlist","enchev_recently_viewed","enchev_saved_searches","enchev_saved_search_alerts"];
  for(const table of tables){
    if(!new RegExp(`create table if not exists public\\.${table}\\b`,"i").test(sql)) fail(`missing table ${table}`);
    if(!new RegExp(`alter table public\\.${table} enable row level security`,"i").test(sql)) fail(`RLS missing: ${table}`);
  }
  if(!/primary key\s*\(user_id, vehicle_id\)/i.test(sql)) fail("watchlist/recent uniqueness primary key missing");
  if(!/unique\s*\(user_id, query_fingerprint\)/i.test(sql)) fail("saved-search deduplication missing");
  if(!/cooldown_seconds[^\n]*check\s*\(cooldown_seconds >= 60\)/i.test(sql)) fail("alert cooldown floor missing");
  const ownerChecks=(sql.match(/auth\.uid\(\) = user_id/g)||[]).length;
  if(ownerChecks<12) fail("insufficient owner-scoped RLS checks");
  if(!/exists\s*\(\s*select 1 from public\.enchev_saved_searches s[\s\S]*s\.user_id = auth\.uid\(\)/i.test(sql)) fail("alert saved-search ownership check missing");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-buyer-workspace-"));
  try{
    const tsc=path.resolve("node_modules/typescript/bin/tsc");
    const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
    if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
    const compiled=path.join(tmp,"buyer-workspace.js");
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    // Imported module is loaded before cleanup on all supported CI runtimes.
    setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  }
}

async function verifyDomain(config){
  const d=await loadDomain();
  const now="2026-09-26T18:00:00.000Z";
  let watch=[];
  watch=d.addToWatchlist(watch,{userId:"u1",vehicleId:"v1",auctionId:"a1",createdAt:now});
  watch=d.addToWatchlist(watch,{userId:"u1",vehicleId:"v1",auctionId:"a1",createdAt:now});
  watch=d.addToWatchlist(watch,{userId:"u2",vehicleId:"v2",auctionId:"a2",createdAt:now});
  if(watch.length!==2) fail("watchlist add is not idempotent per user/vehicle");
  if(JSON.stringify(d.watchingAuctionsForUser(watch,"u1"))!==JSON.stringify(["a1"])) fail("My Auctions: Watching leaked or drifted");
  watch=d.removeFromWatchlist(watch,{userId:"u1",vehicleId:"v1"});
  if(watch.some(x=>x.userId==="u1"&&x.vehicleId==="v1")) fail("watchlist removal failed");

  let recent=[];
  for(let i=0;i<105;i++){
    recent=d.recordRecentlyViewed(recent,{userId:"u1",vehicleId:`v${i}`,auctionId:null,viewedAt:new Date(Date.parse(now)+i*1000).toISOString()},config.limits.recentlyViewedPerUser);
  }
  if(recent.filter(x=>x.userId==="u1").length!==100) fail("recently viewed limit not enforced");
  recent=d.recordRecentlyViewed(recent,{userId:"u1",vehicleId:"v104",auctionId:"a104",viewedAt:"2026-09-26T19:00:00.000Z"},100);
  if(recent.filter(x=>x.userId==="u1"&&x.vehicleId==="v104").length!==1) fail("recent view upsert duplicate");

  const q1={make:"BMW",year:{max:2026,min:2020},fuel:["petrol","hybrid"]};
  const q2={fuel:["petrol","hybrid"],year:{min:2020,max:2026},make:"BMW"};
  if(d.savedSearchFingerprint(q1)!==d.savedSearchFingerprint(q2)) fail("saved-search fingerprint is not deterministic");
  const search=d.createSavedSearch({id:"s1",userId:"u1",name:"BMW newer",query:q1,createdAt:now,updatedAt:now});
  if(search.queryFingerprint!==d.savedSearchFingerprint(q1)) fail("saved search fingerprint drift");

  const alert=d.createSavedSearchAlert({id:"al1",userId:"u1",savedSearchId:"s1",enabled:true,cooldownSeconds:60,lastDeliveredAt:now});
  if(d.canDeliverSavedSearchAlert(alert,"2026-09-26T18:00:59.000Z")) fail("alert delivered before cooldown");
  if(!d.canDeliverSavedSearchAlert(alert,"2026-09-26T18:01:00.000Z")) fail("alert blocked after cooldown");

  return {watchlist:2,recentLimit:100,savedSearch:true,alert:true,watching:true};
}

function verifyBinding(){
  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
}

const config=readJson(CONFIG_PATH);
verifyTaskIdentity(config);
verifyMigration(config);
verifyBinding();
const indexSource=fs.readFileSync(INDEX_PATH,"utf8");
if(!indexSource.includes('export * from "./buyer-workspace";')) fail("buyer-workspace domain export missing");
const result=await verifyDomain(config);

if(process.argv.includes("--self-test")){
  const d=await loadDomain();
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank watchlist user",()=>d.addToWatchlist([],{userId:" ",vehicleId:"v",auctionId:null,createdAt:"x"}));
  await reject("invalid recent limit",()=>d.recordRecentlyViewed([],{userId:"u",vehicleId:"v",auctionId:null,viewedAt:"2026-01-01T00:00:00Z"},0));
  await reject("saved-search name too long",()=>d.createSavedSearch({id:"s",userId:"u",name:"x".repeat(121),query:{},createdAt:"x",updatedAt:"x"}));
  await reject("alert cooldown too low",()=>d.createSavedSearchAlert({id:"a",userId:"u",savedSearchId:"s",enabled:true,cooldownSeconds:59,lastDeliveredAt:null}));
  const mutated=structuredClone(config);mutated.tasks[0].name="Mutable favorites";let identityRejected=false;try{verifyTaskIdentity(mutated);}catch{identityRejected=true;}if(!identityRejected)fail("task identity negative test not rejected");
  console.log("BUYER_WORKSPACE_33_01_05_SELF_TEST PASS negative_cases=5");
}else{
  console.log(`BUYER_WORKSPACE_33_01_05 PASS tasks=5 watchlist_idempotent=true recent_limit=${result.recentLimit} saved_search_fingerprint=true alert_cooldown=true watching_user_scoped=true rls=true live_supabase_applied=false`);
}
