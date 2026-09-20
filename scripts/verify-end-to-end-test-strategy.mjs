import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-end-to-end-test-strategy.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`END_TO_END_TEST_STRATEGY FAIL: ${message}`);
}

export function validate(strategy, runnerSource, packageJson) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) fail("strategy must be an object");
  if (strategy.taskId !== "25.03") fail("taskId must be 25.03");
  if (strategy.name !== "End-to-end test strategy") fail("name mismatch");

  for (const key of [
    "userVisibleBehaviorFirst",
    "blackBoxPreferred",
    "deterministic",
    "isolatedFromProduction",
    "syntheticTestData",
    "authoritativeOutcomeAssertions",
    "failureAndRecoveryPathsRequired"
  ]) {
    if (strategy.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  const environments = strategy.execution?.allowedEnvironments;
  if (!Array.isArray(environments) || environments.join(",") !== "local,ci,staging") fail("allowed environments drift");
  if (strategy.execution?.productionMutations !== "forbidden") fail("production mutations must be forbidden");
  if (strategy.execution?.productionCredentials !== "forbidden") fail("production credentials must be forbidden");
  if (strategy.execution?.browserAutomation !== "required-for-browser-journeys") fail("browser automation policy drift");
  if (strategy.execution?.externalServices !== "stub-or-approved-sandbox") fail("external service policy drift");
  if (strategy.execution?.stateResetRequired !== true) fail("state reset must be required");
  if (strategy.execution?.controlledClockWhereTimeSensitive !== true) fail("time-sensitive journeys require a controlled clock");

  if (strategy.coverage?.representativeBrowserRequired !== true) fail("representative browser coverage is required");
  if (strategy.coverage?.mobileViewportRequiredForCriticalBuyerJourney !== true) fail("critical buyer journey requires a mobile viewport");
  if (strategy.coverage?.crossBrowserMatrixOwnedByTask !== "25.10") fail("cross-browser ownership drift");
  if (strategy.coverage?.fullProductionSmokeOwnedByTask !== "25.13") fail("production smoke ownership drift");

  for (const key of [
    "criticalJourneyHasHappyPath",
    "criticalJourneyHasFailureOrRecoveryPath",
    "assertUserVisibleAndAuthoritativeOutcome",
    "testMustBeRepeatable",
    "failingApplicableTestBlocksGreen",
    "strategyDoesNotClaimJourneyImplementation"
  ]) {
    if (strategy.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (!Array.isArray(strategy.scope) || strategy.scope.length < 4) fail("scope is incomplete");
  if (typeof runnerSource !== "string" || !runnerSource.includes('["scripts/verify-end-to-end-test-strategy.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.03 self-tests");
  }
  if (packageJson?.scripts?.["verify:end-to-end-test-strategy"] !== "node scripts/verify-end-to-end-test-strategy.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:end-to-end-test-strategy:self-test"] !== "node scripts/verify-end-to-end-test-strategy.mjs --self-test") {
    fail("package self-test script drift");
  }

  return { scopeItems: strategy.scope.length, environments: environments.length };
}

const strategy = JSON.parse(fs.readFileSync(STRATEGY_PATH, "utf8"));
const runner = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(strategy, runner, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const rejected = (label, mutate) => {
    const copy = structuredClone(strategy);
    mutate(copy);
    let didReject = false;
    try { validate(copy, runner, packageJson); } catch { didReject = true; }
    if (!didReject) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  };

  rejected("production isolation disabled", (copy) => { copy.principles.isolatedFromProduction = false; });
  rejected("production mutations allowed", (copy) => { copy.execution.productionMutations = "allowed"; });
  rejected("production credentials allowed", (copy) => { copy.execution.productionCredentials = "allowed"; });
  rejected("failure/recovery path optional", (copy) => { copy.principles.failureAndRecoveryPathsRequired = false; });
  rejected("state reset optional", (copy) => { copy.execution.stateResetRequired = false; });
  rejected("authoritative outcome assertion optional", (copy) => { copy.acceptance.assertUserVisibleAndAuthoritativeOutcome = false; });
  rejected("production smoke ownership moved into 25.03", (copy) => { copy.coverage.fullProductionSmokeOwnedByTask = "25.03"; });
  rejected("strategy claims implementation", (copy) => { copy.acceptance.strategyDoesNotClaimJourneyImplementation = false; });

  console.log(`END_TO_END_TEST_STRATEGY_SELF_TEST PASS cases=${cases} scope_items=${result.scopeItems} environments=${result.environments}`);
} else {
  console.log(`END_TO_END_TEST_STRATEGY PASS task=25.03 scope_items=${result.scopeItems} environments=${result.environments} production_mutations=forbidden production_credentials=forbidden`);
}
