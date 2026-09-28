import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DOMAIN_PATH="packages/domain/src/auction-trust-record.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_02_AUCTION_RULES_SNAPSHOT_VISIBLE_AFTER_CLOSE.md";

function fail(message){throw new Error("AUCTION_RULES_SNAPSHOT_37_02 FAIL: "+message);}

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
  const [name]=String(phase[2][1]).split("|");
  return {id:"37.02",name};
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-rules-snapshot-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const task=frozenTask();
if(task.name!=="Auction rules snapshot visible after close") fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("task documentation missing");

const d=await loadDomain();
const snapshot={
  snapshotId:"rules-snap-1",
  auctionId:"auc-1",
  rulesVersion:"rules-v7",
  capturedAt:"2026-09-28T12:00:00.000Z",
  sourceRef:"auction_rule_snapshots:rules-snap-1",
  rules:{
    mode:"reserve",
    currency:"EUR",
    extension:{windowSeconds:30,extendSeconds:30},
    increments:[100,250,500],
    sellerApproval:false
  }
};

for(const state of ["draft","published","live"]){
  const visible=d.visibleAuctionRulesSnapshotAfterClose(snapshot,state,null);
  if(visible!==null) fail("pre-close rules snapshot leaked for "+state);
}

for(const state of ["closed","sold","unsold","void","seller-approval-pending"]){
  const visible=d.visibleAuctionRulesSnapshotAfterClose(snapshot,state,"2026-09-28T12:30:00.000Z");
  if(!visible||!visible.visibleAfterClose) fail("post-close snapshot not visible for "+state);
  if(visible.rulesVersion!=="rules-v7"||visible.sourceRef!=="auction_rule_snapshots:rules-snap-1") fail("provenance drift");
  if(!Object.isFrozen(visible)||!Object.isFrozen(visible.rules)||!Object.isFrozen(visible.rules.extension)||!Object.isFrozen(visible.rules.increments)) fail("snapshot must be deeply read-only");
}

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("closed without closedAt",()=>d.visibleAuctionRulesSnapshotAfterClose(snapshot,"closed",null));
  await reject("pre-close with closedAt",()=>d.visibleAuctionRulesSnapshotAfterClose(snapshot,"live","2026-09-28T12:30:00.000Z"));
  await reject("captured after close",()=>d.visibleAuctionRulesSnapshotAfterClose({...snapshot,capturedAt:"2026-09-28T13:00:00.000Z"},"closed","2026-09-28T12:30:00.000Z"));
  await reject("missing version",()=>d.visibleAuctionRulesSnapshotAfterClose({...snapshot,rulesVersion:""},"closed","2026-09-28T12:30:00.000Z"));
  await reject("unsafe rule payload",()=>d.visibleAuctionRulesSnapshotAfterClose({...snapshot,rules:{bad:undefined}},"closed","2026-09-28T12:30:00.000Z"));
  console.log("AUCTION_RULES_SNAPSHOT_37_02_SELF_TEST PASS preclose_hidden=3 postclose_visible=5 negative_cases=5 immutable=true provenance=true");
}else{
  console.log("AUCTION_RULES_SNAPSHOT_37_02 PASS preclose_hidden=3 postclose_visible=5 immutable=true provenance=true");
}
