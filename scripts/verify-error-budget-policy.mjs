import fs from "node:fs";

const CONFIG_PATH = "config/enchev-error-budget-policy.json";
const SLO_PATH = "config/enchev-initial-slo-targets.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) { throw new Error(`ERROR_BUDGET_POLICY FAIL: ${message}`); }
function close(a,b){ return Math.abs(a-b) < 1e-12; }

function expectedCatalog(slo) {
  const j=Object.fromEntries((slo?.targets?.criticalJourneys||[]).map(x=>[x.journeyId,x.targetRatio]));
  return [
    ["journey.inventory_discovery", j.inventory_discovery, true, null],
    ["journey.lot_detail", j.lot_detail, true, null],
    ["journey.live_auction_view", j.live_auction_view, true, null],
    ["journey.bid_submission", j.bid_submission, true, null],
    ["journey.auction_result_visibility", j.auction_result_visibility, true, null],
    ["api.availability", slo?.targets?.apiAvailability?.targetRatio, true, null],
    ["bid.acceptance_latency", slo?.targets?.bidAcceptanceLatency?.complianceTargetRatio, false, "27.09"],
    ["realtime.delivery_latency", slo?.targets?.realtimeDeliveryLatency?.complianceTargetRatio, false, "27.09"],
    ["reconnect.success", slo?.targets?.reconnectSuccess?.targetRatio, true, null],
    ["auction.finalization_success", slo?.targets?.auctionFinalizationSuccess?.targetRatio, true, null]
  ];
}

