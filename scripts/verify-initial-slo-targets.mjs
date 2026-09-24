import fs from "node:fs";

const CONFIG_PATH = "config/enchev-initial-slo-targets.json";
const SOURCE_PATHS = {
  "27.01": "config/enchev-critical-user-journey-slis.json",
  "27.02": "config/enchev-api-availability-sli.json",
  "27.03": "config/enchev-bid-acceptance-latency-sli.json",
  "27.04": "config/enchev-realtime-delivery-latency-sli.json",
  "27.05": "config/enchev-reconnect-success-sli.json",
  "27.06": "config/enchev-auction-finalization-success-sli.json"
};
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) { throw new Error(`INITIAL_SLO_TARGETS FAIL: ${message}`); }
function ratio(value, label) {
  if (typeof value !== "number" || value <= 0 || value > 1) fail(`${label} must be a ratio in (0,1]`);
}

export function validate(config, sources, pkg, preGateSource) {
  if (config?.taskId !== "27.07") fail("taskId must be 27.07");
  if (config?.name !== "Initial SLO targets") fail("name drift");
  if (config?.version !== 1) fail("version must be 1");
  if (config?.status !== "initial-provisional-policy") fail("policy status drift");
  if (config?.evaluationWindow?.type !== "rolling" || config?.evaluationWindow?.days !== 30) fail("evaluation window must be rolling 30 days");
  if (config?.evaluationWindow?.insufficientDataState !== "not_evaluable") fail("insufficient data must be not_evaluable");
  if (config?.evaluationWindow?.zeroTrafficMayNotCountAsCompliant !== true) fail("zero traffic cannot imply compliance");

  const expectedSources = ["27.01","27.02","27.03","27.04","27.05","27.06"];
  if (JSON.stringify(config?.sources) !== JSON.stringify(expectedSources)) fail("source task list drift");
  for (const id of expectedSources) {
    if (sources[id]?.taskId !== id) fail(`source task drift: ${id}`);
    if (sources[id]?.targetOwnershipTask !== "27.07") fail(`target ownership drift: ${id}`);
  }

  const journeys = sources["27.01"].journeys || [];
  const targetJourneys = config?.targets?.criticalJourneys || [];
  if (targetJourneys.length !== journeys.length) fail("critical journey target count drift");
  for (const target of targetJourneys) {
    const source = journeys.find(j => j.id === target.journeyId);
    if (!source) fail(`unknown journey target: ${target.journeyId}`);
    if (target.sli !== source.sli) fail(`journey SLI drift: ${target.journeyId}`);
    ratio(target.targetRatio, `journey target ${target.journeyId}`);
  }

  if (config?.targets?.apiAvailability?.sli !== sources["27.02"]?.indicator?.name) fail("API SLI drift");
  ratio(config.targets.apiAvailability.targetRatio, "API target");

  for (const [key, sourceId] of [["bidAcceptanceLatency","27.03"],["realtimeDeliveryLatency","27.04"]]) {
    const target = config?.targets?.[key];
    if (target?.sli !== sources[sourceId]?.indicator?.name) fail(`${key} SLI drift`);
    ratio(target?.complianceTargetRatio, `${key} compliance target`);
    if (target?.latencyBudgetReferenceTask !== "27.09") fail(`${key} latency budget must remain owned by 27.09`);
    if (target?.numericLatencyBudgetDefinedHere !== false) fail(`${key} must not define numeric latency budget here`);
  }

  if (config?.targets?.reconnectSuccess?.sli !== sources["27.05"]?.indicator?.name) fail("reconnect SLI drift");
  ratio(config.targets.reconnectSuccess.targetRatio, "reconnect target");
  if (config?.targets?.auctionFinalizationSuccess?.sli !== sources["27.06"]?.indicator?.name) fail("finalization SLI drift");
  ratio(config.targets.auctionFinalizationSuccess.targetRatio, "finalization target");

  const policy = config?.policy;
  if (policy?.targetsAreMeasuredResults !== false) fail("initial targets must not be presented as measured results");
  if (policy?.targetsAreInitialPolicyObjectives !== true || policy?.reviewAfterProductionEvidence !== true) fail("initial/review policy guardrail missing");
  if (policy?.errorBudgetPolicyOwnershipTask !== "27.08") fail("error budget ownership drift");
  if (policy?.latencyTimeoutBudgetOwnershipTask !== "27.09") fail("latency budget ownership drift");
  if (policy?.retryBudgetOwnershipTask !== "27.10") fail("retry budget ownership drift");
  if (policy?.capacityOwnershipTask !== "27.11") fail("capacity ownership drift");

  const g=config?.guardrails;
  for (const key of ["postgresqlRemainsAuthoritative","telemetryMayNotMutateAuctionState","noTelemetryDerivedAcceptedBid","noTelemetryDerivedWinner","noNumericLatencyOrTimeoutBudgetInThisTask","noRetryBudgetInThisTask","noErrorBudgetPolicyInThisTask"]) {
    if (g?.[key] !== true) fail(`guardrail disabled: ${key}`);
  }

  const serialized=JSON.stringify(config);
  if (/"(?:latency|timeout)(?:Ms|Millis|Milliseconds|Seconds)"\s*:\s*[0-9]/i.test(serialized)) fail("numeric latency/timeout budget invented in 27.07");
  if (/"retryBudget"\s*:\s*[0-9]/i.test(serialized)) fail("retry budget invented in 27.07");

  if (pkg?.scripts?.["verify:initial-slo-targets"] !== "node scripts/verify-initial-slo-targets.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:initial-slo-targets:self-test"] !== "node scripts/verify-initial-slo-targets.mjs --self-test") fail("package self-test script drift");
  if (!preGateSource.includes('["scripts/verify-initial-slo-targets.mjs", "--self-test"]')) fail("27.07 missing from pre-gates");
  return { targets: targetJourneys.length + 5 };
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const sources=Object.fromEntries(Object.entries(SOURCE_PATHS).map(([id,path])=>[id,JSON.parse(fs.readFileSync(path,"utf8"))]));
const pkg=JSON.parse(fs.readFileSync(PACKAGE_PATH,"utf8"));
const preGateSource=fs.readFileSync(PRE_GATE_PATH,"utf8");
const result=validate(config,sources,pkg,preGateSource);

