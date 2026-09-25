import fs from "node:fs";

const CONFIG_PATH="config/enchev-capacity-model.json";
const SOURCE_PATHS={
  "27.03":"config/enchev-bid-acceptance-latency-sli.json",
  "27.04":"config/enchev-realtime-delivery-latency-sli.json",
  "27.05":"config/enchev-reconnect-success-sli.json",
  "27.06":"config/enchev-auction-finalization-success-sli.json",
  "27.07":"config/enchev-initial-slo-targets.json",
  "27.08":"config/enchev-error-budget-policy.json",
  "27.09":"config/enchev-latency-timeout-budgets.json",
  "27.10":"config/enchev-retry-budgets.json"
};
const PACKAGE_PATH="package.json";
const PRE_GATE_PATH="scripts/run-system-test-pre-gates.mjs";

function fail(message){throw new Error(`CAPACITY_MODEL FAIL: ${message}`);}
function fraction(value,label){if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>=1) fail(`${label} must be > 0 and < 1`);}
function uncertifiedDimension(value,label){
  if(!value||typeof value!=="object") fail(`${label} missing`);
  if(value.validatedCapacity!==null) fail(`${label} must not claim validated capacity without load evidence`);
  if(value.certificationState!=="uncertified") fail(`${label} must default to uncertified`);
  if(typeof value.unit!=="string"||!value.unit) fail(`${label} unit missing`);
  if(typeof value.measurementBoundary!=="string"||!value.measurementBoundary) fail(`${label} measurement boundary missing`);
}

