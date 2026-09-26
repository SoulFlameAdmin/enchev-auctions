import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-starting-soon-reminders-33-11.json";
const DOMAIN_PATH="packages/domain/src/starting-soon-reminders.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error(`STARTING_SOON_REMINDERS_33_11 FAIL: ${message}`);}
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
  const expected=[["33.11","Starting-soon reminders"]];
  if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name]))!==JSON.stringify(expected)) fail("task contract drift");
  const frozen=frozenTaskMap();
  if(frozen.get("33.11")!=="Starting-soon reminders") fail("frozen task identity drift: 33.11");

  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.persistence?.newBusinessTableRequired!==false) fail("33.11 must not invent persistence");
  if(config.authority?.auctionSchedule!=="postgresql") fail("auction schedule authority drift");
  if(config.authority?.reminderProjectionAuthoritative!==false||config.authority?.reminderMayChangeAuctionState!==false||config.authority?.reminderMayAcceptBid!==false||config.authority?.reminderMayChooseWinner!==false) fail("reminder authority boundary drift");

  const s=config.semantics;
  for(const key of ["userScopedOnly","scheduledAuctionsOnly","futureAuctionsOnly","leadWindowInclusive","deterministicReminderKey"]) if(s?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);
  if(s?.defaultLeadMinutes!==15||s?.duplicateSuppressionOwnershipTask!=="33.14"||s?.deliveryProviderOwnershipDeferred!==true) fail("reminder ownership/default drift");
  if(config.limits?.maxLeadMinutes!==1440||config.limits?.maxCandidates!==500) fail("reminder limits drift");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-starting-soon-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const mod=await import(`${pathToFileURL(path.join(tmp,"starting-soon-reminders.js")).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
verifyConfig(config);
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./starting-soon-reminders";')) fail("domain export missing");

const d=await loadDomain();
const rows=[
  {userId:"u1",auctionId:"a-later",startsAt:"2026-09-27T10:15:00Z",status:"scheduled"},
  {userId:"u1",auctionId:"a-now",startsAt:"2026-09-27T10:05:00Z",status:"scheduled"},
  {userId:"u1",auctionId:"too-late",startsAt:"2026-09-27T10:16:00Z",status:"scheduled"},
  {userId:"u1",auctionId:"live",startsAt:"2026-09-27T10:04:00Z",status:"live"},
  {userId:"u2",auctionId:"foreign",startsAt:"2026-09-27T10:05:00Z",status:"scheduled"},
  {userId:"u1",auctionId:"a-now",startsAt:"2026-09-27T10:05:00Z",status:"scheduled"}
];
const result=d.startingSoonRemindersForUser(rows,"u1","2026-09-27T10:00:00Z",config.semantics.defaultLeadMinutes,config.limits.maxCandidates);
if(JSON.stringify(result.map(x=>x.auctionId))!==JSON.stringify(["a-now","a-later"])) fail("eligibility/order/dedup drift");
if(result.some(x=>x.userId!=="u1")) fail("cross-user reminder leak");
if(result[0].reminderKey!=="u1:a-now:2026-09-27T10:05:00.000Z:15") fail("deterministic reminder key drift");
if(result[0].dueAt!=="2026-09-27T10:00:00.000Z") fail("due-at clamp drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank user",()=>d.startingSoonRemindersForUser([]," ","2026-09-27T10:00:00Z"));
  await reject("invalid now",()=>d.startingSoonRemindersForUser([],"u","nope"));
  await reject("zero lead",()=>d.startingSoonRemindersForUser([],"u","2026-09-27T10:00:00Z",0));
  await reject("lead over 24h",()=>d.startingSoonRemindersForUser([],"u","2026-09-27T10:00:00Z",1441));
  await reject("bad max candidates",()=>d.startingSoonRemindersForUser([],"u","2026-09-27T10:00:00Z",15,0));
  await reject("invalid owned schedule timestamp",()=>d.startingSoonRemindersForUser([{userId:"u",auctionId:"a",startsAt:"bad",status:"scheduled"}],"u","2026-09-27T10:00:00Z"));
  const mutated=structuredClone(config);mutated.tasks[0].name="Mutable reminders";let rejected=false;try{verifyConfig(mutated);}catch{rejected=true;}if(!rejected)fail("frozen identity mutation accepted");
  console.log("STARTING_SOON_REMINDERS_33_11_SELF_TEST PASS negative_cases=7");
}else{
  console.log(`STARTING_SOON_REMINDERS_33_11 PASS reminders=${result.length} authority=postgresql duplicate_suppression_owner=33.14`);
}