export function validate(config,slo,pkg,preGateSource){
  if(config?.taskId!=="27.08") fail("taskId must be 27.08");
  if(config?.name!=="Error-budget policy") fail("name drift");
  if(config?.version!==1) fail("version must be 1");
  if(config?.scope!=="policy-contract-only") fail("scope drift");
  if(config?.sloSourceTask!=="27.07" || config?.evaluationWindowSourceTask!=="27.07") fail("27.07 ownership drift");
  if(slo?.taskId!=="27.07") fail("SLO source task drift");

  const d=config?.budgetDefinition;
  if(d?.formula!=="allowed_bad_fraction = 1 - slo_target_ratio") fail("budget formula drift");
  if(d?.consumptionFormula!=="consumed_fraction_of_budget = observed_bad_fraction / allowed_bad_fraction") fail("consumption formula drift");
  if(d?.remainingFormula!=="remaining_fraction_of_budget = max(0, 1 - consumed_fraction_of_budget)") fail("remaining formula drift");
  if(d?.unit!=="eligible_events_or_samples") fail("budget unit drift");
  for(const key of ["budgetsArePerSloIndependent","crossSloBudgetTransferForbidden","manualBudgetResetForbidden","targetRelaxationToRestoreBudgetForbidden","exclusionExpansionToRestoreBudgetForbidden"]){
    if(d?.[key]!==true) fail(`budget guardrail disabled: ${key}`);
  }
  if(d?.absoluteDowntimeMinutesDefinedHere!==false) fail("27.08 must not invent absolute downtime minutes");

  const expected=expectedCatalog(slo);
  if(!Array.isArray(config?.budgetCatalog) || config.budgetCatalog.length!==expected.length) fail("budget catalog count drift");
  for(let i=0;i<expected.length;i++){
    const [id,target,evaluable,blockedBy]=expected[i];
    const item=config.budgetCatalog[i];
    if(item?.id!==id) fail(`budget id/order drift: ${id}`);
    if(typeof target!=="number" || target<=0 || target>=1) fail(`source target invalid: ${id}`);
    if(!close(item?.targetRatio,target)) fail(`target ratio drift: ${id}`);
    if(!close(item?.allowedBadFraction,1-target)) fail(`allowed bad fraction must equal 1-target: ${id}`);
    if(item?.evaluableNow!==evaluable) fail(`evaluable state drift: ${id}`);
    if(blockedBy && item?.blockedByTask!==blockedBy) fail(`blockedByTask drift: ${id}`);
    if(!blockedBy && "blockedByTask" in item) fail(`unexpected blockedByTask: ${id}`);
  }

  const e=config?.evaluation;
  if(e?.windowType!=="rolling" || e?.windowDays!==30) fail("evaluation window must remain rolling 30 days");
  if(slo?.evaluationWindow?.type!=="rolling" || slo?.evaluationWindow?.days!==30) fail("27.07 window drift");
  if(e?.insufficientDataState!=="not_evaluable") fail("insufficient data state drift");
  if(e?.zeroTrafficMayNotCountAsCompliant!==true) fail("zero traffic cannot imply compliance");
  if(e?.unknownOutcomeSemanticsInheritedFromSli!==true) fail("unknown outcome semantics must remain inherited from SLI");
  if(e?.latencyBudgetsWithout27_09State!=="not_evaluable_until_27.09") fail("latency pre-27.09 state drift");
  if(e?.observedPerformanceClaimedHere!==false) fail("27.08 cannot claim observed production performance");

  const states=config?.states||[];
  const ids=states.map(s=>s.id);
  if(JSON.stringify(ids)!==JSON.stringify(["healthy","watch","restricted","exhausted","not_evaluable"])) fail("budget state order/set drift");
  const healthy=states[0], watch=states[1], restricted=states[2], exhausted=states[3];
  if(healthy.remainingBudgetFractionAbove!==0.5) fail("healthy threshold drift");
  if(watch.remainingBudgetFractionAtMost!==0.5 || watch.remainingBudgetFractionAbove!==0.25) fail("watch threshold drift");
  if(restricted.remainingBudgetFractionAtMost!==0.25 || restricted.remainingBudgetFractionAbove!==0) fail("restricted threshold drift");
  if(exhausted.remainingBudgetFractionAtMost!==0) fail("exhausted threshold drift");
  if(exhausted.action!=="freeze_nonessential_risk_increasing_production_changes") fail("exhausted action drift");

  const cp=config?.changePolicy;
  for(const key of ["securityFixesMayProceedWhenExhausted","incidentMitigationMayProceedWhenExhausted","approvedEmergencyChangesMayProceedWhenExhausted","emergencyChangeRequiresExplicitApproval","emergencyChangeRequiresRollbackPlan","nonessentialRiskIncreasingChangesFrozenWhenExhausted","budgetExhaustionDoesNotAuthorizeUnsafeRollbackOrDataMutation"]){
    if(cp?.[key]!==true) fail(`change policy guardrail disabled: ${key}`);
  }

  const rp=config?.recoveryPolicy;
  for(const key of ["naturalRollingWindowRecoveryAllowed","authoritativeTelemetryCorrectionAllowed","manualResetForbidden","targetChangeRequiresSeparateEvidenceAndApproval","sliSemanticRewriteToRestoreBudgetForbidden"]){
    if(rp?.[key]!==true) fail(`recovery guardrail disabled: ${key}`);
  }

  if(config?.ownership?.latencyTimeoutBudgetsTask!=="27.09") fail("latency budget ownership drift");
  if(config?.ownership?.retryBudgetsTask!=="27.10") fail("retry budget ownership drift");
  if(config?.ownership?.capacityModelTask!=="27.11") fail("capacity ownership drift");
  if(config?.ownership?.gracefulDegradationTask!=="27.12") fail("degradation ownership drift");
  if(config?.ownership?.loadSheddingTask!=="27.13") fail("load shedding ownership drift");

  const g=config?.guardrails;
  for(const key of ["postgresqlRemainsAuthoritative","telemetryMayNotMutateAuctionState","noTelemetryDerivedAcceptedBid","noTelemetryDerivedWinner","noNumericLatencyOrTimeoutBudgetInThisTask","noRetryBudgetInThisTask","noCapacityLimitInThisTask","policyDoesNotClaimMeasuredProductionPerformance"]){
    if(g?.[key]!==true) fail(`guardrail disabled: ${key}`);
  }

  const serialized=JSON.stringify(config);
  if(/"(?:latency|timeout)(?:Ms|Millis|Milliseconds|Seconds)"\s*:\s*[0-9]/i.test(serialized)) fail("numeric latency/timeout budget invented in 27.08");
  if(/"retryBudget"\s*:\s*[0-9]/i.test(serialized)) fail("retry budget invented in 27.08");
  if(/"downtimeMinutes"\s*:\s*[0-9]/i.test(serialized)) fail("downtime minutes invented in 27.08");

  if(pkg?.scripts?.["verify:error-budget-policy"]!=="node scripts/verify-error-budget-policy.mjs") fail("package verify script drift");
  if(pkg?.scripts?.["verify:error-budget-policy:self-test"]!=="node scripts/verify-error-budget-policy.mjs --self-test") fail("package self-test script drift");
  if(!preGateSource.includes('["scripts/verify-error-budget-policy.mjs", "--self-test"]')) fail("27.08 missing from pre-gates");
  return {budgets:expected.length,evaluable:expected.filter(x=>x[2]).length};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const slo=JSON.parse(fs.readFileSync(SLO_PATH,"utf8"));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,slo,pkg,preGateSource);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{
    const c=structuredClone(config); mutate(c); let rejected=false;
    try{validate(c,slo,pkg,preGateSource);}catch{rejected=true;}
    if(!rejected) fail(`negative self-test not rejected: ${label}`);
    cases+=1;
  };
  reject("budget transfer allowed",c=>{c.budgetDefinition.crossSloBudgetTransferForbidden=false;});
  reject("manual reset allowed",c=>{c.recoveryPolicy.manualResetForbidden=false;});
  reject("target relaxation allowed",c=>{c.budgetDefinition.targetRelaxationToRestoreBudgetForbidden=false;});
  reject("wrong allowed fraction",c=>{c.budgetCatalog[0].allowedBadFraction=0.02;});
  reject("latency prematurely evaluable",c=>{c.budgetCatalog.find(x=>x.id==="bid.acceptance_latency").evaluableNow=true;});
  reject("zero traffic considered compliant",c=>{c.evaluation.zeroTrafficMayNotCountAsCompliant=false;});
  reject("security fixes blocked",c=>{c.changePolicy.securityFixesMayProceedWhenExhausted=false;});
  reject("emergency approval removed",c=>{c.changePolicy.emergencyChangeRequiresExplicitApproval=false;});
  reject("exhausted freeze removed",c=>{c.changePolicy.nonessentialRiskIncreasingChangesFrozenWhenExhausted=false;});
  reject("production metrics falsely claimed",c=>{c.evaluation.observedPerformanceClaimedHere=true;});
  reject("latency milliseconds invented",c=>{c.latencyMs=250;});

  const badSlo=structuredClone(slo);
  badSlo.targets.apiAvailability.targetRatio=0.998;
  let sourceRejected=false;
  try{validate(config,badSlo,pkg,preGateSource);}catch{sourceRejected=true;}
  if(!sourceRejected) fail("source target drift self-test not rejected");
  cases+=1;

  let preGateRejected=false;
  try{validate(config,slo,pkg,preGateSource.replace('["scripts/verify-error-budget-policy.mjs", "--self-test"]',""));}catch{preGateRejected=true;}
  if(!preGateRejected) fail("pre-gate removal self-test not rejected");
  cases+=1;

  console.log(`ERROR_BUDGET_POLICY_SELF_TEST PASS cases=${cases} budgets=${result.budgets} evaluable_now=${result.evaluable} fail_closed=true`);
}else{
  console.log(`ERROR_BUDGET_POLICY PASS task=27.08 budgets=${result.budgets} evaluable_now=${result.evaluable}`);
}
