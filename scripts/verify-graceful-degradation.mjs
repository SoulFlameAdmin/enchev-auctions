import fs from "node:fs";

const CONFIG_PATH="config/enchev-graceful-degradation.json";
const SOURCE_PATHS={
  "27.08":"config/enchev-error-budget-policy.json",
  "27.09":"config/enchev-latency-timeout-budgets.json",
  "27.10":"config/enchev-retry-budgets.json",
  "27.11":"config/enchev-capacity-model.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`GRACEFUL_DEGRADATION FAIL: ${message}`);}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.12") fail("taskId must be 27.12");
  if(config?.name!=="Graceful degradation rules") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-provisional-policy") fail("status drift");
  if(config?.scope!=="reliability-degradation-policy") fail("scope drift");

  const expected=["27.08","27.09","27.10","27.11"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}
  if(sources["27.10"]?.globalSemantics?.gracefulDegradationOwnershipTask!=="27.12") fail("27.10 degradation ownership drift");
  if(sources["27.11"]?.downstreamOwnership?.gracefulDegradationTask!=="27.12") fail("27.11 degradation ownership drift");

  const review=config?.reviewPolicy;
  if(review?.rulesAreMeasuredProductionBehavior!==false||review?.rulesAreInitialEngineeringPolicy!==true||review?.runtimeActivationClaimed!==false||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy drift");

  const p=config?.principles;
  for(const key of ["correctnessBeforeAvailabilityForAuthoritativeAuctionState","degradeOptionalCapabilityBeforeCriticalCapability","failClosedWhenAuthoritativeSafetyCannotBePreserved","degradationMustBeReversible","degradationStateMustBeObservableAndAuditable","degradationMustNotRewriteHistoricalTelemetry"]){if(p?.[key]!==true) fail(`principle disabled: ${key}`);}

  const protectedExpected=[
    "authentication_and_authorization",
    "buyer_eligibility_enforcement",
    "authoritative_bid_acceptance",
    "auction_timer_and_state_transition_authority",
    "auction_finalization_and_winner_selection",
    "idempotency_and_duplicate_protection",
    "durable_audit_and_critical_event_history"
  ];
  if(JSON.stringify(config?.protectedCapabilities)!==JSON.stringify(protectedExpected)) fail("protected capability set drift");

  const d=config?.degradableCapabilities;
  if(d?.optionalEnrichment?.class!=="non_authoritative"||d.optionalEnrichment.mustNotChangeAuthoritativeFields!==true) fail("optional enrichment guardrail missing");
  if(d?.noncriticalBackgroundWork?.class!=="deferable"||d.noncriticalBackgroundWork.criticalFinalizationWorkersExcluded!==true) fail("background work guardrail missing");
  if(d?.realtimePresentation?.class!=="projection"||d.realtimePresentation.mayNotBecomeAuthoritative!==true||d.realtimePresentation.mayNotInventBidOrWinnerState!==true) fail("realtime projection guardrail missing");
  if(d?.optionalNotifications?.class!=="best_effort"||d.optionalNotifications.securityNotificationsExcluded!==true||d.optionalNotifications.criticalAuctionResultNotificationsExcluded!==true) fail("notification guardrail missing");

  const states=config?.states;
  if(!Array.isArray(states)||JSON.stringify(states.map(x=>x.id))!==JSON.stringify(["normal","constrained","degraded","recovery"])) fail("state order drift");
  if(states[0]?.optionalCapabilityReductionAllowed!==false) fail("normal state may not reduce capability");
  for(const state of states.slice(1)){if(state.optionalCapabilityReductionAllowed!==true) fail(`${state.id} state reduction flag drift`);}

  const a=config?.activationSemantics;
  if(a?.capacitySignalSourceTask!=="27.11"||a?.errorBudgetSourceTask!=="27.08"||a?.latencyTimeoutSourceTask!=="27.09"||a?.retrySourceTask!=="27.10") fail("activation source drift");
  for(const key of ["capacityThresholdsAloneDoNotAuthorizeTrafficDropping","degradationDecisionMustNameAffectedCapability","degradationDecisionMustNameTriggerEvidence","automaticActivationRequiresSeparatelyVerifiedRuntimeImplementation","thisTaskDoesNotClaimAutomaticRuntimeActivation"]){if(a?.[key]!==true) fail(`activation guardrail disabled: ${key}`);}

  const r=config?.recoverySemantics;
  for(const key of ["recoveryMustNotBeTimeOnly","recoveryRequiresTriggerConditionCleared","recoveryRequiresRelevantHealthEvidence","restoreProtectedCapabilitiesNotApplicableBecauseNeverDegraded","restoreOptionalCapabilitiesProgressively","flappingMustBeAvoided"]){if(r?.[key]!==true) fail(`recovery guardrail disabled: ${key}`);}

  if(config?.downstreamOwnership?.loadSheddingTask!=="27.13"||config?.downstreamOwnership?.scalingRunbookTask!=="27.14") fail("downstream ownership drift");

  const auth=config?.authority;
  if(auth?.authoritativeAuctionSource!=="postgresql"||auth?.degradationPolicyMayMutateAuthoritativeAuctionState!==false||auth?.degradationPolicyMayChooseWinner!==false||auth?.degradationPolicyMayCreateAcceptedBid!==false||auth?.realtimeProjectionAuthoritative!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noTrafficDroppingRulesInThisTask","noAdmissionControlRulesInThisTask","noCapacityCertificationInThisTask","noProviderSpecificShortcut","noMeasuredProductionBehaviorClaim","noSilentFeatureDisablement"]){if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);}

  if(pkg?.scripts?.["verify:graceful-degradation"]!=="node scripts/verify-graceful-degradation.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:graceful-degradation:self-test"]!=="node scripts/verify-graceful-degradation.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-graceful-degradation.mjs", "--self-test"]')) fail("27.12 missing from pre-gates");

  return {protectedCapabilities:protectedExpected.length,degradableClasses:Object.keys(d).length,states:states.length};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};
  reject("degrade authoritative bids",c=>{c.protectedCapabilities=c.protectedCapabilities.filter(x=>x!=="authoritative_bid_acceptance");});
  reject("realtime becomes authority",c=>{c.degradableCapabilities.realtimePresentation.mayNotBecomeAuthoritative=false;});
  reject("finalizer becomes deferable",c=>{c.degradableCapabilities.noncriticalBackgroundWork.criticalFinalizationWorkersExcluded=false;});
  reject("security notification becomes optional",c=>{c.degradableCapabilities.optionalNotifications.securityNotificationsExcluded=false;});
  reject("silent feature disablement",c=>{c.guardrails.noSilentFeatureDisablement=false;});
  reject("traffic dropping stolen",c=>{c.guardrails.noTrafficDroppingRulesInThisTask=false;});
  reject("timer-only recovery",c=>{c.recoverySemantics.recoveryMustNotBeTimeOnly=false;});
  reject("automatic runtime falsely claimed",c=>{c.reviewPolicy.runtimeActivationClaimed=true;});
  reject("degradation chooses winner",c=>{c.authority.degradationPolicyMayChooseWinner=true;});
  reject("load shedding ownership stolen",c=>{c.downstreamOwnership.loadSheddingTask="27.12";});

  const badSources=structuredClone(sources);
  badSources["27.11"].downstreamOwnership.gracefulDegradationTask="27.13";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-graceful-degradation.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`GRACEFUL_DEGRADATION_SELF_TEST PASS cases=${cases} protected=${result.protectedCapabilities} degradable_classes=${result.degradableClasses} states=${result.states} fail_closed=true`);
}else{
  console.log(`GRACEFUL_DEGRADATION PASS task=27.12 protected=${result.protectedCapabilities} degradable_classes=${result.degradableClasses} states=${result.states}`);
}
