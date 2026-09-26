import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-duplicate-notification-suppression-33-14.json";
const DOMAIN_PATH="packages/domain/src/notification-suppression.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";
const REMINDER_PATH="packages/domain/src/starting-soon-reminders.ts";

function fail(message){throw new Error(`DUPLICATE_NOTIFICATION_SUPPRESSION_33_14 FAIL: ${message}`);}
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
  return String(phase[2][13]);
}

function verifyConfig(config){
  if(frozenTask()!=="Duplicate notification suppression||test") fail("frozen task identity/kind drift: 33.14");
  const expected=[["33.14","Duplicate notification suppression","test"]];
  if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name,x.kind]))!==JSON.stringify(expected)) fail("task contract drift");

  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.persistence?.newGovernanceBusinessTableRequired!==false) fail("must not invent governance business persistence");
  if(config.authority?.deliveryLedger!=="postgresql"||config.authority?.governanceSupabaseAuthoritative!==false||config.authority?.realtimeTransportAuthoritative!==false) fail("delivery authority drift");
  for(const key of ["suppressionMayChangeAuctionState","suppressionMayAcceptBid","suppressionMayChooseWinner"]) if(config.authority?.[key]!==false) fail(`authority guardrail drift: ${key}`);
  for(const key of ["userScoped","notificationKindScoped","dedupeKeyRequired","batchDuplicatesSuppressed","alreadyDeliveredSuppressed","sameKeyDifferentUserAllowed","sameKeyDifferentKindAllowed","expiredLedgerEntryIgnored","deterministicOrdering"]) if(config.semantics?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);
  if(config.limits?.maxCandidates!==1000||config.limits?.maxLedgerEntries!==5000) fail("limits drift");

  const reminder=fs.readFileSync(REMINDER_PATH,"utf8");
  if(!reminder.includes("reminderKey:")||!reminder.includes("${userId}:${auctionId}:${startsAt}:${leadMinutes}")) fail("33.11 deterministic reminder key integration drift");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-notification-suppression-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const mod=await import(`${pathToFileURL(path.join(tmp,"notification-suppression.js")).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
verifyConfig(config);
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./notification-suppression";')) fail("domain export missing");
const d=await loadDomain();

const candidates=[
  {userId:"u1",kind:"starting-soon",dedupeKey:"r1",occurredAt:"2026-09-27T09:00:03Z",payloadRef:"late-duplicate"},
  {userId:"u1",kind:"starting-soon",dedupeKey:"r1",occurredAt:"2026-09-27T09:00:01Z",payloadRef:"first"},
  {userId:"u1",kind:"saved-search",dedupeKey:"r1",occurredAt:"2026-09-27T09:00:02Z",payloadRef:"other-kind"},
  {userId:"u2",kind:"starting-soon",dedupeKey:"r1",occurredAt:"2026-09-27T09:00:02Z",payloadRef:"other-user"},
  {userId:"u1",kind:"auction-status",dedupeKey:"delivered",occurredAt:"2026-09-27T09:00:04Z",payloadRef:"already"},
  {userId:"u1",kind:"bid-status",dedupeKey:"expired",occurredAt:"2026-09-27T09:00:05Z",payloadRef:"expired-ledger"}
];
const ledger=[
  {userId:"u1",kind:"auction-status",dedupeKey:"delivered",deliveredAt:"2026-09-27T08:00:00Z",expiresAt:null},
  {userId:"u1",kind:"bid-status",dedupeKey:"expired",deliveredAt:"2026-09-27T08:00:00Z",expiresAt:"2026-09-27T08:59:59Z"}
];
const result=d.suppressDuplicateNotifications(candidates,ledger,"2026-09-27T09:00:00Z",config.limits.maxCandidates,config.limits.maxLedgerEntries);
if(result.deliverable.length!==4) fail(`deliverable count drift: ${result.deliverable.length}`);
if(result.suppressed.length!==2) fail(`suppressed count drift: ${result.suppressed.length}`);
if(result.suppressed.filter(x=>x.reason==="batch-duplicate").length!==1) fail("batch duplicate suppression drift");
if(result.suppressed.filter(x=>x.reason==="already-delivered").length!==1) fail("ledger suppression drift");
if(!result.deliverable.some(x=>x.userId==="u2"&&x.dedupeKey==="r1")) fail("cross-user isolation drift");
if(!result.deliverable.some(x=>x.kind==="saved-search"&&x.dedupeKey==="r1")) fail("cross-kind isolation drift");
if(!result.deliverable.some(x=>x.dedupeKey==="expired")) fail("expired ledger entry still suppresses");
if(result.deliverable.find(x=>x.kind==="starting-soon"&&x.userId==="u1")?.payloadRef!=="first") fail("deterministic first candidate drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("invalid now",()=>d.suppressDuplicateNotifications([],[],"bad"));
  await reject("blank candidate user",()=>d.suppressDuplicateNotifications([{...candidates[0],userId:" "}],[],"2026-09-27T09:00:00Z"));
  await reject("blank candidate key",()=>d.suppressDuplicateNotifications([{...candidates[0],dedupeKey:" "}],[],"2026-09-27T09:00:00Z"));
  await reject("blank candidate payload",()=>d.suppressDuplicateNotifications([{...candidates[0],payloadRef:" "}],[],"2026-09-27T09:00:00Z"));
  await reject("invalid candidate time",()=>d.suppressDuplicateNotifications([{...candidates[0],occurredAt:"bad"}],[],"2026-09-27T09:00:00Z"));
  await reject("invalid ledger time",()=>d.suppressDuplicateNotifications([],[{...ledger[0],deliveredAt:"bad"}],"2026-09-27T09:00:00Z"));
  await reject("invalid ledger expiry",()=>d.suppressDuplicateNotifications([],[{...ledger[0],expiresAt:"bad"}],"2026-09-27T09:00:00Z"));
  await reject("candidate bound",()=>d.suppressDuplicateNotifications([candidates[0],candidates[1]],[],"2026-09-27T09:00:00Z",1,5000));
  await reject("ledger bound",()=>d.suppressDuplicateNotifications([],ledger,"2026-09-27T09:00:00Z",1000,1));
  const mutated=structuredClone(config);mutated.tasks[0].kind="security";let rejected=false;try{verifyConfig(mutated);}catch{rejected=true;}if(!rejected)fail("frozen task kind mutation accepted");
  console.log("DUPLICATE_NOTIFICATION_SUPPRESSION_33_14_SELF_TEST PASS negative_cases=10");
}else{
  console.log(`DUPLICATE_NOTIFICATION_SUPPRESSION_33_14 PASS deliverable=${result.deliverable.length} suppressed=${result.suppressed.length} authority=postgresql`);
}
