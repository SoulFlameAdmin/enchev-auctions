import fs from "node:fs";
import { createFailureHarness, FAILURE_INJECTION_HARNESS_VERSION } from "../test/utils/failure-injection.mjs";

const CONFIG_PATH = "config/enchev-failure-injection-harness.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`FAILURE_INJECTION_HARNESS FAIL: ${message}`);
}

export function validateConfig(config, pkg, preGateSource) {
  if (config?.taskId !== "25.14") fail("taskId must be 25.14");
  if (config?.name !== "Failure-injection test harness") fail("name mismatch");
  if (config?.harnessVersion !== 1) fail("harnessVersion must be 1");

  const execution = config.execution;
  if (!execution || execution.mode !== "deterministic-local-simulation") fail("execution mode drift");
  if (execution.networkAccessRequired !== false) fail("network access must not be required");
  if (execution.productionMutationForbidden !== true) fail("production mutation must remain forbidden");
  if (execution.realProviderFaultInjectionForbidden !== true) fail("real provider fault injection must remain forbidden");

  const expected = [
    ["provider-timeout","retryable-failure"],
    ["provider-503","retryable-failure"],
    ["duplicate-delivery","idempotent-ignore"],
    ["sequence-gap","authoritative-resync-required"],
    ["malformed-event","reject"],
    ["controlled-clock-expiry","reject-late-operation"]
  ];
  const actual = (config.scenarios || []).map(item => [item.id, item.expected]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("scenario matrix drift");

  for (const key of ["failClosed","deterministic","noProductionData","noSecrets","retryBudgetBounded","duplicateProcessingForbidden","sequenceGapMustResync","browserClockNeverAuthoritative"]) {
    if (config.invariants?.[key] !== true) fail(`required invariant disabled: ${key}`);
  }
  for (const key of ["allScenariosMustPass","negativeSelfTestsMustPass","aggregateCiMustExecuteHarness","liveProductionFailureInjectionNotRequired","harnessMustNotClaimProviderOutageEvidence"]) {
    if (config.greenRules?.[key] !== true) fail(`GREEN rule disabled: ${key}`);
  }

  if (pkg?.scripts?.["verify:failure-injection-harness"] !== "node scripts/verify-failure-injection-harness.mjs") fail("package verify script drift");
  if (pkg?.scripts?.["verify:failure-injection-harness:self-test"] !== "node scripts/verify-failure-injection-harness.mjs --self-test") fail("package self-test script drift");
  if (pkg?.scripts?.test !== "node scripts/run-system-test-pre-gates.mjs && node scripts/run-ci-tests.mjs") {
    fail("aggregate npm test must use stable system pre-gates");
  }
  if (typeof preGateSource !== "string" || !preGateSource.includes('["scripts/verify-failure-injection-harness.mjs", "--self-test"]')) {
    fail("system pre-gates must include 25.14 self-test");
  }
}

export function runScenarioMatrix() {
  if (FAILURE_INJECTION_HARNESS_VERSION !== 1) fail("runtime harness version drift");

  const provider = createFailureHarness({ retryBudget: 2, authoritativeNow: 1000 });
  const timeout = provider.providerResult("timeout", 0);
  if (timeout.ok || timeout.action !== "retry" || timeout.remainingRetries !== 2) fail("provider timeout scenario failed");
  const unavailable = provider.providerResult("503", 2);
  if (unavailable.ok || unavailable.action !== "fail-closed" || unavailable.remainingRetries !== 0) fail("provider 503 retry-budget scenario failed");

  const events = createFailureHarness({ authoritativeNow: 1000 });
  const first = events.consumeEvent({ id: "evt-1", sequence: 1 });
  if (!first.ok || first.action !== "apply") fail("first event should apply");
  const duplicate = events.consumeEvent({ id: "evt-1", sequence: 1 });
  if (!duplicate.ok || duplicate.action !== "idempotent-ignore") fail("duplicate event must be ignored");
  const gap = events.consumeEvent({ id: "evt-3", sequence: 3 });
  if (gap.ok || gap.action !== "authoritative-resync-required" || gap.expectedSequence !== 2) fail("sequence gap must require resync");
  const malformed = events.consumeEvent({ id: "", sequence: 2 });
  if (malformed.ok || malformed.action !== "reject") fail("malformed event must be rejected");

  const clock = createFailureHarness({ authoritativeNow: 2000 });
  const accepted = clock.validateDeadline({ browserNow: 999999, deadline: 2000 });
  if (!accepted.ok || accepted.action !== "accept" || accepted.browserNowIgnored !== true) fail("browser clock must not decide valid deadline");
  const late = clock.validateDeadline({ browserNow: 0, deadline: 1999 });
  if (late.ok || late.action !== "reject-late-operation" || late.browserNowIgnored !== true) fail("late operation must fail closed on authoritative time");

  return { scenarios: 6 };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
validateConfig(config, pkg, preGateSource);
const result = runScenarioMatrix();

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const copy = structuredClone(config);
    mutate(copy);
    let rejected = false;
    try { validateConfig(copy, pkg, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("network required", c => { c.execution.networkAccessRequired = true; });
  reject("production mutation allowed", c => { c.execution.productionMutationForbidden = false; });
  reject("provider fault injection allowed", c => { c.execution.realProviderFaultInjectionForbidden = false; });
  reject("duplicate protection disabled", c => { c.invariants.duplicateProcessingForbidden = false; });
  reject("browser clock authoritative", c => { c.invariants.browserClockNeverAuthoritative = false; });
  reject("scenario removed", c => { c.scenarios.pop(); });

  let runtimeRejected = false;
  try { createFailureHarness({ retryBudget: 11 }); } catch { runtimeRejected = true; }
  if (!runtimeRejected) fail("runtime did not reject excessive retry budget");
  cases += 1;

  console.log(`FAILURE_INJECTION_HARNESS_SELF_TEST PASS cases=${cases} scenarios=${result.scenarios} deterministic=true production_mutation=false`);
} else {
  console.log(`FAILURE_INJECTION_HARNESS PASS task=25.14 scenarios=${result.scenarios} deterministic=true production_mutation=false`);
}
