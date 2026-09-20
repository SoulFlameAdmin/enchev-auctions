import fs from "node:fs";

const CONFIG_PATH = "config/enchev-flaky-test-policy.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`FLAKY_TEST_POLICY FAIL: ${message}`);
}

export function validate(config, runnerSource, packageJson) {
  if (config?.taskId !== "25.08") fail("taskId must be 25.08");
  if (config?.name !== "Flaky-test policy") fail("name mismatch");

  for (const key of [
    "failuresAreEvidence",
    "blindRetriesForbidden",
    "sameShaRetryOnly",
    "originalFailureMustRemainVisible",
    "retrySuccessDoesNotEraseFailureHistory",
    "productDefectsMustNotBeClassifiedAsFlaky",
    "deterministicRootCausePreferred"
  ]) {
    if (config.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  const allowed = new Set([
    "runner-infrastructure-transient",
    "external-service-transient",
    "browser-process-startup-transient",
    "network-transport-transient"
  ]);
  const actual = config.classification?.allowedFlakeClasses;
  if (!Array.isArray(actual) || actual.length !== allowed.size || actual.some(x => !allowed.has(x))) {
    fail("allowed flake classes drift");
  }
  if (config.classification?.requiresConcreteLogs !== true) fail("concrete logs required");
  if (config.classification?.requiresExactFailureSignature !== true) fail("exact failure signature required");
  if (config.classification?.requiresSameCommitShaForRetryEvidence !== true) fail("same SHA retry evidence required");

  if (config.retryPolicy?.automaticTestBodyRetries !== 0) fail("automatic test body retries must be zero");
  if (config.retryPolicy?.targetedWorkflowRetryMax !== 1) fail("targeted workflow retry max must be one");
  if (config.retryPolicy?.targetedRetryRequiresClassification !== true) fail("retry classification required");
  if (config.retryPolicy?.targetedRetryRequiresUnchangedCode !== true) fail("retry requires unchanged code");
  if (config.retryPolicy?.targetedRetryRequiresRecordedFailure !== true) fail("retry requires recorded failure");
  if (config.retryPolicy?.retryOfProductAssertionFailure !== "forbidden") fail("product assertion retries must be forbidden");

  if (config.recurrencePolicy?.sameSignatureThreshold !== 2) fail("recurrence threshold must be two");
  if (config.recurrencePolicy?.actionAtThreshold !== "open-root-cause-work-and-stop-treating-as-one-off") fail("recurrence action drift");
  for (const key of ["quarantineAllowed","quarantineRequiresOwner","quarantineRequiresTrackingReference","quarantineMustExpire"]) {
    if (config.recurrencePolicy?.[key] !== true) fail(`quarantine rule disabled: ${key}`);
  }
  if (config.recurrencePolicy?.quarantinedCriticalPathMayBeGreen !== false) fail("quarantined critical path cannot be GREEN");

  if (config.greenPolicy?.applicableDeterministicTestMustPass !== true) fail("deterministic test must pass");
  if (config.greenPolicy?.knownUnresolvedProductFailureMayBeGreen !== false) fail("unresolved product failure cannot be GREEN");
  if (config.greenPolicy?.knownUnresolvedCriticalFlakeMayBeGreen !== false) fail("unresolved critical flake cannot be GREEN");
  if (config.greenPolicy?.infrastructureRetryEvidenceMustIncludeInitialFailureAndSuccessfulRetry !== true) {
    fail("retry evidence must retain failure and success");
  }

  if (config.ownership?.controlledClockOwnedByTask !== "25.07") fail("controlled-clock ownership drift");
  if (config.ownership?.coverageTargetOwnedByTask !== "25.09") fail("coverage ownership drift");

  if (!runnerSource.includes('["scripts/verify-flaky-test-policy.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.08 self-tests");
  }
  if (packageJson?.scripts?.["verify:flaky-test-policy"] !== "node scripts/verify-flaky-test-policy.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:flaky-test-policy:self-test"] !== "node scripts/verify-flaky-test-policy.mjs --self-test") {
    fail("package self-test script drift");
  }

  return {
    flakeClasses: actual.length,
    retryMax: config.retryPolicy.targetedWorkflowRetryMax,
    recurrenceThreshold: config.recurrencePolicy.sameSignatureThreshold
  };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const runner = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(config, runner, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, runner, packageJson); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("blind retries allowed", c => { c.principles.blindRetriesForbidden = false; });
  reject("automatic test retry enabled", c => { c.retryPolicy.automaticTestBodyRetries = 1; });
  reject("multiple targeted retries", c => { c.retryPolicy.targetedWorkflowRetryMax = 3; });
  reject("product assertion retry allowed", c => { c.retryPolicy.retryOfProductAssertionFailure = "allowed"; });
  reject("same SHA not required", c => { c.classification.requiresSameCommitShaForRetryEvidence = false; });
  reject("original failure can disappear", c => { c.principles.originalFailureMustRemainVisible = false; });
  reject("critical quarantined test may be green", c => { c.recurrencePolicy.quarantinedCriticalPathMayBeGreen = true; });
  reject("unresolved product failure may be green", c => { c.greenPolicy.knownUnresolvedProductFailureMayBeGreen = true; });

  console.log(`FLAKY_TEST_POLICY_SELF_TEST PASS cases=${cases} classes=${result.flakeClasses} retry_max=${result.retryMax} recurrence_threshold=${result.recurrenceThreshold}`);
} else {
  console.log(`FLAKY_TEST_POLICY PASS task=25.08 classes=${result.flakeClasses} retry_max=${result.retryMax} recurrence_threshold=${result.recurrenceThreshold}`);
}
