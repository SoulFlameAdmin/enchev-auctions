import fs from "node:fs";
import { createProductionFailureCertificationHarness } from "../test/utils/production-failure-certification.mjs";

const CONFIG_PATH="config/enchev-production-failure-certification-40-11-15.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const HARNESS_PATH="test/utils/production-failure-certification.mjs";

function fail(message){throw new Error("PRODUCTION_FAILURE_CERTIFICATION_40_11_15 FAIL: "+message);}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ",endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  if(start===-1||end===-1)fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="40");
  if(!phase)fail("phase 40 missing");
  return phase[2].slice(10,15).map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"40."+String(index+11).padStart(2,"0"),name,kind:kindRaw==="test"?"test":"feature"};
  });
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const expected=frozenTasks();
if(expected.length!==5)fail("expected five tasks");
if(JSON.stringify(config.tasks)!==JSON.stringify(expected))fail("frozen task identity drift");
for(const key of ["productionMutationForbidden","realProviderFaultInjectionForbidden","realCustomerDataForbidden"]){
  if(config.execution?.[key]!==true)fail("safety boundary disabled: "+key);
}
for(const key of ["duplicateDeliveryIdempotent","outOfOrderEventRejected","sequenceGapRequiresAuthoritativeResync","staleCacheNeverAuthority","serverTimeAuthoritative","acceptedBidHistoryImmutable","winnerImmutable","deterministicEvidenceOnly"]){
  if(config.invariants?.[key]!==true)fail("invariant disabled: "+key);
}
const harnessSource=fs.readFileSync(HARNESS_PATH,"utf8");
for(const method of ["simulateDuplicateEventDelivery","simulateOutOfOrderEventDelivery","simulateSequenceGapRecovery","simulateStaleCacheRecovery","simulateClockSkew"]){
  if(!harnessSource.includes(method))fail("harness method missing: "+method);
}

const h=createProductionFailureCertificationHarness({auctionId:"auc-40",authoritativeSequence:20,retryBudget:2});
const baselineBids=JSON.stringify(["bid-1","bid-2"]);
const baselineWinner="buyer-2";
const states=[];

const duplicate=h.simulateDuplicateEventDelivery({eventId:"event-bid-20",deliveries:3});
if(duplicate.appliedMutationCount!==1||duplicate.ignoredDuplicateDeliveries!==2||duplicate.processedEventIds?.length!==1||duplicate.processedEventIds?.[0]!=="event-bid-20") fail("40.11 duplicate idempotency drift");
states.push(duplicate);

const outOfOrder=h.simulateOutOfOrderEventDelivery({lastAppliedSequence:20,incomingSequence:19});
if(outOfOrder.biddingEnabled||outOfOrder.readModelAvailable||!outOfOrder.resyncRequired||outOfOrder.rejectedIncomingSequence!==19) fail("40.12 out-of-order rejection drift");
states.push(outOfOrder);

const gap=h.simulateSequenceGapRecovery({clientSequence:17,incomingSequence:20});
if(gap.biddingEnabled||gap.readModelAvailable||!gap.resyncRequired||gap.missingSequenceFrom!==18||gap.missingSequenceTo!==19) fail("40.13 sequence gap detection drift");
const gapRecovered=h.recover(gap,20);
if(!gapRecovered.biddingEnabled||gapRecovered.resyncRequired||gapRecovered.authoritativeSequence!==20) fail("40.13 sequence gap recovery drift");
states.push(gap);

const stale=h.simulateStaleCacheRecovery({cacheSequence:18,sourceSequence:20});
if(stale.biddingEnabled||stale.readModelAvailable||!stale.resyncRequired||stale.cacheSequence!==18||stale.sourceSequence!==20) fail("40.14 stale cache detection drift");
const staleRecovered=h.recover(stale,20);
if(!staleRecovered.biddingEnabled||!staleRecovered.readModelAvailable||staleRecovered.resyncRequired) fail("40.14 stale cache recovery drift");
states.push(stale);

const closeAt=2_000_000;
const skewLateClient=h.simulateClockSkew({clientNowMs:1_999_000,serverNowMs:2_001_000,closesAtMs:closeAt});
if(skewLateClient.biddingEnabled||skewLateClient.serverOpen||!skewLateClient.clientOpen||!skewLateClient.clientClockIgnored) fail("40.15 client-behind clock skew drift");
const skewFastClient=h.simulateClockSkew({clientNowMs:2_001_000,serverNowMs:1_999_000,closesAtMs:closeAt});
if(!skewFastClient.biddingEnabled||!skewFastClient.serverOpen||skewFastClient.clientOpen||!skewFastClient.clientClockIgnored) fail("40.15 client-ahead clock skew drift");
states.push(skewLateClient,skewFastClient);

for(const state of states){
  if(JSON.stringify(state.preservedAcceptedBidIds)!==baselineBids)fail("accepted bid fixture mutated");
  if(state.winnerId!==baselineWinner)fail("winner fixture mutated");
}

if(process.argv.includes("--self-test")){
  const reject=(label,fn)=>{let ok=false;try{fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  reject("single duplicate delivery",()=>h.simulateDuplicateEventDelivery({deliveries:1}));
  reject("non-regressing out-of-order event",()=>h.simulateOutOfOrderEventDelivery({lastAppliedSequence:20,incomingSequence:20}));
  reject("missing sequence gap",()=>h.simulateSequenceGapRecovery({clientSequence:19,incomingSequence:20}));
  reject("fresh cache passed as stale",()=>h.simulateStaleCacheRecovery({cacheSequence:20,sourceSequence:20}));
  reject("invalid clock value",()=>h.simulateClockSkew({clientNowMs:-1,serverNowMs:1,closesAtMs:2}));
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_11_15_SELF_TEST PASS tasks=5 negative_cases=5 idempotent=true ordered_projection=true authoritative_resync=true server_time=true production_mutation=false");
}else{
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_11_15 PASS tasks=5 idempotent=true ordered_projection=true authoritative_resync=true server_time=true");
}
