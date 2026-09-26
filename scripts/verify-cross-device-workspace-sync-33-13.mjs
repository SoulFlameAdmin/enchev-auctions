import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-cross-device-workspace-sync-33-13.json";
const DOMAIN_PATH="packages/domain/src/cross-device-workspace-sync.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error(`CROSS_DEVICE_WORKSPACE_SYNC_33_13 FAIL: ${message}`);}
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
  for(const [phaseId,,items] of raw) items.forEach((entry,index)=>map.set(`${phaseId}.${String(index+1).padStart(2,"0")}`,String(entry).split("|")[0]));
  return map;
}

function verifyConfig(config){
  const expected=[["33.13","Cross-device workspace synchronization"]];
  if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name]))!==JSON.stringify(expected)) fail("task contract drift");
  if(frozenTaskMap().get("33.13")!=="Cross-device workspace synchronization") fail("frozen task identity drift: 33.13");
  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.persistence?.newGovernanceBusinessTableRequired!==false) fail("33.13 must not invent governance business persistence");
  if(config.authority?.workspaceState!=="postgresql"||config.authority?.deviceStateAuthoritative!==false||config.authority?.realtimeTransportAuthoritative!==false) fail("workspace authority drift");
  for(const key of ["syncMayChangeAuctionState","syncMayAcceptBid","syncMayChooseWinner"]) if(config.authority?.[key]!==false) fail(`authority guardrail drift: ${key}`);
  for(const key of ["userScopedOnly","serverRevisionAuthoritative","optimisticConcurrencyRequired","staleRevisionRejected","mutationIdIdempotent","deterministicCanonicalOrdering","deviceIdIsAuditOnly","conflictRequiresAuthoritativeRefetch"]) if(config.semantics?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);
  const l=config.limits;
  if(l?.maxSections!==32||l?.maxEntriesPerSection!==1000||l?.maxAppliedMutationIds!==256||l?.maxOperationsPerMutation!==500) fail("sync limits drift");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-workspace-sync-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const mod=await import(`${pathToFileURL(path.join(tmp,"cross-device-workspace-sync.js")).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
verifyConfig(config);
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./cross-device-workspace-sync";')) fail("domain export missing");
const d=await loadDomain();

const base=d.normalizeWorkspaceSyncSnapshot({
  userId:"u1",
  revision:7,
  updatedAt:"2026-09-27T08:00:00Z",
  sections:{watchlist:["v2","v1","v1"],savedSearches:["s2","s1"]},
  appliedMutationIds:["old-1"]
});
if(JSON.stringify(base.sections.watchlist)!==JSON.stringify(["v1","v2"])) fail("canonical section ordering drift");
const mutation={
  userId:"u1",
  deviceId:"phone-a",
  mutationId:"m-8",
  expectedRevision:7,
  occurredAt:"2026-09-27T08:01:00Z",
  operations:[
    {section:"watchlist",action:"remove",itemId:"v1"},
    {section:"watchlist",action:"add",itemId:"v3"},
    {section:"recentlyViewed",action:"add",itemId:"v9"}
  ]
};
const next=d.applyWorkspaceSyncMutation(base,mutation,config.limits);
if(next.revision!==8||next.updatedAt!=="2026-09-27T08:01:00.000Z") fail("accepted mutation revision/time drift");
if(JSON.stringify(next.sections.watchlist)!==JSON.stringify(["v2","v3"])) fail("workspace mutation result drift");
if(JSON.stringify(next.sections.recentlyViewed)!==JSON.stringify(["v9"])) fail("new section mutation drift");
const retry=d.applyWorkspaceSyncMutation(next,mutation,config.limits);
if(retry.revision!==8||JSON.stringify(retry)!==JSON.stringify(next)) fail("idempotent retry drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank snapshot user",()=>d.normalizeWorkspaceSyncSnapshot({...base,userId:" "}));
  await reject("invalid revision",()=>d.normalizeWorkspaceSyncSnapshot({...base,revision:-1}));
  await reject("invalid updatedAt",()=>d.normalizeWorkspaceSyncSnapshot({...base,updatedAt:"bad"}));
  await reject("cross-user mutation",()=>d.applyWorkspaceSyncMutation(base,{...mutation,userId:"u2"}));
  await reject("stale revision",()=>d.applyWorkspaceSyncMutation(base,{...mutation,mutationId:"m-stale",expectedRevision:6}));
  await reject("blank device",()=>d.applyWorkspaceSyncMutation(base,{...mutation,deviceId:" "}));
  await reject("blank mutation id",()=>d.applyWorkspaceSyncMutation(base,{...mutation,mutationId:" "}));
  await reject("invalid occurredAt",()=>d.applyWorkspaceSyncMutation(base,{...mutation,occurredAt:"bad"}));
  await reject("operation limit",()=>d.applyWorkspaceSyncMutation(base,{...mutation,operations:[mutation.operations[0],mutation.operations[1]]},{...config.limits,maxOperationsPerMutation:1}));
  await reject("entry limit",()=>d.applyWorkspaceSyncMutation(base,{...mutation,mutationId:"m-limit",operations:[{section:"watchlist",action:"add",itemId:"v3"}]},{...config.limits,maxEntriesPerSection:2}));
  const mutated=structuredClone(config);mutated.tasks[0].name="Mutable synchronization";let rejected=false;try{verifyConfig(mutated);}catch{rejected=true;}if(!rejected)fail("frozen identity mutation accepted");
  console.log("CROSS_DEVICE_WORKSPACE_SYNC_33_13_SELF_TEST PASS negative_cases=11");
}else{
  console.log(`CROSS_DEVICE_WORKSPACE_SYNC_33_13 PASS revision=${next.revision} idempotent_retry=true authority=postgresql`);
}
