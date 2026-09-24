import fs from "node:fs";

const CONFIG_PATH="config/enchev-latency-timeout-budgets.json";
const SOURCE_PATHS={
  "27.03":"config/enchev-bid-acceptance-latency-sli.json",
  "27.04":"config/enchev-realtime-delivery-latency-sli.json",
  "27.05":"config/enchev-reconnect-success-sli.json",
  "27.06":"config/enchev-auction-finalization-success-sli.json",
  "27.07":"config/enchev-initial-slo-targets.json",
  "27.08":"config/enchev-error-budget-policy.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`LATENCY_TIMEOUT_BUDGETS FAIL: ${message}`);}
function positiveMs(value,label){if(!Number.isInteger(value)||value<=0) fail(`${label} must be a positive integer ms value`);}
function close(a,b){return Math.abs(a-b)<1e-12;}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.09") fail("taskId must be 27.09");
  if(config?.name!=="Latency/timeout budgets") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-provisional-policy") fail("status drift");
  if(config?.scope!=="engineering-budget-policy") fail("scope drift");
  const expected=["27.03","27.04","27.05","27.06","27.07","27.08"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source task list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}

  const review=config?.reviewPolicy;
  if(review?.valuesAreMeasuredProductionResults!==false) fail("budgets must not be presented as measured results");
  if(review?.valuesAreInitialEngineeringBudgets!==true||review?.reviewAfterRepresentativeProductionEvidence!==true||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy guardrail missing");

  const bid=config?.latencyBudgets?.bidAcceptance;
  if(bid?.sli!==sources["27.03"]?.indicator?.name) fail("bid latency SLI drift");
  if(sources["27.03"]?.latencyBudgetOwnershipTask!=="27.09") fail("bid latency ownership drift");
  if(bid?.sourceTask!=="27.03"||bid?.complianceTargetSourceTask!=="27.07") fail("bid latency source drift");
  if(!close(bid?.complianceTargetRatio,sources["27.07"]?.targets?.bidAcceptanceLatency?.complianceTargetRatio)) fail("bid compliance ratio drift");
  if(bid?.thresholdMs!==750) fail("bid latency threshold drift");
  if(bid?.clock!=="monotonic_server_side"||bid?.samplePopulationInheritedFromSli!==true) fail("bid latency measurement semantics drift");
  positiveMs(bid.thresholdMs,"bid latency threshold");

  const rt=config?.latencyBudgets?.realtimeDelivery;
  if(rt?.sli!==sources["27.04"]?.indicator?.name) fail("realtime latency SLI drift");
  if(sources["27.04"]?.latencyBudgetOwnershipTask!=="27.09") fail("realtime latency ownership drift");
  if(rt?.sourceTask!=="27.04"||rt?.complianceTargetSourceTask!=="27.07") fail("realtime latency source drift");
  if(!close(rt?.complianceTargetRatio,sources["27.07"]?.targets?.realtimeDeliveryLatency?.complianceTargetRatio)) fail("realtime compliance ratio drift");
  if(rt?.thresholdMs!==250) fail("realtime latency threshold drift");
  if(rt?.clock!=="monotonic_server_side"||rt?.samplePopulationInheritedFromSli!==true) fail("realtime latency measurement semantics drift");
  positiveMs(rt.thresholdMs,"realtime latency threshold");

  const t=config?.timeoutBudgets;
  const expectedTimeouts={bidAcceptanceAttempt:3000,realtimeDeliveryAttempt:1000,reconnectRecovery:10000,auctionFinalizationAttempt:30000};
  for(const [key,value] of Object.entries(expectedTimeouts)){positiveMs(t?.[key]?.timeoutMs,`${key} timeout`);if(t?.[key]?.timeoutMs!==value) fail(`${key} timeout drift`);}
  if(t?.bidAcceptanceAttempt?.sourceTask!=="27.03"||t?.bidAcceptanceAttempt?.timeoutDoesNotCreateAcceptedLatencySample!==true||t?.bidAcceptanceAttempt?.timeoutRemainsReliabilityFailure!==true) fail("bid timeout semantics drift");
  if(t?.realtimeDeliveryAttempt?.sourceTask!=="27.04"||t?.realtimeDeliveryAttempt?.timeoutDoesNotCreateDeliveryLatencySample!==true||t?.realtimeDeliveryAttempt?.timeoutRemainsReliabilityFailure!==true) fail("realtime timeout semantics drift");
  if(t?.reconnectRecovery?.sourceTask!=="27.05"||t?.reconnectRecovery?.successStillRequiresAuthoritativeBaseline!==true||t?.reconnectRecovery?.timeoutCountsAsReconnectFailure!==true) fail("reconnect timeout semantics drift");
  if(sources["27.05"]?.indicator?.timeoutCountsAsFailure!==true) fail("27.05 timeout failure source drift");
  if(t?.auctionFinalizationAttempt?.sourceTask!=="27.06"||t?.auctionFinalizationAttempt?.successStillRequiresDurablePostgresqlCommit!==true||t?.auctionFinalizationAttempt?.timeoutCountsAsFinalizationFailure!==true) fail("finalization timeout semantics drift");
  if(sources["27.06"]?.indicator?.timeoutCountsAsFailure!==true) fail("27.06 timeout failure source drift");

  const s=config?.semantics;
  for(const key of ["timeoutStartsAtEligibleAttemptBoundary","timeoutIsAttemptDeadlineNotRetryBudget","clientRenderTimeExcludedFromServerLatencyBudgets","browserClockForbiddenForBudgetEvaluation","wallClockForbiddenForDurationMath","negativeDurationForbidden","timeoutMayNotConvertUnknownOutcomeToSuccess","latencyThresholdMayNotRedefineSliPopulation"]){if(s?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);}
  if(s?.retryCountOwnershipTask!=="27.10") fail("retry ownership drift");
  if(s?.capacityOwnershipTask!=="27.11") fail("capacity ownership drift");

  const eb=config?.errorBudgetIntegration;
  if(eb?.sourceTask!=="27.08") fail("error-budget source drift");
  const bidBudget=(sources["27.08"]?.budgetCatalog||[]).find(x=>x.id==="bid.acceptance_latency");
  const rtBudget=(sources["27.08"]?.budgetCatalog||[]).find(x=>x.id==="realtime.delivery_latency");
  if(!bidBudget||!rtBudget) fail("latency error-budget entries missing");
  if(!close(eb?.bidLatencyAllowedBadFraction,bidBudget.allowedBadFraction)||!close(eb?.realtimeLatencyAllowedBadFraction,rtBudget.allowedBadFraction)) fail("latency allowed-bad fractions drift");
  if(eb?.latencyBudgetConsumptionNowEvaluableWhenEligibleSamplesExist!==true) fail("27.09 must unlock evaluability when samples exist");
  if(eb?.insufficientEligibleDataState!=="not_evaluable") fail("insufficient data state drift");

  const a=config?.authority;
  if(a?.authoritativeAuctionSource!=="postgresql"||a?.telemetryMayMutateAuctionState!==false||a?.timeoutMayChooseWinner!==false||a?.timeoutMayCreateAcceptedBid!==false||a?.realtimeTransportAuthoritative!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noRetryBudgetInThisTask","noCapacityLimitInThisTask","noMeasuredProductionPerformanceClaim","noProviderSpecificShortcut","noTelemetryDerivedAcceptedBid","noTelemetryDerivedWinner"]){if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);}

  if(pkg?.scripts?.["verify:latency-timeout-budgets"]!=="node scripts/verify-latency-timeout-budgets.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:latency-timeout-budgets:self-test"]!=="node scripts/verify-latency-timeout-budgets.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-latency-timeout-budgets.mjs", "--self-test"]')) fail("27.09 missing from pre-gates");
  return {latencyBudgets:2,timeoutBudgets:4};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};
  reject("bid threshold drift",c=>{c.latencyBudgets.bidAcceptance.thresholdMs=900;});
  reject("realtime threshold drift",c=>{c.latencyBudgets.realtimeDelivery.thresholdMs=400;});
  reject("timeout creates accepted sample",c=>{c.timeoutBudgets.bidAcceptanceAttempt.timeoutDoesNotCreateAcceptedLatencySample=false;});
  reject("reconnect baseline not required",c=>{c.timeoutBudgets.reconnectRecovery.successStillRequiresAuthoritativeBaseline=false;});
  reject("retry budget invented",c=>{c.guardrails.noRetryBudgetInThisTask=false;});
  reject("browser clock allowed",c=>{c.semantics.browserClockForbiddenForBudgetEvaluation=false;});
  reject("measured result claim",c=>{c.reviewPolicy.valuesAreMeasuredProductionResults=true;});
  reject("winner chosen by timeout",c=>{c.authority.timeoutMayChooseWinner=true;});
  reject("error budget fraction drift",c=>{c.errorBudgetIntegration.bidLatencyAllowedBadFraction=0.02;});

  const badSources=structuredClone(sources);
  badSources["27.04"].latencyBudgetOwnershipTask="27.10";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-latency-timeout-budgets.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`LATENCY_TIMEOUT_BUDGETS_SELF_TEST PASS cases=${cases} latency_budgets=${result.latencyBudgets} timeout_budgets=${result.timeoutBudgets} fail_closed=true`);
}else{
  console.log(`LATENCY_TIMEOUT_BUDGETS PASS task=27.09 latency_budgets=${result.latencyBudgets} timeout_budgets=${result.timeoutBudgets}`);
}
