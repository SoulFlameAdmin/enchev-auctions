import fs from "node:fs";

const CONFIG_PATH="config/enchev-scaling-runbook.json";
const SOURCE_PATHS={
  "27.08":"config/enchev-error-budget-policy.json",
  "27.09":"config/enchev-latency-timeout-budgets.json",
  "27.10":"config/enchev-retry-budgets.json",
  "27.11":"config/enchev-capacity-model.json",
  "27.12":"config/enchev-graceful-degradation.json",
  "27.13":"config/enchev-load-shedding.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`SCALING_RUNBOOK FAIL: ${message}`);}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.14") fail("taskId must be 27.14");
  if(config?.name!=="Scaling runbook") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-operational-runbook") fail("status drift");
  if(config?.scope!=="reliability-scaling-procedure") fail("scope drift");

  const expected=["27.08","27.09","27.10","27.11","27.12","27.13"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}
  if(sources["27.11"]?.downstreamOwnership?.scalingRunbookTask!=="27.14") fail("27.11 scaling ownership drift");
  if(sources["27.12"]?.downstreamOwnership?.scalingRunbookTask!=="27.14") fail("27.12 scaling ownership drift");
  if(sources["27.13"]?.downstreamOwnership?.scalingRunbookTask!=="27.14") fail("27.13 scaling ownership drift");

  const review=config?.reviewPolicy;
  if(review?.stepsAreMeasuredProductionResults!==false||review?.runbookIsInitialEngineeringProcedure!==true||review?.automatedScalerClaimed!==false||review?.providerSpecificSizingClaimed!==false||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy drift");

  const pre=config?.preconditions;
  for(const key of ["ownerAssigned","bottleneckDimensionMustBeIdentified","triggerEvidenceCaptured","authoritativeHealthBaselineCaptured","downstreamSaturationReviewed","rollbackPathDefinedBeforeScaling","changeCorrelationIdRequired"]){
    if(pre?.[key]!==true) fail(`precondition disabled: ${key}`);
  }

  const procedure=config?.procedure;
  const expectedSteps=["observe_confirm","stabilize","choose_action","execute_incrementally","verify_after_each_step","recover_optional_traffic","close_record"];
  if(!Array.isArray(procedure)||JSON.stringify(procedure.map(x=>x.id))!==JSON.stringify(expectedSteps)) fail("procedure order drift");
  for(const step of procedure){if(!Array.isArray(step.requires)||step.requires.length<3) fail(`procedure requirements missing: ${step.id}`);}

  const actions=config?.allowedActionClasses;
  for(const key of ["horizontalCapacity","verticalCapacity","workerConcurrency","connectionCapacity","scaleDown"]){if(actions?.[key]?.allowed!==true) fail(`action class disabled: ${key}`);}
  if(actions.horizontalCapacity.requiresStatelessOrSafePartitionSemantics!==true||actions.horizontalCapacity.downstreamCapacityMustBeConfirmed!==true) fail("horizontal scaling safety drift");
  if(actions.verticalCapacity.requiresProviderSpecificChangePlanOutsideThisContract!==true||actions.verticalCapacity.mustBeReversibleOrHaveExplicitRecoveryPlan!==true) fail("vertical scaling safety drift");
  if(actions.workerConcurrency.downstreamCapacityMustBeConfirmed!==true||actions.workerConcurrency.blindConcurrencyIncreaseForbidden!==true) fail("worker concurrency safety drift");
  if(actions.connectionCapacity.downstreamConnectionBudgetMustBeKnown!==true||actions.connectionCapacity.blindPoolIncreaseForbidden!==true) fail("connection scaling safety drift");
  if(actions.scaleDown.requiresStableHealthEvidence!==true||actions.scaleDown.uncertainCapacityRequiresConservativePosture!==true) fail("scale-down safety drift");

  const decision=config?.decisionSemantics;
  if(decision?.capacityModelSourceTask!=="27.11"||decision?.gracefulDegradationSourceTask!=="27.12"||decision?.loadSheddingSourceTask!=="27.13"||decision?.errorBudgetSourceTask!=="27.08"||decision?.latencyTimeoutSourceTask!=="27.09"||decision?.retrySourceTask!=="27.10") fail("decision source drift");
  for(const key of ["noUniversalScaleAmount","noUniversalInstanceCount","noUniversalConcurrencyValue","scaleActionMustTargetObservedBottleneck","scalingMayNotResetOrHideFailureTelemetry"]){if(decision?.[key]!==true) fail(`decision guardrail disabled: ${key}`);}

  const verification=config?.verification;
  for(const key of ["relevantCapacitySignalMustImproveOrRemainSafe","sloAndErrorBudgetMustNotWorsenWithoutExplicitIncidentDecision","latencyTimeoutAndRetryPressureMustBeChecked","authoritativeAuctionInvariantsMustPass","acceptedBidAndWinnerCorrectnessMustRemainIntact","degradationAndSheddingRecoveryMustBeEvidenceBased"]){if(verification?.[key]!==true) fail(`verification guardrail disabled: ${key}`);}

  const rollback=config?.rollback;
  for(const key of ["rollbackOnAuthoritativeInvariantFailure","rollbackOnDownstreamSaturationIncrease","rollbackOnMaterialHealthRegression","rollbackWhenExpectedSignalDoesNotImproveAndRiskIncreases","rollbackMustBeRecorded"]){if(rollback?.[key]!==true) fail(`rollback rule disabled: ${key}`);}

  const auth=config?.authority;
  if(auth?.authoritativeAuctionSource!=="postgresql"||auth?.scalingRunbookMayMutateAuctionState!==false||auth?.scalingRunbookMayChooseWinner!==false||auth?.scalingRunbookMayCreateAcceptedBid!==false||auth?.telemetryMayRewriteAuthoritativeState!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noBlindScaling","noBlindConcurrencyIncrease","noProviderSpecificProductionSizingInThisTask","noMeasuredProductionCapacityClaim","noScalingToMaskCorrectnessFailure","noScaleDownWithoutHealthEvidence","noSimultaneousUnverifiedScalingChanges"]){if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);}

  if(pkg?.scripts?.["verify:scaling-runbook"]!=="node scripts/verify-scaling-runbook.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:scaling-runbook:self-test"]!=="node scripts/verify-scaling-runbook.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-scaling-runbook.mjs", "--self-test"]')) fail("27.14 missing from pre-gates");

  return {steps:procedure.length,actionClasses:Object.keys(actions).length};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};

  reject("unknown bottleneck allowed",c=>{c.preconditions.bottleneckDimensionMustBeIdentified=false;});
  reject("rollback undefined",c=>{c.preconditions.rollbackPathDefinedBeforeScaling=false;});
  reject("blind worker concurrency",c=>{c.allowedActionClasses.workerConcurrency.blindConcurrencyIncreaseForbidden=false;});
  reject("unknown connection budget",c=>{c.allowedActionClasses.connectionCapacity.downstreamConnectionBudgetMustBeKnown=false;});
  reject("scale down without evidence",c=>{c.allowedActionClasses.scaleDown.requiresStableHealthEvidence=false;});
  reject("universal scale amount",c=>{c.decisionSemantics.noUniversalScaleAmount=false;});
  reject("mask failure telemetry",c=>{c.decisionSemantics.scalingMayNotResetOrHideFailureTelemetry=false;});
  reject("skip authoritative verification",c=>{c.verification.authoritativeAuctionInvariantsMustPass=false;});
  reject("no rollback on invariant failure",c=>{c.rollback.rollbackOnAuthoritativeInvariantFailure=false;});
  reject("scaling chooses winner",c=>{c.authority.scalingRunbookMayChooseWinner=true;});
  reject("stack unverified changes",c=>{c.guardrails.noSimultaneousUnverifiedScalingChanges=false;});
  reject("claim provider sizing",c=>{c.reviewPolicy.providerSpecificSizingClaimed=true;});

  const badSources=structuredClone(sources);
  badSources["27.13"].downstreamOwnership.scalingRunbookTask="27.15";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-scaling-runbook.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`SCALING_RUNBOOK_SELF_TEST PASS cases=${cases} steps=${result.steps} action_classes=${result.actionClasses} fail_closed=true`);
}else{
  console.log(`SCALING_RUNBOOK PASS task=27.14 steps=${result.steps} action_classes=${result.actionClasses}`);
}
