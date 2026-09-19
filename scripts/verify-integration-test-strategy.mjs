import fs from "node:fs";

const PATH = "config/enchev-integration-test-strategy.json";

function fail(message) {
  throw new Error(`INTEGRATION_TEST_STRATEGY FAIL: ${message}`);
}

export function validate(strategy) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) fail("strategy must be an object");
  if (strategy.taskId !== "25.02") fail("taskId must be 25.02");
  if (strategy.name !== "Integration-test strategy") fail("name mismatch");

  for (const key of [
    "deterministic",
    "isolatedFromProduction",
    "realModuleBoundariesPreferred",
    "networkControlled",
    "testDataSynthetic",
    "failurePathsRequired"
  ]) {
    if (strategy.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  if (strategy.execution?.environment !== "local-or-ci") fail("execution environment drift");
  if (strategy.execution?.liveProviderCallsDefault !== "forbidden") fail("live provider calls must be forbidden by default");
  if (strategy.execution?.databasePolicy !== "ephemeral-or-dedicated-test-state") fail("database policy drift");
  if (strategy.execution?.externalServices !== "stub-or-approved-sandbox") fail("external service policy drift");
  if (strategy.execution?.cleanupRequired !== true) fail("cleanup must be required");

  for (const key of [
    "criticalBoundaryHasHappyPath",
    "criticalBoundaryHasFailurePath",
    "testMustBeRepeatable",
    "productionCredentialsForbidden",
    "failingApplicableTestBlocksGreen"
  ]) {
    if (strategy.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (!Array.isArray(strategy.scope) || strategy.scope.length < 4) fail("scope is incomplete");
  return { scopeItems: strategy.scope.length };
}

const strategy = JSON.parse(fs.readFileSync(PATH, "utf8"));
const result = validate(strategy);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const rejected = (label, mutate) => {
    const copy = structuredClone(strategy);
    mutate(copy);
    let didReject = false;
    try { validate(copy); } catch { didReject = true; }
    if (!didReject) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  };

  rejected("production isolation disabled", (copy) => { copy.principles.isolatedFromProduction = false; });
  rejected("live providers allowed", (copy) => { copy.execution.liveProviderCallsDefault = "allowed"; });
  rejected("production credentials allowed", (copy) => { copy.acceptance.productionCredentialsForbidden = false; });
  rejected("failure paths optional", (copy) => { copy.principles.failurePathsRequired = false; });
  rejected("cleanup optional", (copy) => { copy.execution.cleanupRequired = false; });
  rejected("non-repeatable accepted", (copy) => { copy.acceptance.testMustBeRepeatable = false; });

  console.log(`INTEGRATION_TEST_STRATEGY_SELF_TEST PASS cases=${cases} scope_items=${result.scopeItems}`);
} else {
  console.log(`INTEGRATION_TEST_STRATEGY PASS task=25.02 scope_items=${result.scopeItems} production_isolation=true live_provider_default=forbidden`);
}
