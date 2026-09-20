import fs from "node:fs";

const STRATEGY_PATH = "config/enchev-deterministic-test-fixtures.json";
const FIXTURE_PATH = "test/fixtures/canonical-v1.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`DETERMINISTIC_TEST_FIXTURES FAIL: ${message}`);
}

export function validate(strategy, fixture, runnerSource, packageJson) {
  if (strategy?.taskId !== "25.06") fail("taskId must be 25.06");
  if (strategy?.name !== "Deterministic test fixtures") fail("name mismatch");

  for (const key of [
    "deterministic",
    "syntheticOnly",
    "productionIndependent",
    "explicitClockInputs",
    "stableIdentifiers",
    "minimalPurposeBuiltFixtures"
  ]) {
    if (strategy.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }

  if (strategy.execution?.productionData !== "forbidden") fail("production data must be forbidden");
  if (strategy.execution?.productionCredentials !== "forbidden") fail("production credentials must be forbidden");
  if (strategy.execution?.wallClockReadsInFixtures !== "forbidden") fail("wall-clock reads must be forbidden");
  if (strategy.execution?.randomUnseededValues !== "forbidden") fail("unseeded randomness must be forbidden");
  if (strategy.execution?.fixtureMutationAcrossTests !== "forbidden") fail("fixture mutation across tests must be forbidden");
  if (strategy.execution?.sharedFixtureResetRequired !== true) fail("shared fixture reset is required");

  if (strategy.ownership?.propertyStrategyOwnedByTask !== "25.05") fail("property strategy ownership drift");
  if (strategy.ownership?.controlledClockUtilitiesOwnedByTask !== "25.07") fail("clock utilities ownership drift");

  for (const key of [
    "sameInputsProduceSameFixture",
    "fixtureValuesAreSerializable",
    "fixtureValuesAreReplayable",
    "fixturesContainNoRealCustomerData",
    "failingApplicableTestBlocksGreen",
    "taskDoesNotClaimAllDomainFixturesImplemented"
  ]) {
    if (strategy.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  const serialized = JSON.stringify(fixture);
  if (fixture?.version !== 1) fail("fixture version must be 1");
  if (!fixture?.fixtures?.syntheticBuyer || !fixture?.fixtures?.syntheticVehicle || !fixture?.fixtures?.syntheticAuction) {
    fail("canonical fixtures incomplete");
  }
  if (!serialized.includes("@example.test")) fail("synthetic email domain required");
  if (serialized.includes("Date.now") || serialized.includes("Math.random")) fail("non-deterministic source leaked into fixture");
  if (JSON.stringify(JSON.parse(serialized)) !== serialized) fail("fixture serialization must be stable");

  if (!runnerSource.includes('["scripts/verify-deterministic-test-fixtures.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.06 self-tests");
  }
  if (packageJson?.scripts?.["verify:deterministic-test-fixtures"] !== "node scripts/verify-deterministic-test-fixtures.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:deterministic-test-fixtures:self-test"] !== "node scripts/verify-deterministic-test-fixtures.mjs --self-test") {
    fail("package self-test script drift");
  }

  return { fixtureCount: Object.keys(fixture.fixtures).length };
}

const strategy = JSON.parse(fs.readFileSync(STRATEGY_PATH, "utf8"));
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const runner = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(strategy, fixture, runner, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const rejected = (label, mutateStrategy, mutateFixture) => {
    const s = structuredClone(strategy);
    const f = structuredClone(fixture);
    mutateStrategy?.(s);
    mutateFixture?.(f);
    let rejected = false;
    try { validate(s, f, runner, packageJson); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  rejected("production data allowed", s => { s.execution.productionData = "allowed"; });
  rejected("wall clock allowed", s => { s.execution.wallClockReadsInFixtures = "allowed"; });
  rejected("unseeded randomness allowed", s => { s.execution.randomUnseededValues = "allowed"; });
  rejected("fixture mutation allowed", s => { s.execution.fixtureMutationAcrossTests = "allowed"; });
  rejected("clock ownership moved", s => { s.ownership.controlledClockUtilitiesOwnedByTask = "25.06"; });
  rejected("real-looking email domain", null, f => { f.fixtures.syntheticBuyer.email = "buyer@example.com"; });
  rejected("missing canonical auction", null, f => { delete f.fixtures.syntheticAuction; });
  rejected("all domain fixtures falsely claimed", s => { s.acceptance.taskDoesNotClaimAllDomainFixturesImplemented = false; });

  console.log(`DETERMINISTIC_TEST_FIXTURES_SELF_TEST PASS cases=${cases} fixtures=${result.fixtureCount}`);
} else {
  console.log(`DETERMINISTIC_TEST_FIXTURES PASS task=25.06 fixtures=${result.fixtureCount} synthetic_only=true`);
}
