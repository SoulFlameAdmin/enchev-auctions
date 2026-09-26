import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-watchlist-authorization-tests-33-15.json";
const DOMAIN_PATH="packages/domain/src/buyer-workspace.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error(`WATCHLIST_AUTHORIZATION_33_15 FAIL: ${message}`);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTask(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function(`"use strict"; return (${source.slice(start+startMarker.length,end).trim().replace(/;$/,"")});`)();
  const phase=raw.find(x=>x[0]==="33");
  if(!phase) fail("phase 33 missing");
  return String(phase[2][14]);
}

function policyBody(sql,policyName){
  const re=new RegExp(`create\\s+policy\\s+${policyName}\\s+on\\s+public\\.enchev_watchlist([\\s\\S]*?)(?=create\\s+policy|$)`,"i");
  return sql.match(re)?.[1]??"";
}

function verifyConfig(config){
  if(frozenTask()!=="Watchlist authorization tests||security") fail("frozen task identity/kind drift: 33.15");
  const expected=[["33.15","Watchlist authorization tests","security"]];
  if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name,x.kind]))!==JSON.stringify(expected)) fail("task contract drift");
  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.authority?.watchlist!=="postgresql"||config.authority?.governanceSupabaseAuthoritative!==false||config.authority?.clientProvidedOwnershipTrusted!==false) fail("watchlist authority drift");
  for(const key of ["rlsRequired","ownerSelectOnly","ownerInsertOnly","ownerDeleteOnly","crossUserReadForbidden","crossUserInsertForbidden","crossUserDeleteForbidden","sameVehicleDifferentUsersIndependent","watchingProjectionUserScoped"]) if(config.security?.[key]!==true) fail(`security guardrail disabled: ${key}`);
  if(config.persistence?.liveGovernanceProjectApply!==false) fail("governance project must not receive auction business schema");
}

function verifySql(config){
  const p=config.persistence?.migration;
  if(p!=="supabase/migrations/20260926211000_buyer_workspace_foundation.sql") fail("migration path drift");
  const sql=fs.readFileSync(p,"utf8");
  if(!/alter\s+table\s+public\.enchev_watchlist\s+enable\s+row\s+level\s+security\s*;/i.test(sql)) fail("watchlist RLS is not enabled");
  if(/disable\s+row\s+level\s+security/i.test(sql)) fail("RLS disable found");
  if(/security\s+definer/i.test(sql)) fail("SECURITY DEFINER bypass found");

  const select=policyBody(sql,"enchev_watchlist_owner_select");
  const insert=policyBody(sql,"enchev_watchlist_owner_insert");
  const del=policyBody(sql,"enchev_watchlist_owner_delete");
  if(!/for\s+select/i.test(select)||!/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(select)) fail("owner SELECT policy drift");
  if(!/for\s+insert/i.test(insert)||!/with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(insert)) fail("owner INSERT policy drift");
  if(!/for\s+delete/i.test(del)||!/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(del)) fail("owner DELETE policy drift");

  const watchPolicies=[select,insert,del].join("\n");
  if(/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(watchPolicies)) fail("broad allow policy found");
  if(/to\s+(anon|public)\b/i.test(watchPolicies)) fail("anonymous/public watchlist policy found");
  if(!/primary\s+key\s*\(user_id,\s*vehicle_id\)/i.test(sql)) fail("per-user vehicle independence key drift");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-watchlist-auth-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const mod=await import(`${pathToFileURL(path.join(tmp,"buyer-workspace.js")).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
verifyConfig(config);
verifySql(config);
const d=await loadDomain();
const now="2026-09-27T10:00:00Z";
let rows=[];
rows=d.addToWatchlist(rows,{userId:"u1",vehicleId:"v-shared",auctionId:"a1",createdAt:now});
rows=d.addToWatchlist(rows,{userId:"u2",vehicleId:"v-shared",auctionId:"a2",createdAt:now});
rows=d.addToWatchlist(rows,{userId:"u2",vehicleId:"v2",auctionId:"a3",createdAt:now});
if(rows.length!==3) fail("same vehicle was not independent across users");
if(JSON.stringify(d.watchingAuctionsForUser(rows,"u1"))!==JSON.stringify(["a1"])) fail("u1 watching projection leaked foreign auction");
if(JSON.stringify(d.watchingAuctionsForUser(rows,"u2"))!==JSON.stringify(["a2","a3"])) fail("u2 watching projection drift");
const afterU1Delete=d.removeFromWatchlist(rows,{userId:"u1",vehicleId:"v-shared"});
if(afterU1Delete.some(x=>x.userId==="u1"&&x.vehicleId==="v-shared")) fail("owner delete failed");
if(!afterU1Delete.some(x=>x.userId==="u2"&&x.vehicleId==="v-shared")) fail("cross-user delete removed foreign row");
const afterForeignAttempt=d.removeFromWatchlist(rows,{userId:"u1",vehicleId:"v2"});
if(afterForeignAttempt.length!==rows.length) fail("cross-user delete attempt changed foreign row");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank watchlist user",()=>d.addToWatchlist([],{userId:" ",vehicleId:"v",auctionId:null,createdAt:now}));
  await reject("blank watchlist vehicle",()=>d.addToWatchlist([],{userId:"u",vehicleId:" ",auctionId:null,createdAt:now}));
  await reject("blank delete user",()=>d.removeFromWatchlist(rows,{userId:" ",vehicleId:"v"}));
  await reject("blank delete vehicle",()=>d.removeFromWatchlist(rows,{userId:"u",vehicleId:" "}));
  await reject("blank watching user",()=>d.watchingAuctionsForUser(rows," "));
  const mutated=structuredClone(config);mutated.tasks[0].kind="test";let rejected=false;try{verifyConfig(mutated);}catch{rejected=true;}if(!rejected)fail("frozen security kind mutation accepted");
  const sql=fs.readFileSync(config.persistence.migration,"utf8");
  const unsafe=sql.replace("using (auth.uid() = user_id)","using (true)");
  const tmp=path.join(os.tmpdir(),`watchlist-unsafe-${process.pid}.sql`);
  fs.writeFileSync(tmp,unsafe);
  let unsafeDetected=/using\s*\(\s*true\s*\)/i.test(fs.readFileSync(tmp,"utf8"));
  fs.rmSync(tmp,{force:true});
  if(!unsafeDetected) fail("unsafe policy mutation detector failed");
  console.log("WATCHLIST_AUTHORIZATION_33_15_SELF_TEST PASS negative_cases=7");
}else{
  console.log("WATCHLIST_AUTHORIZATION_33_15 PASS rls=true owner_select=true owner_insert=true owner_delete=true cross_user_read_delete_isolation=true same_vehicle_multi_user=true governance_apply=false");
}
