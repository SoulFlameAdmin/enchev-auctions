import fs from "node:fs";
import { createProductionFailureCertificationHarness } from "../test/utils/production-failure-certification.mjs";

const CONFIG_PATH="config/enchev-production-failure-certification-40-16-19.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";

function fail(message){throw new Error("PRODUCTION_FAILURE_CERTIFICATION_40_16_19 FAIL: "+message);}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="40");
  if(!phase)fail("phase 40 missing");
  return phase[2].slice(15,19).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"40."+String(index+16).padStart(2,"0"),name,kind:kindRaw==="test"?"test":"feature"};
  });
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const expected=frozenTasks();
if(expected.length!==4)fail("expected four tasks");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen task identity drift");
for(const key of ["productionMutationForbidden","realProviderFaultInjectionForbidden","realCustomerDataForbidden"]){
  if(config.execution?.[key]!==true)fail("safety boundary disabled: "+key);
}
for(const key of ["activeRoomsRequireRejoinAndAuthoritativeResync","bidHistoryImmutableAcrossFailureMatrix","winnerImmutableAcrossFailureMatrix","structuredEvidenceCaptureRequired","deterministicEvidenceOnly"]){
  if(config.invariants?.[key]!==true)fail("invariant disabled: "+key);
}

const h=createProductionFailureCertificationHarness({auctionId:"auc-40",authoritativeSequence:20,retryBudget:2});
const ids=Array.from({length:16},(_,i)=>"40."+String(i+1).padStart(2,"0"));
const closeAt=2_000_000;
const states=[
  h.simulateRealtimeProcessCrashDuringActiveAuction(),
  h.simulateWorkerCrashDuringActiveAuction(),
  h.simulateWorkerCrashDuringFinalization(),
  h.simulateRedisConnectionLoss(),
  h.simulateDatabaseConnectionInterruption(),
  h.simulateObjectStorageOutage(),
  h.simulateKycProviderOutage(),
  h.simulateNotificationProviderOutage(),
  h.simulateClientOfflineReconnectDuringBidding(18),
  h.simulateNetworkPartition({clientSequence:18,serverReachable:false}),
  h.simulateDuplicateEventDelivery({eventId:"event-bid-20",deliveries:3}),
  h.simulateOutOfOrderEventDelivery({lastAppliedSequence:20,incomingSequence:19}),
  h.simulateSequenceGapRecovery({clientSequence:17,incomingSequence:20}),
  h.simulateStaleCacheRecovery({cacheSequence:18,sourceSequence:20}),
  h.simulateClockSkew({clientNowMs:1_999_000,serverNowMs:2_001_000,closesAtMs:closeAt}),
  h.simulateServiceRestartWithActiveRooms({roomIds:["room-a","room-b"],clientSequence:19})
];

const restart=states[15];
if(restart.biddingEnabled||restart.readModelAvailable||!restart.reconnectRequired||!restart.resyncRequired||restart.activeRoomIds?.length!==2) {
  fail("40.16 service restart fail-closed drift");
}

const baselineBids=JSON.stringify(["bid-1","bid-2"]);
if(!states.every(state=>JSON.stringify(state.preservedAcceptedBidIds)===baselineBids)) fail("40.17 bid-history corruption detected");
if(!states.every(state=>state.winnerId==="buyer-2")) fail("40.18 winner corruption detected");

const evidence=h.captureFailureDrillEvidence({scenarioIds:ids,states});
if(!evidence.evidenceCaptured||evidence.scenarioCount!==16||!evidence.bidHistoryIntact||!evidence.winnerIntact||evidence.productionMutation!==false) {
  fail("40.19 evidence capture drift");
}

if(process.argv.includes("--self-test")){
  const reject=(label,fn)=>{let ok=false;try{fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  reject("restart without rooms",()=>h.simulateServiceRestartWithActiveRooms({roomIds:[]}));
  reject("duplicate room ids",()=>h.simulateServiceRestartWithActiveRooms({roomIds:["room-a","room-a"]}));
  reject("evidence matrix length mismatch",()=>h.captureFailureDrillEvidence({scenarioIds:["40.01"],states:[]}));
  reject("evidence duplicate scenario",()=>h.captureFailureDrillEvidence({scenarioIds:["40.01","40.01"],states:[states[0],states[1]]}));
  reject("bid-history corruption",()=>h.captureFailureDrillEvidence({scenarioIds:["40.01"],states:[{...states[0],preservedAcceptedBidIds:["tampered"]}]}));
  reject("winner corruption",()=>h.captureFailureDrillEvidence({scenarioIds:["40.01"],states:[{...states[0],winnerId:"tampered"}]}));
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_16_19_SELF_TEST PASS tasks=4 scenarios=16 negative_cases=6 active_room_resync=true bid_history_intact=true winner_intact=true evidence_captured=true production_mutation=false");
}else{
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_16_19 PASS tasks=4 scenarios=16 active_room_resync=true bid_history_intact=true winner_intact=true evidence_captured=true");
}
