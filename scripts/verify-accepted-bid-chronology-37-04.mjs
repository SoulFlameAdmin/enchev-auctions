import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DOMAIN_PATH="packages/domain/src/auction-trust-record.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_04_ACCEPTED_BID_CHRONOLOGY.md";

function fail(message){throw new Error("ACCEPTED_BID_CHRONOLOGY_37_04 FAIL: "+message);}

function frozenTask(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ", endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker), end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="37"); if(!phase) fail("phase 37 missing");
  return String(phase[2][3]).split("|")[0];
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-accepted-bids-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

if(frozenTask()!=="Accepted bid chronology") fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("task documentation missing");

const d=await loadDomain();
const bids=[
  {bidId:"bid-4",auctionId:"auc-1",vehicleId:"veh-1",bidderRef:"buyer-alias-c",outcome:"accepted",occurredAt:"2026-09-28T18:00:04.000Z",sequence:4,amountCents:1250000,currency:"EUR",sourceRef:"bid_events:bid-4",correlationId:"corr-bid-4"},
  {bidId:"bid-1",auctionId:"auc-1",vehicleId:"veh-1",bidderRef:"buyer-alias-a",outcome:"accepted",occurredAt:"2026-09-28T18:00:01.000Z",sequence:1,amountCents:1200000,currency:"EUR",sourceRef:"bid_events:bid-1",correlationId:"corr-bid-1"},
  {bidId:"bid-2",auctionId:"auc-1",vehicleId:"veh-1",bidderRef:"buyer-alias-b",outcome:"rejected",occurredAt:"2026-09-28T18:00:02.000Z",sequence:2,amountCents:1205000,currency:"EUR",sourceRef:"bid_events:bid-2",correlationId:"corr-bid-2"},
  {bidId:"bid-3",auctionId:"auc-1",vehicleId:"veh-1",bidderRef:"buyer-alias-b",outcome:"accepted",occurredAt:"2026-09-28T18:00:03.000Z",sequence:3,amountCents:1225000,currency:"EUR",sourceRef:"bid_events:bid-3",correlationId:"corr-bid-3"},
];

const chronology=d.buildAcceptedBidChronology("auc-1","veh-1",bids);
if(chronology.length!==3) fail("accepted-only filtering drift");
if(chronology.map(x=>x.bidId).join(",")!=="bid-1,bid-3,bid-4") fail("authoritative sequence ordering drift");
if(chronology.map(x=>x.ordinal).join(",")!=="1,2,3") fail("ordinal drift");
if(chronology.some(x=>x.outcome!=="accepted")) fail("rejected bid leaked into chronology");
if(chronology[2].sourceRef!=="bid_events:bid-4"||chronology[2].correlationId!=="corr-bid-4") fail("provenance drift");
if(!Object.isFrozen(chronology)||chronology.some(x=>!Object.isFrozen(x))) fail("chronology must be immutable");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("cross auction",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[{...bids[0],auctionId:"auc-2"}]));
  await reject("cross vehicle",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[{...bids[0],vehicleId:"veh-2"}]));
  await reject("duplicate bid id",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[bids[0],{...bids[1],bidId:bids[0].bidId}]));
  await reject("duplicate sequence",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[bids[0],{...bids[1],sequence:bids[0].sequence}]));
  await reject("non canonical UTC",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[{...bids[0],occurredAt:"2026-09-28T18:00:04Z"}]));
  await reject("accepted amount regression",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[
    {...bids[0],bidId:"x1",sequence:1,amountCents:2000,occurredAt:"2026-09-28T18:00:01.000Z"},
    {...bids[1],bidId:"x2",sequence:2,amountCents:1900,occurredAt:"2026-09-28T18:00:02.000Z"}
  ]));
  await reject("accepted time regression",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[
    {...bids[0],bidId:"y1",sequence:1,amountCents:1000,occurredAt:"2026-09-28T18:00:03.000Z"},
    {...bids[1],bidId:"y2",sequence:2,amountCents:2000,occurredAt:"2026-09-28T18:00:02.000Z"}
  ]));
  await reject("currency drift",()=>d.buildAcceptedBidChronology("auc-1","veh-1",[
    {...bids[0],bidId:"z1",sequence:1,amountCents:1000,currency:"EUR",occurredAt:"2026-09-28T18:00:01.000Z"},
    {...bids[1],bidId:"z2",sequence:2,amountCents:2000,currency:"USD",occurredAt:"2026-09-28T18:00:02.000Z"}
  ]));
  console.log("ACCEPTED_BID_CHRONOLOGY_37_04_SELF_TEST PASS accepted=3 rejected_filtered=1 negative_cases=8 immutable=true provenance=true");
}else console.log("ACCEPTED_BID_CHRONOLOGY_37_04 PASS accepted=3 rejected_filtered=1 immutable=true provenance=true");
