import fs from "node:fs";

const CONFIG_PATH="config/enchev-load-shedding.json";
const SOURCE_PATHS={
  "27.08":"config/enchev-error-budget-policy.json",
  "27.09":"config/enchev-latency-timeout-budgets.json",
  "27.10":"config/enchev-retry-budgets.json",
  "27.11":"config/enchev-capacity-model.json",
  "27.12":"config/enchev-graceful-degradation.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`LOAD_SHEDDING FAIL: ${message}`);}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.13") fail("taskId must be 27.13");
  if(config?.name!=="Load-shedding rules") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-provisional-policy") fail("status drift");
  if(config?.scope!=="reliability-admission-control-policy") fail("scope drift");

  const expected=["27.08","27.09","27.10","27.11","27.12"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}
  if(sources["27.10"]?.globalSemantics?.loadSheddingOwnershipTask!=="27.13") fail("27.10 shedding ownership drift");
  if(sources["27.11"]?.downstreamOwnership?.loadSheddingTask!=="27.13") fail("27.11 shedding ownership drift");
  if(sources["27.12"]?.downstreamOwnership?.loadSheddingTask!=="27.13") fail("27.12 shedding ownership drift");

  const review=config?.reviewPolicy;
  if(review?.rulesAreMeasuredProductionBehavior!==false||review?.rulesAreInitialEngineeringPolicy!==true||review?.runtimeActivationClaimed!==false||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy drift");

  const principles=config?.principles;
  for(const key of ["shedOptionalLoadBeforeCriticalAuctionLoad","rejectBeforeAuthoritativeMutation","neverReturnSuccessForShedAuthoritativeCommand","neverDropAlreadyAcceptedAuthoritativeState","sheddingMustBeObservableAndAuditable","sheddingMustBeFairAndNonDiscriminatory"]){
    if(principles?.[key]!==true) fail(`principle disabled: ${key}`);
  }

  const classes=config?.trafficClasses;
  if(!Array.isArray(classes)||classes.length!==4) fail("traffic classes must contain four ordered classes");
  const ids=classes.map(x=>x.id);
  if(JSON.stringify(ids)!==JSON.stringify(["optional","noncritical_read","recovery_read","critical_authoritative"])) fail("traffic class order drift");
  const priorities=classes.map(x=>x.priority);
  if(JSON.stringify(priorities)!==JSON.stringify([4,3,2,1])) fail("traffic priority drift");
  if(classes[0]?.firstToShed!==true) fail("optional traffic must be first to shed");
  if(classes.slice(1).some(x=>x.firstToShed!==false)) fail("only optional traffic may be first-to-shed");

  const cmd=config?.authoritativeCommandSemantics;
  for(const key of ["bidAdmissionDecisionOccursBeforeMutation","shedBidMustReturnExplicitFailure","shedBidMayNotBeRecordedAsAccepted","unknownBidOutcomeRequiresAuthoritativeRead","finalizationMayNotBeSilentlyDropped","alreadyCommittedStateMayNotBeRolledBackByShedding"]){
    if(cmd?.[key]!==true) fail(`authoritative command guardrail disabled: ${key}`);
  }
  if(cmd?.retryPolicySourceTask!=="27.10") fail("retry policy source drift");

  const fairness=config?.fairness;
  for(const key of ["noUserSpecificPreferentialAdmission","noPricingTierPreferentialBidAdmission","noGeographicPreferentialBidAdmission","noOpaqueRandomBidDropping","sameClassUsesDeterministicPolicy","policyDecisionMustBeExplainableFromTelemetryAndClass"]){
    if(fairness?.[key]!==true) fail(`fairness guardrail disabled: ${key}`);
  }

  const activation=config?.activationSemantics;
  if(activation?.capacitySignalSourceTask!=="27.11"||activation?.gracefulDegradationSourceTask!=="27.12"||activation?.errorBudgetSourceTask!=="27.08"||activation?.latencyTimeoutSourceTask!=="27.09") fail("activation source drift");
  for(const key of ["capacityThresholdsArePlanningSignalsOnly","automaticActivationRequiresCertifiedCapacityAndVerifiedRuntime","thisTaskDoesNotClaimAutomaticRuntimeActivation","thisTaskDefinesPriorityAndSafetyRulesNotNewCapacityThresholds"]){
    if(activation?.[key]!==true) fail(`activation guardrail disabled: ${key}`);
  }

  const response=config?.responseSemantics;
  for(const key of ["explicitRetryableOverloadResponseRequiredWhereRetryIsSafe","retryAfterMayOnlyBeEmittedWhenAuthoritativelyKnown","retryAfterMustNotBeInvented","validationPermissionAndPermanentFailuresRemainNonRetryable","telemetryMustRecordClassDecisionAndReason"]){
    if(response?.[key]!==true) fail(`response guardrail disabled: ${key}`);
  }

  const recovery=config?.recoverySemantics;
  for(const key of ["restoreHigherPriorityTrafficBeforeOptionalTraffic","recoveryRequiresPressureCleared","recoveryRequiresHealthEvidence","recoveryMustAvoidFlapping","optionalTrafficRestoredProgressively"]){
    if(recovery?.[key]!==true) fail(`recovery guardrail disabled: ${key}`);
  }

  if(config?.downstreamOwnership?.scalingRunbookTask!=="27.14") fail("scaling runbook ownership drift");

  const auth=config?.authority;
  if(auth?.authoritativeAuctionSource!=="postgresql"||auth?.loadSheddingPolicyMayMutateAuctionState!==false||auth?.loadSheddingPolicyMayChooseWinner!==false||auth?.loadSheddingPolicyMayCreateAcceptedBid!==false||auth?.realtimeProjectionAuthoritative!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noSilentAuthoritativeCommandDrop","noFakeSuccess","noCapacityCertificationInThisTask","noScalingRunbookInThisTask","noProviderSpecificShortcut","noMeasuredProductionBehaviorClaim"]){
    if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);
  }

  if(pkg?.scripts?.["verify:load-shedding"]!=="node scripts/verify-load-shedding.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:load-shedding:self-test"]!=="node scripts/verify-load-shedding.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-load-shedding.mjs", "--self-test"]')) fail("27.13 missing from pre-gates");

  return {classes:classes.length,protectedPriority:classes.at(-1).priority};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};

  reject("optional not first",c=>{c.trafficClasses[0].firstToShed=false;});
  reject("fake shed success",c=>{c.principles.neverReturnSuccessForShedAuthoritativeCommand=false;});
  reject("bid recorded accepted",c=>{c.authoritativeCommandSemantics.shedBidMayNotBeRecordedAsAccepted=false;});
  reject("silent finalization drop",c=>{c.authoritativeCommandSemantics.finalizationMayNotBeSilentlyDropped=false;});
  reject("pricing tier favoritism",c=>{c.fairness.noPricingTierPreferentialBidAdmission=false;});
  reject("opaque random bid drop",c=>{c.fairness.noOpaqueRandomBidDropping=false;});
  reject("invent retry-after",c=>{c.responseSemantics.retryAfterMustNotBeInvented=false;});
  reject("automatic runtime falsely claimed",c=>{c.reviewPolicy.runtimeActivationClaimed=true;});
  reject("uncertified capacity activates runtime",c=>{c.activationSemantics.automaticActivationRequiresCertifiedCapacityAndVerifiedRuntime=false;});
  reject("shedding chooses winner",c=>{c.authority.loadSheddingPolicyMayChooseWinner=true;});
  reject("scaling ownership stolen",c=>{c.downstreamOwnership.scalingRunbookTask="27.13";});

  const badSources=structuredClone(sources);
  badSources["27.12"].downstreamOwnership.loadSheddingTask="27.14";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-load-shedding.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`LOAD_SHEDDING_SELF_TEST PASS cases=${cases} classes=${result.classes} protected_priority=${result.protectedPriority} fail_closed=true`);
}else{
  console.log(`LOAD_SHEDDING PASS task=27.13 classes=${result.classes} protected_priority=${result.protectedPriority}`);
}