export function validate(config,sources,pkg,preGateSource){
  if(config?.taskId!=="27.11") fail("taskId must be 27.11");
  if(config?.name!=="Capacity model") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.status!=="initial-provisional-model") fail("status drift");
  if(config?.scope!=="engineering-capacity-model") fail("scope drift");

  const expected=["27.03","27.04","27.05","27.06","27.07","27.08","27.09","27.10"];
  if(JSON.stringify(config?.sources)!==JSON.stringify(expected)) fail("source task list drift");
  for(const id of expected){if(sources[id]?.taskId!==id) fail(`source task drift: ${id}`);}

  if(sources["27.07"]?.policy?.capacityOwnershipTask!=="27.11") fail("27.07 capacity ownership drift");
  if(sources["27.08"]?.ownership?.capacityModelTask!=="27.11") fail("27.08 capacity ownership drift");
  if(sources["27.09"]?.semantics?.capacityOwnershipTask!=="27.11") fail("27.09 capacity ownership drift");
  if(sources["27.10"]?.globalSemantics?.capacityOwnershipTask!=="27.11") fail("27.10 capacity ownership drift");

  const review=config?.reviewPolicy;
  if(review?.valuesAreMeasuredProductionResults!==false) fail("capacity model must not claim measured production results");
  if(review?.valuesAreCertifiedProductionLimits!==false) fail("capacity model must not claim certified production limits");
  if(review?.valuesAreInitialPlanningAssumptions!==true||review?.representativeLoadEvidenceRequiredForCertification!==true||review?.changeRequiresEvidenceAndApproval!==true) fail("review policy guardrail missing");

  const d=config?.capacityDimensions;
  const requiredDimensions=["authoritativeBidCommands","realtimeDeliveries","concurrentRealtimeConnections","reconnectRecovery","auctionFinalization","concurrentLiveAuctions"];
  for(const key of requiredDimensions) uncertifiedDimension(d?.[key],key);
  if(d.authoritativeBidCommands.sourceTask!=="27.03"||d.authoritativeBidCommands.timeoutSourceTask!=="27.09"||d.authoritativeBidCommands.retrySourceTask!=="27.10") fail("bid capacity source drift");
  if(d.realtimeDeliveries.sourceTask!=="27.04"||d.realtimeDeliveries.timeoutSourceTask!=="27.09"||d.realtimeDeliveries.retrySourceTask!=="27.10") fail("realtime capacity source drift");
  if(d.concurrentRealtimeConnections.sourceTask!=="27.04") fail("connection capacity source drift");
  if(d.reconnectRecovery.sourceTask!=="27.05"||d.reconnectRecovery.timeoutSourceTask!=="27.09"||d.reconnectRecovery.retrySourceTask!=="27.10") fail("reconnect capacity source drift");
  if(d.auctionFinalization.sourceTask!=="27.06"||d.auctionFinalization.timeoutSourceTask!=="27.09"||d.auctionFinalization.retrySourceTask!=="27.10") fail("finalization capacity source drift");
  if(d.concurrentLiveAuctions.sourceTask!=="27.01") fail("live-auction capacity source drift");

  const model=config?.derivedModel;
  if(model?.utilizationFormula!=="observed_demand / validated_capacity") fail("utilization formula drift");
  if(model?.headroomFormula!=="1 - utilization") fail("headroom formula drift");
  if(model?.realtimeFanoutDemandFormula!=="sum(event_rate_per_room * active_subscribers_per_room)") fail("fanout formula drift");
  for(const key of ["uncertifiedWhenValidatedCapacityMissing","divisionByZeroForbidden","negativeDemandForbidden","crossDimensionCapacitySubstitutionForbidden"]){if(model?.[key]!==true) fail(`derived-model guardrail disabled: ${key}`);}

  const p=config?.planningThresholds;
  fraction(p?.minimumTargetHeadroomFraction,"minimum headroom");
  fraction(p?.scaleReviewUtilizationFraction,"scale review");
  fraction(p?.capacityWatchUtilizationFraction,"capacity watch");
  fraction(p?.capacityCriticalUtilizationFraction,"capacity critical");
  if(p.minimumTargetHeadroomFraction!==0.30) fail("headroom target drift");
  if(p.scaleReviewUtilizationFraction!==0.60||p.capacityWatchUtilizationFraction!==0.70||p.capacityCriticalUtilizationFraction!==0.85) fail("planning threshold drift");
  if(!(p.scaleReviewUtilizationFraction<p.capacityWatchUtilizationFraction&&p.capacityWatchUtilizationFraction<p.capacityCriticalUtilizationFraction)) fail("planning thresholds must be monotonic");
  if(Math.abs((1-p.capacityWatchUtilizationFraction)-p.minimumTargetHeadroomFraction)>1e-12) fail("watch utilization must preserve target headroom");
  if(p.thresholdsArePlanningSignalsNotMeasuredResults!==true||p.thresholdsDoNotAuthorizeTrafficDropping!==true||p.thresholdsDoNotAuthorizeFeatureDegradation!==true) fail("planning threshold semantics drift");

  const cert=config?.certification;
  if(cert?.defaultState!=="uncertified"||cert?.validatedCapacityMustComeFromRepresentativeLoadEvidence!==true||cert?.sloMustRemainSatisfiedAtValidatedCapacity!==true) fail("certification basis drift");
  if(cert?.errorBudgetSemanticsSourceTask!=="27.08"||cert?.latencyTimeoutSemanticsSourceTask!=="27.09"||cert?.retrySemanticsSourceTask!=="27.10") fail("certification source drift");
  if(cert?.authoritativeStateInvariantsMustPass!==true||cert?.noWinnerCorruptionUnderLoadRequired!==true||cert?.loadTestPhase!=="18"||cert?.productionLimitClaimForbiddenUntilCertified!==true) fail("certification safety guardrail missing");

  const downstream=config?.downstreamOwnership;
  if(downstream?.gracefulDegradationTask!=="27.12"||downstream?.loadSheddingTask!=="27.13"||downstream?.scalingRunbookTask!=="27.14") fail("downstream ownership drift");

  const a=config?.authority;
  if(a?.authoritativeAuctionSource!=="postgresql"||a?.capacityTelemetryMayMutateAuctionState!==false||a?.capacityModelMayChooseWinner!==false||a?.capacityModelMayCreateAcceptedBid!==false||a?.realtimeTransportAuthoritative!==false) fail("authority boundary drift");

  const g=config?.guardrails;
  for(const key of ["noInventedProductionCapacity","noCertifiedLimitWithoutLoadEvidence","noGracefulDegradationRulesInThisTask","noLoadSheddingRulesInThisTask","noScalingRunbookInThisTask","noMeasuredProductionPerformanceClaim","noProviderSpecificShortcut"]){if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);}

  if(pkg?.scripts?.["verify:capacity-model"]!=="node scripts/verify-capacity-model.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:capacity-model:self-test"]!=="node scripts/verify-capacity-model.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-capacity-model.mjs", "--self-test"]')) fail("27.11 missing from pre-gates");

  return {dimensions:requiredDimensions.length,headroomTarget:p.minimumTargetHeadroomFraction,certificationState:cert.defaultState};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{const c=structuredClone(config);mutate(c);let rejected=false;try{validate(c,sources,pkg,preGateSource);}catch{rejected=true;}if(!rejected) fail(`negative self-test not rejected: ${label}`);cases+=1;};

  reject("invented bid capacity",c=>{c.capacityDimensions.authoritativeBidCommands.validatedCapacity=100;});
  reject("false certification",c=>{c.capacityDimensions.realtimeDeliveries.certificationState="certified";});
  reject("measured result claim",c=>{c.reviewPolicy.valuesAreMeasuredProductionResults=true;});
  reject("certified limit claim",c=>{c.reviewPolicy.valuesAreCertifiedProductionLimits=true;});
  reject("load evidence not required",c=>{c.certification.validatedCapacityMustComeFromRepresentativeLoadEvidence=false;});
  reject("winner safety removed",c=>{c.certification.noWinnerCorruptionUnderLoadRequired=false;});
  reject("capacity mutates state",c=>{c.authority.capacityTelemetryMayMutateAuctionState=true;});
  reject("capacity chooses winner",c=>{c.authority.capacityModelMayChooseWinner=true;});
  reject("load shedding stolen",c=>{c.downstreamOwnership.loadSheddingTask="27.11";});
  reject("nonmonotonic thresholds",c=>{c.planningThresholds.capacityWatchUtilizationFraction=0.50;});
  reject("headroom mismatch",c=>{c.planningThresholds.minimumTargetHeadroomFraction=0.20;});
  reject("cross dimension substitution allowed",c=>{c.derivedModel.crossDimensionCapacitySubstitutionForbidden=false;});

  const badSources=structuredClone(sources);
  badSources["27.10"].globalSemantics.capacityOwnershipTask="27.12";
  let sourceRejected=false;try{validate(config,badSources,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source ownership drift self-test not rejected");cases+=1;

  let preGateRejected=false;try{validate(config,sources,pkg,preGateSource.replace('["scripts/verify-capacity-model.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");cases+=1;

  console.log(`CAPACITY_MODEL_SELF_TEST PASS cases=${cases} dimensions=${result.dimensions} headroom_target=${result.headroomTarget} certification=${result.certificationState} fail_closed=true`);
}else{
  console.log(`CAPACITY_MODEL PASS task=27.11 dimensions=${result.dimensions} headroom_target=${result.headroomTarget} certification=${result.certificationState}`);
}
