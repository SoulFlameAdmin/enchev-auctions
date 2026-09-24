import fs from "node:fs";

const CONFIG_PATH="config/enchev-retry-budgets.json";
const SOURCE_PATHS={
  "27.03":"config/enchev-bid-acceptance-latency-sli.json",
  "27.04":"config/enchev-realtime-delivery-latency-sli.json",
  "27.05":"config/enchev-reconnect-success-sli.json",
  "27.06":"config/enchev-auction-finalization-success-sli.json",
  "27.08":"config/enchev-error-budget-policy.json",
  "27.09":"config/enchev-latency-timeout-budgets.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`RETRY_BUDGETS FAIL: ${message}`);}
function nonNegativeInt(value,label){if(!Number.isInteger(value)||value<0) fail(`${label} must be a non-negative integer`);}
function positiveBackoff(values,label){if(!Array.isArray(values)||values.some(v=>!Number.isInteger(v)||v<=0)) fail(`${label} backoff must contain positive integer ms values`);}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.10") fail("taskId must be 27.10");
  if(config?.name!=="Retry budgets") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-provisional-policy") fail("status drift");
  if(config?.scope!=="engineering-retry-policy") fail("scope drift");

  const expected=["27.03","27.04","27.05","27.06","27.08","27.09"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source task list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}

  if(sources["27.09"]?.semantics?.retryCountOwnershipTask!=="27.10") fail("27.09 retry ownership drift");
  if(sources["27.08"]?.ownership?.retryBudgetsTask!=="27.10") fail("27.08 retry ownership drift");

  const review=config?.reviewPolicy;
  if(review?.valuesAreMeasuredProductionResults!==false) fail("retry budgets must not be presented as measured results");
  if(review?.valuesAreInitialEngineeringBudgets!==true||review?.reviewAfterRepresentativeProductionEvidence!==true||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy guardrail missing");

  const b=config?.budgets;
  nonNegativeInt(b?.bidAcceptance?.maxAutomaticRetriesAfterInitialAttempt,"bid retries");
  if(b.bidAcceptance.maxAutomaticRetriesAfterInitialAttempt!==0) fail("authoritative bid acceptance must not be blindly retried");
  if(b.bidAcceptance.sourceTask!=="27.03"||b.bidAcceptance.attemptTimeoutSourceTask!=="27.09") fail("bid source drift");
  if(b.bidAcceptance.ambiguousOutcomeRequiresAuthoritativeReadBeforeAnyRetry!==true||b.bidAcceptance.idempotencyKeyRequiredForAnyExplicitRetry!==true) fail("bid ambiguity/idempotency guardrail missing");

  nonNegativeInt(b?.realtimeDelivery?.maxAutomaticRetriesAfterInitialAttempt,"realtime retries");
  if(b.realtimeDelivery.maxAutomaticRetriesAfterInitialAttempt!==2) fail("realtime retry count drift");
  positiveBackoff(b.realtimeDelivery.backoffMs,"realtime");
  if(JSON.stringify(b.realtimeDelivery.backoffMs)!==JSON.stringify([250,750])||b.realtimeDelivery.jitter!=="full") fail("realtime backoff drift");
  if(b.realtimeDelivery.sourceTask!=="27.04"||b.realtimeDelivery.attemptTimeoutSourceTask!=="27.09"||b.realtimeDelivery.duplicateDeliveryMustRemainNonAuthoritative!==true) fail("realtime retry semantics drift");

  nonNegativeInt(b?.reconnectRecovery?.maxAutomaticRetriesAfterInitialAttempt,"reconnect retries");
  if(b.reconnectRecovery.maxAutomaticRetriesAfterInitialAttempt!==3) fail("reconnect retry count drift");
  positiveBackoff(b.reconnectRecovery.backoffMs,"reconnect");
  if(JSON.stringify(b.reconnectRecovery.backoffMs)!==JSON.stringify([500,1500,4000])||b.reconnectRecovery.jitter!=="full") fail("reconnect backoff drift");
  if(b.reconnectRecovery.sourceTask!=="27.05"||b.reconnectRecovery.attemptTimeoutSourceTask!=="27.09"||b.reconnectRecovery.authoritativeBaselineRequiredAfterReconnect!==true||b.reconnectRecovery.sequenceGapForcesResync!==true) fail("reconnect semantics drift");
  if(sources["27.05"]?.indicator?.successRequiresAuthoritativeBaseline!==true) fail("27.05 authoritative baseline source drift");

  nonNegativeInt(b?.auctionFinalization?.maxAutomaticRetriesAfterInitialAttempt,"finalization retries");
  if(b.auctionFinalization.maxAutomaticRetriesAfterInitialAttempt!==1) fail("finalization retry count drift");
  positiveBackoff(b.auctionFinalization.backoffMs,"finalization");
  if(JSON.stringify(b.auctionFinalization.backoffMs)!==JSON.stringify([1000])||b.auctionFinalization.jitter!=="full") fail("finalization backoff drift");
  if(b.auctionFinalization.sourceTask!=="27.06"||b.auctionFinalization.attemptTimeoutSourceTask!=="27.09"||b.auctionFinalization.idempotencyKeyRequired!==true||b.auctionFinalization.authoritativeReadBeforeRetryAfterUnknownOutcome!==true||b.auctionFinalization.durablePostgresqlCommitStillDefinesSuccess!==true) fail("finalization semantics drift");
  if(sources["27.06"]?.indicator?.successRequiresDurablePostgresqlCommit!==true) fail("27.06 durable commit source drift");

  const s=config?.globalSemantics;
  for(const key of ["retryBudgetCountsRetriesAfterInitialAttempt","retryMayNotExtendIndividualAttemptTimeout","retryMayNotConvertUnknownOutcomeToSuccess","retryOnExplicitPermanentFailureForbidden","retryOnValidationOrPermissionFailureForbidden","retryOnRateLimitMustHonorAuthoritativeRetryAfterWhenProvided","retryAfterMustNotBeInvented","boundedExponentialStyleBackoff","jitterRequiredWhereBackoffExists"]){if(s?.[key]!==true) fail(`semantic guardrail disabled: ${key}`);}
  if(s?.capacityOwnershipTask!=="27.11"||s?.gracefulDegradationOwnershipTask!=="27.12"||s?.loadSheddingOwnershipTask!=="27.13") fail("downstream ownership drift");

  const eb=config?.errorBudgetIntegration;
  if(eb?.sourceTask!=="27.08"||eb?.retriesDoNotEraseOriginalFailures!==true||eb?.retryAttemptsMayBeMeasuredSeparately!==true||eb?.successfulRetryDoesNotRewriteFailedAttemptTelemetry!==true) fail("error-budget retry semantics drift");

  const a=config?.authority;
  if(a?.authoritativeAuctionSource!=="postgresql"||a?.retryPolicyMayMutateAuctionState!==false||a?.telemetryMayMutateAuctionState!==false||a?.retryMayChooseWinner!==false||a?.retryMayCreateAcceptedBidWithoutAuthoritativeCommand!==false||a?.realtimeTransportAuthoritative!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noUnlimitedRetries","noRetryStorms","noBlindBidRetry","noBlindFinalizationRetry","noCapacityLimitInThisTask","noMeasuredProductionPerformanceClaim","noProviderSpecificShortcut"]){if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);}

  if(pkg?.scripts?.["verify:retry-budgets"]!=="node scripts/verify-retry-budgets.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:retry-budgets:self-test"]!=="node scripts/verify-retry-budgets.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-retry-budgets.mjs", "--self-test"]')) fail("27.10 missing from pre-gates");
  return {retryPolicies:4,totalAutomaticRetries:6};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};
  reject("blind bid retry",c=>{c.budgets.bidAcceptance.maxAutomaticRetriesAfterInitialAttempt=1;});
  reject("bid authoritative read removed",c=>{c.budgets.bidAcceptance.ambiguousOutcomeRequiresAuthoritativeReadBeforeAnyRetry=false;});
  reject("unbounded-ish reconnect drift",c=>{c.budgets.reconnectRecovery.maxAutomaticRetriesAfterInitialAttempt=99;});
  reject("reconnect baseline removed",c=>{c.budgets.reconnectRecovery.authoritativeBaselineRequiredAfterReconnect=false;});
  reject("finalization idempotency removed",c=>{c.budgets.auctionFinalization.idempotencyKeyRequired=false;});
  reject("retry-after invented",c=>{c.globalSemantics.retryAfterMustNotBeInvented=false;});
  reject("retry erases failure",c=>{c.errorBudgetIntegration.retriesDoNotEraseOriginalFailures=false;});
  reject("retry chooses winner",c=>{c.authority.retryMayChooseWinner=true;});
  reject("capacity ownership stolen",c=>{c.globalSemantics.capacityOwnershipTask="27.10";});

  const badSources=structuredClone(sources);
  badSources["27.09"].semantics.retryCountOwnershipTask="27.11";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-retry-budgets.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`RETRY_BUDGETS_SELF_TEST PASS cases=${cases} retry_policies=${result.retryPolicies} total_auto_retries=${result.totalAutomaticRetries} fail_closed=true`);
}else{
  console.log(`RETRY_BUDGETS PASS task=27.10 retry_policies=${result.retryPolicies} total_auto_retries=${result.totalAutomaticRetries}`);
}
