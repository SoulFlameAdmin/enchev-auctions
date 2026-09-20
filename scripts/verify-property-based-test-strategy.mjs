import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-property-based-test-strategy.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`PROPERTY_BASED_TEST_STRATEGY FAIL: ${message}`);
}

export function validate(strategy, runnerSource, packageJson) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) fail("strategy must be an object");
  if (strategy.taskId !== "25.05") fail("taskId must be 25.05");
  if (strategy.name !== "Property-based test strategy") fail("name mismatch");

  for (const key of [
    "invariantDriven",
    "generatedInputs",
    "deterministicSeedSupport",
    "shrinkingRequiredWhenSupported",
    "productionIndependent",
    "negativePropertyCasesRequired"
  ]) {
    if (strategy.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  const envs = strategy.execution?.allowedEnvironments;
  if (!Array.isArray(envs) || envs.join(",") !== "local,ci") fail("allowed environments drift");
  if (strategy.execution?.productionCalls !== "forbidden") fail("production calls must be forbidden");
  if (strategy.execution?.productionCredentials !== "forbidden") fail("production credentials must be forbidden");
  if (strategy.execution?.seedMustBeReportable !== true) fail("seed must be reportable");
  if (strategy.execution?.counterexampleMustBeReproducible !== true) fail("counterexample must be reproducible");
  if (strategy.execution?.boundedCaseCountRequired !== true) fail("case count must be bounded");

  if (strategy.ownership?.unitStrategyOwnedByTask !== "25.01") fail("unit strategy ownership drift");
  if (strategy.ownership?.integrationStrategyOwnedByTask !== "25.02") fail("integration strategy ownership drift");
  if (strategy.ownership?.contractStrategyOwnedByTask !== "25.04") fail("contract strategy ownership drift");
  if (strategy.ownership?.deterministicFixturesOwnedByTask !== "25.06") fail("fixture ownership drift");

  for (const key of [
    "propertiesExpressStableInvariants",
    "generatedInputsCoverBoundaries",
    "failingCounterexampleIsReproducible",
    "shrunkCounterexamplePreferredWhenAvailable",
    "failingApplicableTestBlocksGreen",
    "strategyDoesNotClaimGeneratorImplementation"
  ]) {
    if (strategy.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (!Array.isArray(strategy.scope) || strategy.scope.length < 4) fail("scope is incomplete");
  if (typeof runnerSource !== "string" || !runnerSource.includes('["scripts/verify-property-based-test-strategy.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.05 self-tests");
  }
  if (packageJson?.scripts?.["verify:property-based-test-strategy"] !== "node scripts/verify-property-based-test-strategy.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:property-based-test-strategy:self-test"] !== "node scripts/verify-property-based-test-strategy.mjs --self-test") {
    fail("package self-test script drift");
  }

  return { scopeItems: strategy.scope.length, environments: envs.length };
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

  rejected("seed support disabled", copy => { copy.principles.deterministicSeedSupport = false; });
  rejected("counterexample not reproducible", copy => { copy.execution.counterexampleMustBeReproducible = false; });
  rejected("unbounded case count", copy => { copy.execution.boundedCaseCountRequired = false; });
  rejected("production calls allowed", copy => { copy.execution.productionCalls = "allowed"; });
  rejected("boundary generation optional", copy => { copy.acceptance.generatedInputsCoverBoundaries = false; });
  rejected("failing property does not block GREEN", copy => { copy.acceptance.failingApplicableTestBlocksGreen = false; });
  rejected("fixture ownership moved", copy => { copy.ownership.deterministicFixturesOwnedByTask = "25.05"; });
  rejected("generator implementation falsely claimed", copy => { copy.acceptance.strategyDoesNotClaimGeneratorImplementation = false; });

  console.log(`PROPERTY_BASED_TEST_STRATEGY_SELF_TEST PASS cases=${cases} scope_items=${result.scopeItems} environments=${result.environments}`);
} else {
  console.log(`PROPERTY_BASED_TEST_STRATEGY PASS task=25.05 scope_items=${result.scopeItems} environments=${result.environments} reproducible_counterexamples=true`);
}
