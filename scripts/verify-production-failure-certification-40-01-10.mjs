import fs from "node:fs";
import { createProductionFailureCertificationHarness } from "../test/utils/production-failure-certification.mjs";

const CONFIG_PATH="config/enchev-production-failure-certification-40-01-10.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const HARNESS_PATH="test/utils/production-failure-certification.mjs";

function fail(message){throw new Error("PRODUCTION_FAILURE_CERTIFICATION_40_01_10 FAIL: "+message);}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="40");
  if(!phase)fail("phase 40 missing");
  return phase[2].slice(0,10).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"40."+String(index+1).padStart(2,"0"),name,kind:kindRaw==="test"?"test":"feature"};
  });
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const expected=frozenTasks();
if(expected.length!==10)fail("expected ten tasks");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen task identity drift");
for(const key of ["productionMutationForbidden","realProviderFaultInjectionForbidden","realCustomerDataForbidden"]){
  if(config.execution?.[key]!==true)fail("safety boundary disabled: "+key);
}
for(const key of ["auctionAuthorityNeverMovesToClient","unsafeBidPathFailsClosed","partialFinalizationSuccessForbidden","providerOutageCannotChangeWinner","recoveryRequiresAuthoritativeSequence","deterministicEvidenceOnly"]){
  if(config.invariants?.[key]!==true)fail("invariant disabled: "+key);
}
if(!fs.readFileSync(HARNESS_PATH,"utf8").includes("createProductionFailureCertificationHarness"))fail("harness missing");

const h=createProductionFailureCertificationHarness({auctionId:"auc-40",authoritativeSequence:20,retryBudget:2});
const baselineBids=JSON.stringify(["bid-1","bid-2"]);
const baselineWinner="buyer-2";

const checks=[];

const rt=h.simulateRealtimeProcessCrashDuringActiveAuction();
if(rt.biddingEnabled||!rt.reconnectRequired||!rt.resyncRequired)fail("40.01 realtime crash fail-closed drift");
checks.push("40.01");

const worker=h.simulateWorkerCrashDuringActiveAuction();
if(worker.authoritativeWriteEnabled||!worker.retryable||JSON.stringify(worker.preservedAcceptedBidIds)!==baselineBids)fail("40.02 worker active-auction crash drift");
checks.push("40.02");

const finalization=h.simulateWorkerCrashDuringFinalization();
if(finalization.finalizationEnabled||finalization.authoritativeWriteEnabled||!finalization.notes.includes("terminal-write-not-partially-committed"))fail("40.03 finalization crash drift");
checks.push("40.03");

const redis=h.simulateRedisConnectionLoss();
if(redis.biddingEnabled||redis.readModelAvailable||!redis.resyncRequired)fail("40.04 redis loss drift");
checks.push("40.04");

const db=h.simulateDatabaseConnectionInterruption();
if(db.biddingEnabled||db.finalizationEnabled||db.authoritativeWriteEnabled)fail("40.05 database interruption drift");
checks.push("40.05");

const storage=h.simulateObjectStorageOutage();
if(!storage.providerDegraded||!storage.retryable||storage.winnerId!==baselineWinner||!storage.notes.includes("auction-core-authority-intact"))fail("40.06 object storage outage drift");
checks.push("40.06");

const kyc=h.simulateKycProviderOutage();
if(!kyc.providerDegraded||kyc.winnerId!==baselineWinner||!kyc.notes.includes("new-verification-blocked"))fail("40.07 KYC outage drift");
checks.push("40.07");

const notifications=h.simulateNotificationProviderOutage();
if(!notifications.providerDegraded||!notifications.retryable||notifications.winnerId!==baselineWinner||!notifications.notes.includes("auction-outcome-unaffected"))fail("40.08 notification outage drift");
checks.push("40.08");

const offline=h.simulateClientOfflineReconnectDuringBidding(18);
if(offline.biddingEnabled||!offline.reconnectRequired||!offline.resyncRequired)fail("40.09 client offline/reconnect drift");
const offlineRecovered=h.recover(offline,21);
if(!offlineRecovered.biddingEnabled||offlineRecovered.resyncRequired||offlineRecovered.authoritativeSequence!==21)fail("40.09 reconnect recovery drift");
checks.push("40.09");

const partition=h.simulateNetworkPartition({clientSequence:18,serverReachable:false});
if(partition.biddingEnabled||partition.authoritativeWriteEnabled||!partition.resyncRequired||!partition.notes.includes("split-brain-prevented"))fail("40.10 network partition drift");
const partitionRecovered=h.recover(partition,22);
if(!partitionRecovered.biddingEnabled||partitionRecovered.reconnectRequired||partitionRecovered.authoritativeSequence!==22)fail("40.10 partition recovery drift");
checks.push("40.10");

for(const state of [rt,worker,finalization,redis,db,storage,kyc,notifications,offline,partition]){
  if(JSON.stringify(state.preservedAcceptedBidIds)!==baselineBids)fail("accepted bid fixture mutated");
  if(state.winnerId!==baselineWinner)fail("winner fixture mutated");
}

if(process.argv.includes("--self-test")){
  const reject=(label,fn)=>{let ok=false;try{fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  reject("recovery sequence regression",()=>h.recover(partition,19));
  reject("invalid client sequence",()=>h.simulateClientOfflineReconnectDuringBidding(-1));
  reject("invalid partition sequence",()=>h.simulateNetworkPartition({clientSequence:-1}));
  reject("excessive retry budget",()=>createProductionFailureCertificationHarness({retryBudget:6}));
  reject("missing auction id",()=>createProductionFailureCertificationHarness({auctionId:" "}));
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_01_10_SELF_TEST PASS tasks=10 negative_cases=5 fail_closed=true authoritative_recovery=true production_mutation=false");
}else{
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_01_10 PASS tasks=10 fail_closed=true authoritative_recovery=true");
}