if (process.argv.includes("--self-test")) {
  let cases=0;
  const reject=(label,mutate)=>{
    const c=structuredClone(config); mutate(c); let rejected=false;
    try { validate(c,sources,pkg,preGateSource); } catch { rejected=true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases+=1;
  };
  reject("zero traffic considered compliant", c=>{c.evaluationWindow.zeroTrafficMayNotCountAsCompliant=false;});
  reject("measured-result claim", c=>{c.policy.targetsAreMeasuredResults=true;});
  reject("invalid API ratio", c=>{c.targets.apiAvailability.targetRatio=1.1;});
  reject("missing journey target", c=>{c.targets.criticalJourneys.pop();});
  reject("latency budget owned here", c=>{c.targets.bidAcceptanceLatency.numericLatencyBudgetDefinedHere=true;});
  reject("latency budget owner drift", c=>{c.targets.realtimeDeliveryLatency.latencyBudgetReferenceTask="27.07";});
  reject("error budget policy added", c=>{c.guardrails.noErrorBudgetPolicyInThisTask=false;});
  reject("authority guardrail disabled", c=>{c.guardrails.postgresqlRemainsAuthoritative=false;});

  const badSources=structuredClone(sources);
  badSources["27.05"].targetOwnershipTask="99.99";
  let sourceRejected=false;
  try { validate(config,badSources,pkg,preGateSource); } catch { sourceRejected=true; }
  if (!sourceRejected) fail("source ownership drift self-test not rejected");
  cases+=1;

  let preGateRejected=false;
  try { validate(config,sources,pkg,preGateSource.replace('["scripts/verify-initial-slo-targets.mjs", "--self-test"]',"")); } catch { preGateRejected=true; }
  if (!preGateRejected) fail("pre-gate removal self-test not rejected");
  cases+=1;

  console.log(`INITIAL_SLO_TARGETS_SELF_TEST PASS cases=${cases} targets=${result.targets} fail_closed=true`);
} else {
  console.log(`INITIAL_SLO_TARGETS PASS task=27.07 targets=${result.targets} window_days=30`);
}
