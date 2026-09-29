import fs from "node:fs";
import { createProductionFailureCertificationHarness } from "../test/utils/production-failure-certification.mjs";
import { createControlledClock } from "../test/utils/controlled-clock.mjs";

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
for(const key of ["duplicateMustBeIdempotent","outOfOrderMustNotApply","sequenceGapMustResync","staleCacheMustBeDiscarded","browserClockNeverAuthoritative","acceptedBidHistoryPreserved","winnerPreserved"]){
  if(config.invariants?.[key]!==true)fail("invariant disabled: "+key);
}
const harnessSource=fs.readFileSync(HARNESS_PATH,"utf8");
for(const fn of ["simulateDuplicateEventDelivery","simulateOutOfOrderEventDelivery","simulateSequenceGapRecovery","simulateStaleCacheRecovery","simulateClockSkew"]){
  if(!harnessSource.includes(fn))fail("harness method missing: "+fn);
}

const h=createProductionFailureCertificationHarness({auctionId:"auc-40",authoritativeSequence:20,retryBudget:2});
const baselineBids=JSON.stringify(["bid-1","bid-2"]);
const baselineWinner="buyer-2";
const preserve=state=>{
  if(JSON.stringify(state.preservedAcceptedBidIds)!==baselineBids)fail("accepted bid history mutated");
  if(state.winnerId!==baselineWinner)fail("winner mutated");
};

const duplicate=h.simulateDuplicateEventDelivery({eventId:"evt-21",sequence:21});
if(!duplicate.duplicateIgnored||duplicate.authoritativeSequence!==21||JSON.stringify(duplicate.appliedEventIds)!==JSON.stringify(["evt-21"]))fail("40.11 duplicate delivery drift");
if(!duplicate.notes.includes("duplicate-delivery-idempotent-ignore")||!duplicate.notes.includes("no-second-authoritative-mutation"))fail("40.11 duplicate evidence drift");
preserve(duplicate);

const outOfOrder=h.simulateOutOfOrderEventDelivery({receivedSequence:22});
if(outOfOrder.authoritativeSequence!==20||outOfOrder.biddingEnabled||!outOfOrder.resyncRequired||outOfOrder.expectedSequence!==21)fail("40.12 out-of-order handling drift");
if(JSON.stringify(outOfOrder.bufferedSequences)!==JSON.stringify([22])||!outOfOrder.notes.includes("event-not-applied"))fail("40.12 out-of-order event application drift");
preserve(outOfOrder);

const gap=h.simulateSequenceGapRecovery({receivedSequence:23,snapshotSequence:23});
if(gap.authoritativeSequence!==23||!gap.snapshotApplied||gap.resyncRequired||!gap.biddingEnabled)fail("40.13 sequence-gap recovery drift");
if(!gap.notes.includes("authoritative-snapshot-applied")||!gap.notes.includes("sequence-gap-recovered"))fail("40.13 recovery evidence drift");
preserve(gap);

const stale=h.simulateStaleCacheRecovery({cacheSequence:17,snapshotSequence:20});
if(stale.cacheSequence!==20||!stale.cacheDiscarded||!stale.snapshotApplied||stale.resyncRequired||!stale.readModelAvailable||!stale.biddingEnabled)fail("40.14 stale-cache recovery drift");
if(!stale.notes.includes("cache-discarded")||!stale.notes.includes("authoritative-cache-rebuilt"))fail("40.14 stale-cache evidence drift");
preserve(stale);

const authClock=createControlledClock("2030-01-01T10:00:00.000Z");
const aheadClient=createControlledClock("2030-01-01T10:00:02.000Z");
const deadline=Date.parse("2030-01-01T10:00:01.000Z");
const clientAhead=h.simulateClockSkew({
  clientNowMs:aheadClient.nowMs(),
  authoritativeNowMs:authClock.nowMs(),
  deadlineMs:deadline
});
if(clientAhead.authoritativeDecision!=="accept"||clientAhead.clientDecision!=="reject-late-operation"||!clientAhead.clientClockIgnored||!clientAhead.biddingEnabled)fail("40.15 ahead-client clock skew drift");
if(!clientAhead.notes.includes("clock-skew-decision-divergence-contained"))fail("40.15 ahead-client divergence not contained");
preserve(clientAhead);

authClock.set("2030-01-01T10:00:02.000Z");
const behindClient=createControlledClock("2030-01-01T10:00:00.000Z");
const clientBehind=h.simulateClockSkew({
  clientNowMs:behindClient.nowMs(),
  authoritativeNowMs:authClock.nowMs(),
  deadlineMs:deadline
});
if(clientBehind.authoritativeDecision!=="reject-late-operation"||clientBehind.clientDecision!=="accept"||!clientBehind.clientClockIgnored||clientBehind.biddingEnabled)fail("40.15 behind-client clock skew drift");
if(!clientBehind.notes.includes("clock-skew-decision-divergence-contained"))fail("40.15 behind-client divergence not contained");
preserve(clientBehind);

if(process.argv.includes("--self-test")){
  const reject=(label,fn)=>{let ok=false;try{fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  reject("duplicate wrong sequence",()=>h.simulateDuplicateEventDelivery({eventId:"evt-bad",sequence:22}));
  reject("out-of-order contiguous sequence",()=>h.simulateOutOfOrderEventDelivery({receivedSequence:21}));
  reject("gap snapshot behind received event",()=>h.simulateSequenceGapRecovery({receivedSequence:23,snapshotSequence:22}));
  reject("cache is not stale",()=>h.simulateStaleCacheRecovery({cacheSequence:20,snapshotSequence:20}));
  reject("cache snapshot regresses authority",()=>h.simulateStaleCacheRecovery({cacheSequence:17,snapshotSequence:19}));
  reject("invalid clock input",()=>h.simulateClockSkew({clientNowMs:Number.NaN,authoritativeNowMs:1000,deadlineMs:1000}));
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_11_15_SELF_TEST PASS tasks=5 negative_cases=6 duplicate_idempotent=true out_of_order_blocked=true sequence_gap_recovered=true stale_cache_rebuilt=true client_clock_ignored=true production_mutation=false");
}else{
  console.log("PRODUCTION_FAILURE_CERTIFICATION_40_11_15 PASS tasks=5 duplicate_idempotent=true authoritative_recovery=true client_clock_ignored=true");
}
