import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const DOMAIN_PATH="packages/domain/src/auction-trust-record.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_03_VEHICLE_SNAPSHOT_VISIBLE_AFTER_CLOSE.md";
function fail(message){throw new Error("VEHICLE_SNAPSHOT_37_03 FAIL: "+message);}
function frozenTask(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ", endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker), end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="37"); if(!phase) fail("phase 37 missing");
  return String(phase[2][2]).split("|")[0];
}
async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-vehicle-snapshot-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0); return mod;
}
if(frozenTask()!=="Vehicle snapshot visible after close") fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("task documentation missing");
const d=await loadDomain();
const original={snapshotId:"veh-snap-1",auctionId:"auc-1",vehicleId:"veh-1",sourceRevision:"vehicle-rev-42",sourceRef:"vehicle_snapshots:veh-snap-1",capturedAt:"2026-09-28T17:59:59.000Z",vehicle:{vin:"WDB1631361A000001",make:"Mercedes-Benz",model:"ML 230",condition:{grade:"B",damage:["rear-bumper"]},media:["img-1","img-2"]}};
for(const state of ["draft","published","live"]) if(d.visibleVehicleSnapshotAfterClose(original,state,null)!==null) fail("pre-close snapshot leaked for "+state);
for(const state of ["closed","sold","unsold","void","seller-approval-pending"]){
 const v=d.visibleVehicleSnapshotAfterClose(original,state,"2026-09-28T18:30:00.000Z");
 if(!v||!v.visibleAfterClose) fail("post-close snapshot missing for "+state);
 if(v.sourceRevision!=="vehicle-rev-42"||v.sourceRef!=="vehicle_snapshots:veh-snap-1") fail("provenance drift");
 if(!Object.isFrozen(v)||!Object.isFrozen(v.vehicle)||!Object.isFrozen(v.vehicle.condition)||!Object.isFrozen(v.vehicle.media)) fail("snapshot must be deeply immutable");
}
const visible=d.visibleVehicleSnapshotAfterClose(original,"closed","2026-09-28T18:30:00.000Z");
original.vehicle.model="CHANGED"; original.vehicle.condition.grade="Z"; original.vehicle.media.push("img-3");
if(visible.vehicle.model!=="ML 230"||visible.vehicle.condition.grade!=="B"||visible.vehicle.media.length!==2) fail("source mutation changed historical snapshot");
if(process.argv.includes("--self-test")){
 const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
 await reject("closed without closedAt",()=>d.visibleVehicleSnapshotAfterClose(original,"closed",null));
 await reject("preclose with closedAt",()=>d.visibleVehicleSnapshotAfterClose(original,"live","2026-09-28T18:30:00.000Z"));
 await reject("captured after close",()=>d.visibleVehicleSnapshotAfterClose({...original,capturedAt:"2026-09-28T19:00:00.000Z"},"closed","2026-09-28T18:30:00.000Z"));
 await reject("missing revision",()=>d.visibleVehicleSnapshotAfterClose({...original,sourceRevision:""},"closed","2026-09-28T18:30:00.000Z"));
 await reject("unsafe payload",()=>d.visibleVehicleSnapshotAfterClose({...original,vehicle:{bad:undefined}},"closed","2026-09-28T18:30:00.000Z"));
 console.log("VEHICLE_SNAPSHOT_37_03_SELF_TEST PASS preclose_hidden=3 postclose_visible=5 source_mutation_isolated=true negative_cases=5 immutable=true provenance=true");
}else console.log("VEHICLE_SNAPSHOT_37_03 PASS preclose_hidden=3 postclose_visible=5 source_mutation_isolated=true immutable=true provenance=true");
