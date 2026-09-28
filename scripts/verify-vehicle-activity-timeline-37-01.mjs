import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DOMAIN_PATH="packages/domain/src/auction-trust-record.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_01_VEHICLE_ACTIVITY_TIMELINE.md";

function fail(message){throw new Error("VEHICLE_ACTIVITY_TIMELINE_37_01 FAIL: "+message);}

function frozenTask(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="37");
  if(!phase) fail("phase 37 missing");
  const [name,statusRaw,kindRaw]=String(phase[2][0]).split("|");
  void statusRaw;
  return {id:"37.01",name,kind:kindRaw==="security"?"security":kindRaw==="test"?"test":"feature"};
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-trust-record-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const task=frozenTask();
if(task.name!=="Vehicle activity timeline") fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("task documentation missing");

const indexSource=fs.readFileSync(INDEX_PATH,"utf8");
if(!indexSource.includes('export * from "./auction-trust-record";')) fail("domain export missing");

const d=await loadDomain();
const events=[
  {eventId:"evt-3",vehicleId:"veh-1",auctionId:"auc-1",kind:"auction-started",occurredAt:"2026-09-28T12:00:02.000Z",sequence:3,visibility:"public",sourceRef:"auction_events:evt-3",correlationId:"corr-2",summary:"Auction started"},
  {eventId:"evt-1",vehicleId:"veh-1",auctionId:null,kind:"listing-created",occurredAt:"2026-09-28T12:00:00.000Z",sequence:1,visibility:"public",sourceRef:"listing_events:evt-1",correlationId:"corr-1",summary:"Vehicle listing created"},
  {eventId:"evt-2b",vehicleId:"veh-1",auctionId:"auc-1",kind:"auction-published",occurredAt:"2026-09-28T12:00:01.000Z",sequence:2,visibility:"participant",sourceRef:"auction_events:evt-2b",correlationId:"corr-2",summary:"Auction published"},
  {eventId:"evt-2a",vehicleId:"veh-1",auctionId:null,kind:"listing-updated",occurredAt:"2026-09-28T12:00:01.000Z",sequence:2,visibility:"internal",sourceRef:"listing_events:evt-2a",correlationId:"corr-1",summary:"Seller corrected listing metadata"},
];

const admin=d.buildVehicleActivityTimeline("veh-1",events,"admin");
if(admin.length!==4) fail("admin timeline length drift");
if(admin.map(x=>x.eventId).join(",")!=="evt-1,evt-2a,evt-2b,evt-3") fail("deterministic chronology drift");
if(admin.map(x=>x.ordinal).join(",")!=="1,2,3,4") fail("ordinal drift");
if(!Object.isFrozen(admin)||admin.some(x=>!Object.isFrozen(x))) fail("timeline must be read-only");

const participant=d.buildVehicleActivityTimeline("veh-1",events,"participant");
if(participant.map(x=>x.eventId).join(",")!=="evt-1,evt-2b,evt-3") fail("participant visibility drift");

const publicView=d.buildVehicleActivityTimeline("veh-1",events,"public");
if(publicView.map(x=>x.eventId).join(",")!=="evt-1,evt-3") fail("public visibility drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("cross vehicle",()=>d.buildVehicleActivityTimeline("veh-1",[ {...events[0],vehicleId:"veh-2"} ],"admin"));
  await reject("duplicate event",()=>d.buildVehicleActivityTimeline("veh-1",[events[0],events[0]],"admin"));
  await reject("non canonical UTC",()=>d.buildVehicleActivityTimeline("veh-1",[ {...events[0],occurredAt:"2026-09-28T12:00:02Z"} ],"admin"));
  await reject("negative sequence",()=>d.buildVehicleActivityTimeline("veh-1",[ {...events[0],sequence:-1} ],"admin"));
  await reject("missing source",()=>d.buildVehicleActivityTimeline("veh-1",[ {...events[0],sourceRef:""} ],"admin"));
  console.log("VEHICLE_ACTIVITY_TIMELINE_37_01_SELF_TEST PASS negative_cases=5 deterministic_order=true visibility=true immutable=true");
}else{
  console.log("VEHICLE_ACTIVITY_TIMELINE_37_01 PASS deterministic_order=true visibility=true immutable=true");
}
