import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DOMAIN_PATH="packages/domain/src/auction-trust-record.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_03_IMMUTABLE_AUCTION_START_VEHICLE_SNAPSHOT.md";

function fail(message){throw new Error("AUCTION_START_VEHICLE_SNAPSHOT_37_03 FAIL: "+message);}

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
  const [name]=String(phase[2][2]).split("|");
  return {id:"37.03",name};
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-auction-start-vehicle-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const task=frozenTask();
if(task.name!=="Immutable auction-start vehicle snapshot") fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("task documentation missing");

const d=await loadDomain();
const original={
  snapshotId:"veh-snap-1",
  auctionId:"auc-1",
  vehicleId:"veh-1",
  sourceRevision:"vehicle-rev-42",
  sourceRef:"vehicle_snapshots:veh-snap-1",
  auctionStartedAt:"2026-09-28T18:00:00.000Z",
  capturedAt:"2026-09-28T18:00:00.000Z",
  vehicle:{
    vin:"WDB1631361A000001",
    make:"Mercedes-Benz",
    model:"ML 230",
    odometerKm:210000,
    condition:{grade:"B",damage:["rear-bumper"]},
    media:["img-1","img-2"]
  }
};

const snapshot=d.createImmutableAuctionStartVehicleSnapshot(original);
if(snapshot.snapshotId!=="veh-snap-1"||snapshot.sourceRevision!=="vehicle-rev-42") fail("provenance drift");
if(!Object.isFrozen(snapshot)||!Object.isFrozen(snapshot.vehicle)||!Object.isFrozen(snapshot.vehicle.condition)||!Object.isFrozen(snapshot.vehicle.condition.damage)||!Object.isFrozen(snapshot.vehicle.media)) fail("snapshot must be deeply immutable");

original.vehicle.model="CHANGED AFTER START";
original.vehicle.condition.grade="Z";
original.vehicle.media.push("img-3");
if(snapshot.vehicle.model!=="ML 230") fail("post-start source mutation changed snapshot model");
if(snapshot.vehicle.condition.grade!=="B") fail("post-start nested source mutation changed snapshot condition");
if(snapshot.vehicle.media.length!==2) fail("post-start array mutation changed snapshot media");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("capture after start",()=>d.createImmutableAuctionStartVehicleSnapshot({...original,capturedAt:"2026-09-28T18:00:01.000Z"}));
  await reject("capture before start",()=>d.createImmutableAuctionStartVehicleSnapshot({...original,capturedAt:"2026-09-28T17:59:59.000Z"}));
  await reject("missing vehicle id",()=>d.createImmutableAuctionStartVehicleSnapshot({...original,vehicleId:""}));
  await reject("missing source revision",()=>d.createImmutableAuctionStartVehicleSnapshot({...original,sourceRevision:""}));
  await reject("unsafe payload",()=>d.createImmutableAuctionStartVehicleSnapshot({...original,vehicle:{bad:undefined}}));
  console.log("AUCTION_START_VEHICLE_SNAPSHOT_37_03_SELF_TEST PASS exact_start_capture=true source_mutation_isolated=true negative_cases=5 immutable=true provenance=true");
}else{
  console.log("AUCTION_START_VEHICLE_SNAPSHOT_37_03 PASS exact_start_capture=true source_mutation_isolated=true immutable=true provenance=true");
}
