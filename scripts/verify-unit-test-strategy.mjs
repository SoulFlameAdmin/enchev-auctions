import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-unit-test-strategy.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`UNIT_TEST_STRATEGY FAIL: ${message}`);
}

export function validate(strategy, runnerSource, packageJson) {
  if (!strategy || strategy.taskId !== "25.01") fail("taskId must be 25.01");
  if (strategy.name !== "Unit-test strategy") fail("name mismatch");

  const principles = strategy.principles || {};
  for (const key of ["deterministic","isolated","fast","noNetworkByDefault","noProductionData","negativeCasesRequired"]) {
    if (principles[key] !== true) fail(`required principle disabled: ${key}`);
  }

  const acceptance = strategy.acceptance || {};
  for (const key of ["newCriticalLogicRequiresTests","failingTestBlocksGreen","flakyPassDoesNotCountAsEvidence"]) {
    if (acceptance[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (strategy.execution?.aggregateRunner !== RUNNER_PATH) fail("aggregate runner drift");
  if (strategy.execution?.ciCommand !== "npm test") fail("CI command drift");
  if (strategy.execution?.dedicatedSelfTestFlag !== "--self-test") fail("self-test convention drift");

  if (typeof runnerSource !== "string" || !runnerSource.includes("spawnSync(process.execPath")) fail("aggregate runner must execute isolated Node test cases");
  const selfTests = [...runnerSource.matchAll(/"--self-test"/g)].length;
  if (selfTests < 20) fail(`expected substantial self-test coverage, found ${selfTests}`);

  if (!packageJson?.scripts || packageJson.scripts.test !== "node scripts/run-ci-tests.mjs") fail("package test script must use canonical aggregate runner");
  return { selfTests, scopeItems: strategy.scope?.length || 0 };
}

const strategy = JSON.parse(fs.readFileSync(STRATEGY_PATH, "utf8"));
const runner = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(strategy, runner, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  function rejected(label, mutate) {
    const copy = structuredClone(strategy);
    mutate(copy);
    let didReject = false;
    try { validate(copy, runner, packageJson); } catch { didReject = true; }
    if (!didReject) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  }

  rejected("network allowed by default", (copy) => { copy.principles.noNetworkByDefault = false; });
  rejected("negative cases optional", (copy) => { copy.principles.negativeCasesRequired = false; });
  rejected("failing tests do not block GREEN", (copy) => { copy.acceptance.failingTestBlocksGreen = false; });
  rejected("flaky pass accepted", (copy) => { copy.acceptance.flakyPassDoesNotCountAsEvidence = false; });
  rejected("aggregate runner drift", (copy) => { copy.execution.aggregateRunner = "scripts/other.mjs"; });

  console.log(`UNIT_TEST_STRATEGY_SELF_TEST PASS cases=${cases} aggregate_self_tests=${result.selfTests}`);
} else {
  console.log(`UNIT_TEST_STRATEGY PASS task=25.01 aggregate_self_tests=${result.selfTests} scope_items=${result.scopeItems}`);
}
