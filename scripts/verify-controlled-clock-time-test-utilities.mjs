import fs from "node:fs";
import { createControlledClock } from "../test/utils/controlled-clock.mjs";

const CONFIG_PATH = "config/enchev-controlled-clock-time-test-utilities.json";
const UTILITY_PATH = "test/utils/controlled-clock.mjs";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`CONTROLLED_CLOCK_TIME_TEST_UTILITIES FAIL: ${message}`);
}

function expectThrow(label, fn) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) fail(`${label} must throw`);
}

export function validate(config, utilitySource, runnerSource, packageJson) {
  if (config?.taskId !== "25.07") fail("taskId must be 25.07");
  if (config?.name !== "Controlled clock/time-test utilities") fail("name mismatch");
  if (config?.utilityPath !== UTILITY_PATH) fail("utilityPath drift");

  for (const key of ["explicitDependencyInjection", "deterministic"]) {
    if (config.principles?.[key] !== true) fail(`required principle disabled: ${key}`);
  }
  if (config.principles?.globalDateMonkeyPatch !== false) fail("global Date monkey-patching must be forbidden");
  if (config.principles?.realSleepRequired !== false) fail("real sleeps must not be required");
  if (config.principles?.wallClockReadRequired !== false) fail("wall-clock reads must not be required");
  if (config.principles?.timezone !== "UTC") fail("controlled clock timezone must be UTC");

  const requiredOps = ["nowMs", "nowDate", "iso", "set", "advance", "snapshot"];
  if (JSON.stringify(config.operations) !== JSON.stringify(requiredOps)) fail("operation registry drift");

  for (const key of [
    "invalidTimestampRejected",
    "negativeAdvanceRejected",
    "overflowRejected",
    "returnedDatesAreIndependentCopies"
  ]) {
    if (config.safety?.[key] !== true) fail(`required safety rule disabled: ${key}`);
  }
  if (config.safety?.productionRuntimeDependency !== false) fail("utility must not become a production runtime dependency");

  if (config.ownership?.deterministicFixturesOwnedByTask !== "25.06") fail("fixture ownership drift");
  if (config.ownership?.flakyTestPolicyOwnedByTask !== "25.08") fail("flaky policy ownership drift");

  for (const key of [
    "sameInitialTimeProducesSameSequence",
    "explicitSetSupportsBoundaryTests",
    "advanceSupportsDeterministicElapsedTimeTests",
    "utilityIsExecutable",
    "failingApplicableTestBlocksGreen"
  ]) {
    if (config.acceptance?.[key] !== true) fail(`required acceptance rule disabled: ${key}`);
  }

  if (utilitySource.includes("Date.now(")) fail("utility must not read Date.now");
  if (utilitySource.includes("setTimeout(") || utilitySource.includes("setInterval(")) fail("utility must not use real timers");
  if (!utilitySource.includes("createControlledClock")) fail("executable controlled-clock export missing");

  const start = "2030-01-01T10:00:00.000Z";
  const a = createControlledClock(start);
  const b = createControlledClock(start);
  if (a.iso() !== start || b.iso() !== start) fail("initial time mismatch");
  if (a.nowMs() !== b.nowMs()) fail("same initial time must be deterministic");

  const dateCopy = a.nowDate();
  dateCopy.setUTCFullYear(2040);
  if (a.iso() !== start) fail("returned Date mutated controlled state");

  a.advance(1_500);
  b.advance(1_500);
  if (a.iso() !== "2030-01-01T10:00:01.500Z" || a.iso() !== b.iso()) fail("deterministic advance failed");

  a.set("2030-01-01T10:05:00.000Z");
  if (a.snapshot().iso !== "2030-01-01T10:05:00.000Z") fail("explicit set/snapshot failed");

  expectThrow("invalid timestamp", () => createControlledClock("2030-01-01 10:00:00"));
  expectThrow("negative advance", () => createControlledClock(start).advance(-1));
  expectThrow("unsafe advance", () => createControlledClock(start).advance(Number.MAX_SAFE_INTEGER));
  expectThrow("unsafe initial epoch", () => createControlledClock(Number.MAX_SAFE_INTEGER + 1));

  if (!runnerSource.includes('["scripts/verify-controlled-clock-time-test-utilities.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.07 self-tests");
  }
  if (packageJson?.scripts?.["verify:controlled-clock-time-test-utilities"] !== "node scripts/verify-controlled-clock-time-test-utilities.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:controlled-clock-time-test-utilities:self-test"] !== "node scripts/verify-controlled-clock-time-test-utilities.mjs --self-test") {
    fail("package self-test script drift");
  }

  return { operations: requiredOps.length };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const utilitySource = fs.readFileSync(UTILITY_PATH, "utf8");
const runnerSource = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(config, utilitySource, runnerSource, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutateConfig, mutateSource) => {
    const candidate = structuredClone(config);
    let source = utilitySource;
    mutateConfig?.(candidate);
    if (mutateSource) source = mutateSource(source);
    let rejected = false;
    try { validate(candidate, source, runnerSource, packageJson); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("global Date monkey patch enabled", c => { c.principles.globalDateMonkeyPatch = true; });
  reject("real sleep required", c => { c.principles.realSleepRequired = true; });
  reject("non-UTC clock", c => { c.principles.timezone = "local"; });
  reject("negative advance allowed", c => { c.safety.negativeAdvanceRejected = false; });
  reject("production dependency claimed", c => { c.safety.productionRuntimeDependency = true; });
  reject("fixture ownership moved", c => { c.ownership.deterministicFixturesOwnedByTask = "25.07"; });
  reject("Date.now introduced", null, source => source + "\nconst forbiddenWallClock = Date.now();\n");
  reject("real timer introduced", null, source => source + "\nsetTimeout(() => {}, 1);\n");

  console.log(`CONTROLLED_CLOCK_TIME_TEST_UTILITIES_SELF_TEST PASS cases=${cases} operations=${result.operations}`);
} else {
  console.log(`CONTROLLED_CLOCK_TIME_TEST_UTILITIES PASS task=25.07 operations=${result.operations} deterministic=true`);
}
