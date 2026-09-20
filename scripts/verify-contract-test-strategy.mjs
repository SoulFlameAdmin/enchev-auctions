import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-contract-test-strategy.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`CONTRACT_TEST_STRATEGY FAIL: ${message}`);
}

export function validate(strategy, runnerSource, packageJson) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) fail("strategy must be an object");
  if (strategy.taskId !== "25.04") fail("taskId must be 25.04");
  if (strategy.name !== "Contract-test strategy") fail("name mismatch");

  for (const key of [
    "consumerVisibleCompatibilityFirst",
    "schemaDrivenWhereAvailable",
    "deterministic",
    "productionIndependent",
    "backwardCompatibilityExplicit",
    "negativeCompatibilityCasesRequired"
  ]) {
    if (strategy.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  const envs = strategy.execution?.allowedEnvironments;
  if (!Array.isArray(envs) || envs.join(",") !== "local,ci") fail("allowed environments drift");
  if (strategy.execution?.productionCalls !== "forbidden") fail("production calls must be forbidden");
  if (strategy.execution?.productionCredentials !== "forbidden") fail("production credentials must be forbidden");
  if (strategy.execution?.liveProviderCalls !== "forbidden") fail("live provider calls must be forbidden");
  if (strategy.execution?.contractFixturesVersioned !== true) fail("contract fixtures must be versioned");
  if (strategy.execution?.breakingChangeRequiresExplicitVersionOrMigration !== true) fail("breaking changes need version or migration");

  if (strategy.ownership?.openApiOwnedByTask !== "24.01") fail("OpenAPI ownership drift");
  if (strategy.ownership?.integrationBehaviorOwnedByTask !== "25.02") fail("integration ownership drift");
  if (strategy.ownership?.endToEndBehaviorOwnedByTask !== "25.03") fail("E2E ownership drift");

  for (const key of [
    "producerAndConsumerContractValidated",
    "requiredFieldsAndTypesValidated",
    "unknownOrBreakingShapeRejected",
    "backwardCompatibleAdditionsAllowedWhenPolicyPermits",
    "failingApplicableTestBlocksGreen",
    "strategyDoesNotClaimProviderImplementation"
  ]) {
    if (strategy.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (!Array.isArray(strategy.scope) || strategy.scope.length < 4) fail("scope is incomplete");
  if (typeof runnerSource !== "string" || !runnerSource.includes('["scripts/verify-contract-test-strategy.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.04 self-tests");
  }
  if (packageJson?.scripts?.["verify:contract-test-strategy"] !== "node scripts/verify-contract-test-strategy.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:contract-test-strategy:self-test"] !== "node scripts/verify-contract-test-strategy.mjs --self-test") {
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

  rejected("production calls allowed", copy => { copy.execution.productionCalls = "allowed"; });
  rejected("live provider calls allowed", copy => { copy.execution.liveProviderCalls = "allowed"; });
  rejected("unversioned contract fixtures", copy => { copy.execution.contractFixturesVersioned = false; });
  rejected("breaking change without migration", copy => { copy.execution.breakingChangeRequiresExplicitVersionOrMigration = false; });
  rejected("negative compatibility cases optional", copy => { copy.principles.negativeCompatibilityCasesRequired = false; });
  rejected("breaking shape accepted", copy => { copy.acceptance.unknownOrBreakingShapeRejected = false; });
  rejected("OpenAPI ownership moved", copy => { copy.ownership.openApiOwnedByTask = "25.04"; });
  rejected("provider implementation falsely claimed", copy => { copy.acceptance.strategyDoesNotClaimProviderImplementation = false; });

  console.log(`CONTRACT_TEST_STRATEGY_SELF_TEST PASS cases=${cases} scope_items=${result.scopeItems} environments=${result.environments}`);
} else {
  console.log(`CONTRACT_TEST_STRATEGY PASS task=25.04 scope_items=${result.scopeItems} environments=${result.environments} production_calls=forbidden live_provider_calls=forbidden`);
}
