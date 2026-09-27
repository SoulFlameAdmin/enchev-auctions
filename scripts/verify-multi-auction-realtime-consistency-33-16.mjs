import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-multi-auction-realtime-consistency-33-16.json";
const DOMAIN_PATH="packages/domain/src/multi-auction-realtime-consistency.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error("MULTI_AUCTION_REALTIME_33_16 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTask(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="33");
  if(!phase) fail("phase 33 missing");
  return String(phase[2][15]);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-multi-auction-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"multi-auction-realtime-consistency.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
if(frozenTask()!=="Multi-auction realtime consistency test||test") fail("frozen task identity/kind drift");
if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name,x.kind]))!==JSON.stringify([["33.16","Multi-auction realtime consistency test","test"]])) fail("task contract drift");
const binding=readJson(BINDING_PATH);
if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
if(config.authority?.auctionState!=="postgresql"||config.authority?.realtimeProjectionAuthoritative!==false||config.authority?.governanceSupabaseAuthoritative!==false) fail("authority drift");
for(const key of ["authenticatedUserScoped","perAuctionSequenceMonotonic","interleavedAuctionsIndependent","duplicateEventsIdempotent","sequenceGapMarksOnlyAffectedAuctionStale","bidRegressionRejected","closedAndCancelledBecomeEnded"]) if(config.semantics?.[key]!==true) fail("semantic guardrail disabled: "+key);
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./multi-auction-realtime-consistency";')) fail("domain export missing");

const d=await loadDomain();
const base=[
  {userId:"u1",auctionId:"a1",sequence:4,status:"live",actionState:"bid",currentBidCents:10000,updatedAt:"2026-09-27T12:00:00Z",stale:false,recentEventIds:["old-a1"]},
  {userId:"u1",auctionId:"a2",sequence:9,status:"live",actionState:"leading",currentBidCents:22000,updatedAt:"2026-09-27T12:00:00Z",stale:false,recentEventIds:["old-a2"]}
];
const events=[
  {eventId:"e-a2-10",userId:"u1",auctionId:"a2",sequence:10,occurredAt:"2026-09-27T12:01:00Z",kind:"outbid",currentBidCents:23000},
  {eventId:"e-a1-5",userId:"u1",auctionId:"a1",sequence:5,occurredAt:"2026-09-27T12:01:01Z",kind:"leading",currentBidCents:11000},
  {eventId:"e-a2-10",userId:"u1",auctionId:"a2",sequence:10,occurredAt:"2026-09-27T12:01:02Z",kind:"outbid",currentBidCents:23000},
  {eventId:"late-a1-4",userId:"u1",auctionId:"a1",sequence:4,occurredAt:"2026-09-27T12:01:03Z",kind:"bid-accepted",currentBidCents:10000}
];
const out=d.applyMultiAuctionRealtimeEvents(base,"u1",events,config.limits);
const a1=out.states.find(x=>x.auctionId==="a1");
const a2=out.states.find(x=>x.auctionId==="a2");
if(!a1||!a2) fail("two-auction result missing");
if(a1.sequence!==5||a1.actionState!=="leading"||a1.currentBidCents!==11000) fail("a1 interleaved state drift");
if(a2.sequence!==10||a2.actionState!=="bid"||a2.currentBidCents!==23000) fail("a2 interleaved state drift");
if(JSON.stringify(out.duplicateEventIds)!==JSON.stringify(["e-a2-10","late-a1-4"])) fail("duplicate/delayed handling drift");

const gap=d.applyMultiAuctionRealtimeEvents(out.states,"u1",[
  {eventId:"gap-a1-7",userId:"u1",auctionId:"a1",sequence:7,occurredAt:"2026-09-27T12:02:00Z",kind:"leading",currentBidCents:12000}
],config.limits);
if(JSON.stringify(gap.staleAuctionIds)!==JSON.stringify(["a1"])) fail("gap did not isolate stale auction");
if(gap.states.find(x=>x.auctionId==="a2")?.stale!==false) fail("gap contaminated unrelated auction");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("cross-user state",()=>d.applyMultiAuctionRealtimeEvents([{...base[0],userId:"u2"}],"u1",[],config.limits));
  await reject("cross-user event",()=>d.applyMultiAuctionRealtimeEvents(base,"u1",[{...events[0],eventId:"foreign",userId:"u2"}],config.limits));
  await reject("bid regression",()=>d.applyMultiAuctionRealtimeEvents(base,"u1",[{eventId:"regress",userId:"u1",auctionId:"a1",sequence:5,occurredAt:"2026-09-27T12:03:00Z",kind:"leading",currentBidCents:9999}],config.limits));
  await reject("event limit",()=>d.applyMultiAuctionRealtimeEvents(base,"u1",events,{...config.limits,maxEvents:1}));
  await reject("auction limit",()=>d.applyMultiAuctionRealtimeEvents(base,"u1",[],{...config.limits,maxAuctions:1}));
  await reject("blank auth user",()=>d.applyMultiAuctionRealtimeEvents(base," ",[],config.limits));
  const closed=d.applyMultiAuctionRealtimeEvents(base,"u1",[{eventId:"close",userId:"u1",auctionId:"a1",sequence:5,occurredAt:"2026-09-27T12:04:00Z",kind:"closed",currentBidCents:10000}],config.limits);
  if(closed.states.find(x=>x.auctionId==="a1")?.actionState!=="ended") fail("closed state did not become ended");
  console.log("MULTI_AUCTION_REALTIME_33_16_SELF_TEST PASS negative_cases=6 interleaved=true gap_isolated=true");
}else{
  console.log("MULTI_AUCTION_REALTIME_33_16 PASS auctions=2 interleaved=true duplicate_idempotent=true gap_isolated=true");
}
