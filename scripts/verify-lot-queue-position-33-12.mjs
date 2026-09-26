import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-lot-queue-position-33-12.json";
const DOMAIN_PATH="packages/domain/src/lot-queue-position.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error(`LOT_QUEUE_POSITION_33_12 FAIL: ${message}`);}
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
  const expected=[["33.12","Lot queue position / lots-away indicator"]];
  if(JSON.stringify(config.tasks?.map(x=>[x.id,x.name]))!==JSON.stringify(expected)) fail("task contract drift");
  if(frozenTaskMap().get("33.12")!=="Lot queue position / lots-away indicator") fail("frozen task identity drift: 33.12");

  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.persistence?.newBusinessTableRequired!==false) fail("33.12 must not invent persistence");
  if(config.authority?.lotQueue!=="postgresql"||config.authority?.realtimeTransportAuthoritative!==false) fail("lot queue authority drift");
  for(const key of ["projectionMayChangeAuctionState","projectionMayAcceptBid","projectionMayChooseWinner"]) if(config.authority?.[key]!==false) fail(`authority guardrail drift: ${key}`);

  const s=config.semantics;
  for(const key of ["singleAuctionOnly","deterministicQueueOrdering","queueOrderMustBeUnique","liveLotPreferredAsCurrent","fallbackToFirstUpcomingWhenNoLiveLot","lotsAwayCountsActionableLotsAhead","closedTargetMarkedPassed","sequenceGapRequiresAuthoritativeResync"]) if(s?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);
  if(config.limits?.maxQueueItems!==1000) fail("queue limit drift");
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-lot-queue-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const mod=await import(`${pathToFileURL(path.join(tmp,"lot-queue-position.js")).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
verifyConfig(config);
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./lot-queue-position";')) fail("domain export missing");

const d=await loadDomain();
const rows=[
  {auctionId:"a1",lotId:"l1",queueOrder:10,state:"sold"},
  {auctionId:"a1",lotId:"l2",queueOrder:20,state:"live"},
  {auctionId:"a1",lotId:"l3",queueOrder:30,state:"cancelled"},
  {auctionId:"a1",lotId:"l4",queueOrder:40,state:"upcoming"},
  {auctionId:"a1",lotId:"l5",queueOrder:50,state:"upcoming"},
  {auctionId:"other",lotId:"x1",queueOrder:1,state:"live"}
];
const current=d.lotQueuePositionIndicator(rows,"a1","l2",config.limits.maxQueueItems);
if(current.relation!=="current"||current.lotsAway!==0||current.currentLotId!=="l2"||current.queuePosition!==20) fail("current lot projection drift");
const upcoming=d.lotQueuePositionIndicator(rows,"a1","l5",config.limits.maxQueueItems);
if(upcoming.relation!=="upcoming"||upcoming.lotsAway!==2||upcoming.currentQueuePosition!==20) fail("lots-away projection drift");
const passed=d.lotQueuePositionIndicator(rows,"a1","l1",config.limits.maxQueueItems);
if(passed.relation!=="passed"||passed.lotsAway!==0) fail("passed lot projection drift");
const fallback=d.lotQueuePositionIndicator([
  {auctionId:"a2",lotId:"f1",queueOrder:2,state:"sold"},
  {auctionId:"a2",lotId:"f2",queueOrder:5,state:"upcoming"},
  {auctionId:"a2",lotId:"f3",queueOrder:8,state:"upcoming"}
],"a2","f3");
if(fallback.currentLotId!=="f2"||fallback.lotsAway!==1) fail("upcoming fallback drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank auction",()=>d.lotQueuePositionIndicator([]," ","l"));
  await reject("blank lot",()=>d.lotQueuePositionIndicator([],"a"," "));
  await reject("invalid limit",()=>d.lotQueuePositionIndicator([],"a","l",0));
  await reject("missing target",()=>d.lotQueuePositionIndicator([],"a","l"));
  await reject("duplicate lot",()=>d.lotQueuePositionIndicator([{auctionId:"a",lotId:"l",queueOrder:1,state:"live"},{auctionId:"a",lotId:"l",queueOrder:2,state:"upcoming"}],"a","l"));
  await reject("duplicate order",()=>d.lotQueuePositionIndicator([{auctionId:"a",lotId:"l1",queueOrder:1,state:"live"},{auctionId:"a",lotId:"l2",queueOrder:1,state:"upcoming"}],"a","l1"));
  await reject("invalid order",()=>d.lotQueuePositionIndicator([{auctionId:"a",lotId:"l",queueOrder:0,state:"live"}],"a","l"));
  await reject("multiple live lots",()=>d.lotQueuePositionIndicator([{auctionId:"a",lotId:"l1",queueOrder:1,state:"live"},{auctionId:"a",lotId:"l2",queueOrder:2,state:"live"}],"a","l1"));
  await reject("queue over bound",()=>d.lotQueuePositionIndicator(Array.from({length:2},(_,i)=>({auctionId:"a",lotId:`l${i}`,queueOrder:i+1,state:"upcoming"})),"a","l0",1));
  const mutated=structuredClone(config);mutated.tasks[0].name="Mutable queue";let rejected=false;try{verifyConfig(mutated);}catch{rejected=true;}if(!rejected)fail("frozen identity mutation accepted");
  console.log("LOT_QUEUE_POSITION_33_12_SELF_TEST PASS negative_cases=10");
}else{
  console.log(`LOT_QUEUE_POSITION_33_12 PASS target=${upcoming.lotId} lots_away=${upcoming.lotsAway} authority=postgresql`);
}
