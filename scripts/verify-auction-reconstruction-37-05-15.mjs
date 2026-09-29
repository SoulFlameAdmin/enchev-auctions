import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-auction-reconstruction-37-05-15.json";
const RECON_PATH="packages/domain/src/auction-reconstruction.ts";
const TRUST_PATH="packages/domain/src/auction-trust-record.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const DOC_PATH="docs/37_05_15_AUCTION_RECONSTRUCTION.md";

function fail(message){throw new Error("AUCTION_RECONSTRUCTION_37_05_15 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ", endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker), end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="37");
  if(!phase) fail("phase 37 missing");
  return phase[2].slice(4,15).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"37."+String(index+5).padStart(2,"0"),name,kind:kindRaw==="security"?"security":kindRaw==="test"?"test":"feature"};
  });
}

async function loadModules(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-auction-reconstruction-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const result=spawnSync(process.execPath,[tsc,RECON_PATH,TRUST_PATH,
    "--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler",
    "--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(result.status!==0) fail("domain TypeScript compile failed: "+(result.stderr||result.stdout||"").trim());
  const recon=await import(pathToFileURL(path.join(tmp,"auction-reconstruction.js")).href+"?v="+Date.now());
  const trust=await import(pathToFileURL(path.join(tmp,"auction-trust-record.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return {recon,trust};
}

const config=readJson(CONFIG_PATH);
const expected=frozenTasks();
if(expected.length!==11) fail("expected eleven frozen tasks 37.05-37.15");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected)) fail("frozen task identity drift");
if(!fs.existsSync(DOC_PATH)) fail("documentation missing");
if(!fs.readFileSync(INDEX_PATH,"utf8").includes('export * from "./auction-reconstruction";')) fail("domain export missing");

const {recon:d,trust}=await loadModules();

const auctionId="auc-37";
const vehicleId="veh-37";
const closedAt="2026-09-28T18:00:20.000Z";
const generatedAt="2026-09-28T18:10:00.000Z";

const rulesSnapshot=trust.visibleAuctionRulesSnapshotAfterClose({
  snapshotId:"rules-snap-1",auctionId,rulesVersion:"rules-v7",capturedAt:"2026-09-28T17:00:00.000Z",
  sourceRef:"auction_rules:rules-v7",rules:{minIncrementCents:10000,lateExtensionSeconds:10}
},"sold",closedAt);
if(!rulesSnapshot)fail("37.02 integration rules snapshot missing");

const vehicleSnapshot=trust.visibleVehicleSnapshotAfterClose({
  snapshotId:"vehicle-snap-1",auctionId,vehicleId,sourceRevision:"listing-r9",
  sourceRef:"vehicle_snapshot:listing-r9",capturedAt:"2026-09-28T17:30:00.000Z",
  vehicle:{make:"Example",model:"Trust",vin:"VIN-37",mileageKm:42000}
},"sold",closedAt);
if(!vehicleSnapshot)fail("37.03 integration vehicle snapshot missing");

const acceptedBids=trust.buildAcceptedBidChronology(auctionId,vehicleId,[
  {bidId:"bid-1",auctionId,vehicleId,bidderRef:"buyer-a",outcome:"accepted",occurredAt:"2026-09-28T18:00:01.000Z",sequence:1,amountCents:1200000,currency:"EUR",sourceRef:"bid_events:1",correlationId:"corr-bid-1"},
  {bidId:"bid-2",auctionId,vehicleId,bidderRef:"buyer-b",outcome:"accepted",occurredAt:"2026-09-28T18:00:04.000Z",sequence:2,amountCents:1250000,currency:"EUR",sourceRef:"bid_events:2",correlationId:"corr-bid-2"},
]);
if(acceptedBids.length!==2)fail("37.04 integration accepted bids missing");

const extensions=d.buildExtensionEventChronology(auctionId,vehicleId,[{
  eventId:"ext-1",auctionId,vehicleId,triggerBidId:"bid-2",occurredAt:"2026-09-28T18:00:04.100Z",sequence:1,
  previousEndsAt:"2026-09-28T18:00:05.000Z",nextEndsAt:"2026-09-28T18:00:15.000Z",
  sourceRef:"auction_extensions:1",correlationId:"corr-bid-2"
}]);
if(extensions.length!==1||extensions[0].ordinal!==1||extensions[0].nextEndsAt!=="2026-09-28T18:00:15.000Z")fail("37.05 extension chronology drift");

const finalResults=d.buildFinalResultChronology(auctionId,vehicleId,[
  {eventId:"result-pending",auctionId,vehicleId,state:"seller-approval-pending",winningBidId:"bid-2",amountCents:1250000,currency:"EUR",occurredAt:"2026-09-28T18:00:16.000Z",sequence:1,sourceRef:"auction_results:pending",correlationId:"corr-result"},
  {eventId:"result-sold",auctionId,vehicleId,state:"sold",winningBidId:"bid-2",amountCents:1250000,currency:"EUR",occurredAt:"2026-09-28T18:00:18.000Z",sequence:2,sourceRef:"auction_results:sold",correlationId:"corr-result"}
]);
if(finalResults.length!==2||finalResults[1].state!=="sold")fail("37.06 final result chronology drift");

const sellerChanges=d.buildSellerListingChangeChronology(auctionId,vehicleId,"listing-37",[
  {changeId:"chg-1",auctionId,vehicleId,listingId:"listing-37",actorRef:"seller-1",field:"description",before:"old",after:"updated",critical:false,revision:1,changedAt:"2026-09-28T16:00:00.000Z",sourceRef:"listing_changes:1",correlationId:null},
  {changeId:"chg-2",auctionId,vehicleId,listingId:"listing-37",actorRef:"seller-1",field:"vin",before:"VIN-OLD",after:"VIN-37",critical:true,revision:2,changedAt:"2026-09-28T16:05:00.000Z",sourceRef:"listing_changes:2",correlationId:"corr-listing-review"}
]);
if(sellerChanges.map(x=>x.revision).join(",")!=="1,2"||sellerChanges[1].before!=="VIN-OLD")fail("37.07 seller chronology drift");

const inspectionVersions=d.buildInspectionVersionChronology(auctionId,vehicleId,"inspection-37",[
  {evidenceId:"inspection-v1",auctionId,vehicleId,reportId:"inspection-37",version:1,status:"submitted",capturedAt:"2026-09-28T15:00:00.000Z",inspectorRef:"inspector-1",payloadSha256:"a".repeat(64),sourceRef:"inspection_reports:v1",correlationId:null},
  {evidenceId:"inspection-v2",auctionId,vehicleId,reportId:"inspection-37",version:2,status:"approved",capturedAt:"2026-09-28T15:10:00.000Z",inspectorRef:"inspector-1",payloadSha256:"b".repeat(64),sourceRef:"inspection_reports:v2",correlationId:"corr-inspection-approval"}
]);
if(inspectionVersions.length!==2||inspectionVersions[1].status!=="approved")fail("37.08 inspection chronology drift");

const qaHistory=d.preserveQaHistory(auctionId,vehicleId,[
  {questionId:"q1",auctionId,vehicleId,askerRef:"buyer-a",body:"Service history?",createdAt:"2026-09-28T14:00:00.000Z",status:"published",sourceRef:"questions:q1",correlationId:null},
  {questionId:"q2",auctionId,vehicleId,askerRef:"buyer-b",body:"Previous repair?",createdAt:"2026-09-28T14:01:00.000Z",status:"hidden",sourceRef:"questions:q2",correlationId:"corr-moderation-q2"}
],[
  {replyId:"r1",questionId:"q1",auctionId,vehicleId,sellerRef:"seller-1",body:"Documented.",createdAt:"2026-09-28T14:02:00.000Z",verifiedSeller:true,sourceRef:"replies:r1",correlationId:null},
  {replyId:"r2",questionId:"q2",auctionId,vehicleId,sellerRef:"seller-1",body:"Repair disclosed.",createdAt:"2026-09-28T14:03:00.000Z",verifiedSeller:true,sourceRef:"replies:r2",correlationId:"corr-moderation-q2"}
]);
if(qaHistory.questions.length!==2||qaHistory.replies.length!==2||qaHistory.questions[1].status!=="hidden")fail("37.09 Q&A history drift");

const adminActions=d.buildAdminExceptionalActionChronology(auctionId,vehicleId,[{
  actionId:"admin-1",auctionId,vehicleId,actorRef:"admin-ops",action:"manual-review-confirmed",reason:"Resolve flagged listing correction before close",
  occurredAt:"2026-09-28T17:45:00.000Z",sequence:1,before:{reviewed:false},after:{reviewed:true},
  sourceRef:"admin_actions:1",correlationId:"corr-admin-1"
}]);
if(adminActions.length!==1||adminActions[0].reason.length<1)fail("37.10 admin chronology drift");

const complete=await d.completeAuctionReconstruction({
  auctionId,vehicleId,generatedAt,rulesSnapshot,vehicleSnapshot,acceptedBids,extensions,finalResults,
  sellerChanges,inspectionVersions,qaHistory,adminActions
});
if(complete.auditExport.entryCount!==12)fail("37.11 audit entry count drift: "+complete.auditExport.entryCount);
if(!Object.isFrozen(complete.auditExport)||!Object.isFrozen(complete.auditExport.entries)||!/^[a-f0-9]{64}$/.test(complete.auditExport.sha256))fail("37.11 immutable audit export drift");

const repeat=await d.createImmutableAuditExport(auctionId,vehicleId,generatedAt,complete.auditExport.entries);
if(repeat.sha256!==complete.auditExport.sha256||repeat.canonicalJson!==complete.auditExport.canonicalJson)fail("37.11 deterministic audit export drift");

const bundle=complete.disputeBundle;
if(bundle.rulesSnapshot.snapshotId!=="rules-snap-1"||bundle.vehicleSnapshot.snapshotId!=="vehicle-snap-1"||bundle.acceptedBids.length!==2||bundle.extensions.length!==1||bundle.finalResults.at(-1)?.state!=="sold")fail("37.12 dispute bundle content drift");
if(!/^[a-f0-9]{64}$/.test(bundle.bundleSha256)||bundle.auditExportSha256!==complete.auditExport.sha256)fail("37.12 dispute bundle digest drift");

const criticalEntries=complete.auditExport.entries.filter(x=>["accepted-bid","extension","final-result","admin-exception"].includes(x.kind));
if(criticalEntries.some(x=>!x.correlationId))fail("37.13 critical correlation ID missing");
if(bundle.correlations.length<4||!bundle.correlations.some(x=>x.correlationId==="corr-bid-2"&&x.eventIds.includes("bid-2")&&x.eventIds.includes("ext-1")))fail("37.13 correlation index drift");

if(bundle.criticalHashChain.length!==6)fail("37.14 critical hash-chain length drift");
for(let i=0;i<bundle.criticalHashChain.length;i++){
  const link=bundle.criticalHashChain[i];
  if(!/^[a-f0-9]{64}$/.test(link.eventHash)||!/^[a-f0-9]{64}$/.test(link.chainHash))fail("37.14 hash format drift");
  if(i===0&&link.previousHash!=="0".repeat(64))fail("37.14 genesis hash drift");
  if(i>0&&link.previousHash!==bundle.criticalHashChain[i-1].chainHash)fail("37.14 chain linkage drift");
}

const tampered=complete.auditExport.entries.map(x=>x.eventId==="bid-2"?{...x,payload:{amountCents:9999999,currency:"EUR",bidderRef:"buyer-b"}}:x);
const tamperedChain=await d.buildCriticalEventHashChain(tampered);
if(tamperedChain.at(-1)?.chainHash===bundle.criticalHashChain.at(-1)?.chainHash)fail("37.14 tamper sensitivity drift");

if(complete.auctionId!==auctionId||complete.vehicleId!==vehicleId||!Object.isFrozen(complete)||!Object.isFrozen(bundle))fail("37.15 complete reconstruction drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("extension without growth",()=>d.buildExtensionEventChronology(auctionId,vehicleId,[{...extensions[0],eventId:"bad-ext",previousEndsAt:"2026-09-28T18:00:15.000Z",nextEndsAt:"2026-09-28T18:00:15.000Z"}]));
  await reject("result after terminal",()=>d.buildFinalResultChronology(auctionId,vehicleId,[finalResults[1],{...finalResults[0],eventId:"later",sequence:3,occurredAt:"2026-09-28T18:00:19.000Z"}]));
  await reject("seller revision gap",()=>d.buildSellerListingChangeChronology(auctionId,vehicleId,"listing-37",[{...sellerChanges[0],revision:2}]));
  await reject("inspection version gap",()=>d.buildInspectionVersionChronology(auctionId,vehicleId,"inspection-37",[{...inspectionVersions[0],version:2}]));
  await reject("orphan Q&A reply",()=>d.preserveQaHistory(auctionId,vehicleId,qaHistory.questions,[{...qaHistory.replies[0],questionId:"missing"}]));
  await reject("cross-scope admin",()=>d.buildAdminExceptionalActionChronology(auctionId,vehicleId,[{...adminActions[0],vehicleId:"other"}]));
  await reject("duplicate audit event",()=>d.createImmutableAuditExport(auctionId,vehicleId,generatedAt,[complete.auditExport.entries[0],complete.auditExport.entries[0]]));
  await reject("critical correlation missing",()=>d.buildCorrelationIndex(complete.auditExport.entries.map(x=>x.kind==="accepted-bid"?{...x,correlationId:null}:x)));
  await reject("hash correlation missing",()=>d.buildCriticalEventHashChain(complete.auditExport.entries.map(x=>x.kind==="extension"?{...x,correlationId:null}:x)));
  await reject("bundle scope mismatch",()=>d.createDisputeEvidenceBundle({...bundle,vehicleId:"other",auditExport:complete.auditExport}));
  const pendingOnly=d.buildFinalResultChronology(auctionId,vehicleId,[finalResults[0]]);
  await reject("complete without terminal result",()=>d.completeAuctionReconstruction({...complete.disputeBundle,generatedAt,finalResults:pendingOnly}));
  await reject("invalid inspection fingerprint",()=>d.buildInspectionVersionChronology(auctionId,vehicleId,"inspection-37",[{...inspectionVersions[0],payloadSha256:"not-a-sha"}]));
  console.log("AUCTION_RECONSTRUCTION_37_05_15_SELF_TEST PASS tasks=11 negative_cases=12 audit_entries=12 critical_chain=6 deterministic_sha256=true complete=true");
}else{
  console.log("AUCTION_RECONSTRUCTION_37_05_15 PASS tasks=11 audit_entries=12 critical_chain=6 complete=true");
}
