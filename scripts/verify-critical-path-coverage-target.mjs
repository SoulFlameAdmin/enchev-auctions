import fs from "node:fs";

const CONFIG_PATH = "config/enchev-critical-path-coverage-target.json";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`CRITICAL_PATH_COVERAGE_TARGET FAIL: ${message}`);
}

export function validate(config, runnerSource, packageJson) {
  if (config?.taskId !== "25.09") fail("taskId must be 25.09");
  if (config?.name !== "Critical-path coverage target") fail("name mismatch");
  if (config?.targetVersion !== 1) fail("targetVersion must be 1");
  if (config?.coverageModel !== "scenario-and-invariant") fail("coverage model drift");

  const t = config.targets || {};
  if (t.registeredCriticalPathsPercent !== 100) fail("registered critical paths target must be 100%");
  if (t.applicableScenarioDimensionsPercent !== 100) fail("applicable scenario dimensions target must be 100%");
  if (t.criticalInvariantCoveragePercent !== 100) fail("critical invariant target must be 100%");
  if (t.minimumAutomatedScenariosPerApplicableDimension !== 1) fail("minimum automated scenarios must be one");

  const allowedDimensions = new Set([
    "happy-path",
    "authorization-or-eligibility-denial",
    "validation-or-boundary-failure",
    "idempotency-or-duplicate-protection",
    "time-or-ordering-boundary",
    "recovery-or-reconnect"
  ]);
  const dimensions = config.requiredScenarioDimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== allowedDimensions.size) fail("scenario dimension registry drift");
  for (const dimension of dimensions) if (!allowedDimensions.has(dimension)) fail(`unknown scenario dimension: ${dimension}`);

  const paths = config.criticalPaths;
  if (!Array.isArray(paths) || paths.length < 10) fail("at least ten critical paths must be registered");
  const ids = new Set();
  const names = new Set();
  for (const path of paths) {
    if (!/^CP-\d{2}$/.test(path.id)) fail(`invalid critical-path id: ${path.id}`);
    if (ids.has(path.id)) fail(`duplicate critical-path id: ${path.id}`);
    if (names.has(path.name)) fail(`duplicate critical-path name: ${path.name}`);
    ids.add(path.id);
    names.add(path.name);
    if (!Array.isArray(path.masterPhases) || path.masterPhases.length === 0) fail(`${path.id} missing master phase linkage`);
    if (!Array.isArray(path.requiredDimensions) || path.requiredDimensions.length === 0) fail(`${path.id} missing required dimensions`);
    for (const dimension of path.requiredDimensions) {
      if (!allowedDimensions.has(dimension)) fail(`${path.id} has invalid dimension ${dimension}`);
    }
    if (!path.requiredDimensions.includes("happy-path")) fail(`${path.id} must include happy-path`);
  }

  const g = config.greenRules || {};
  if (g.targetDefinitionMayBeGreenBeforeAllCriticalPathsAreImplemented !== true) fail("target-definition GREEN semantics missing");
  if (g.taskGreenDoesNotClaimCurrentProductCoverageMeetsTarget !== true) fail("must not claim current target attainment");
  if (g.productionAcceptanceRequiresTargetMet !== true) fail("production acceptance must require target");
  if (g.missingApplicableDimensionBlocksProductionAcceptance !== true) fail("missing dimensions must block production acceptance");
  if (g.manualOnlyEvidenceDoesNotSatisfyAutomatedCoverageTarget !== true) fail("manual-only evidence cannot satisfy target");
  if (g.quarantinedCriticalPathDoesNotCountAsCovered !== true) fail("quarantined critical paths cannot count as covered");

  const m = config.measurement || {};
  if (m.currentCoveragePercentageClaimed !== false) fail("must not invent current coverage percentage");
  if (m.lineCoverageTargetClaimed !== false) fail("must not claim uninstrumented line target");
  if (m.branchCoverageTargetClaimed !== false) fail("must not claim uninstrumented branch target");
  if (m.futureMeasurementMustReferenceConcreteTests !== true) fail("future measurement must reference concrete tests");
  if (m.futureMeasurementMustUseExactCommitEvidence !== true) fail("future measurement must use exact commit evidence");

  if (config.ownership?.flakyTestPolicyOwnedByTask !== "25.08") fail("flaky-test ownership drift");
  if (config.ownership?.crossBrowserMatrixOwnedByTask !== "25.10") fail("cross-browser ownership drift");
  if (config.ownership?.mobileBrowserMatrixOwnedByTask !== "25.11") fail("mobile-browser ownership drift");

  if (!runnerSource.includes('["scripts/verify-critical-path-coverage-target.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.09 self-tests");
  }
  if (packageJson?.scripts?.["verify:critical-path-coverage-target"] !== "node scripts/verify-critical-path-coverage-target.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:critical-path-coverage-target:self-test"] !== "node scripts/verify-critical-path-coverage-target.mjs --self-test") {
    fail("package self-test script drift");
  }

  return { paths: paths.length, dimensions: dimensions.length };
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

  reject("critical-path target lowered", c => { c.targets.registeredCriticalPathsPercent = 95; });
  reject("scenario target lowered", c => { c.targets.applicableScenarioDimensionsPercent = 90; });
  reject("invented current percentage", c => { c.measurement.currentCoveragePercentageClaimed = true; });
  reject("line coverage falsely claimed", c => { c.measurement.lineCoverageTargetClaimed = true; });
  reject("manual evidence accepted", c => { c.greenRules.manualOnlyEvidenceDoesNotSatisfyAutomatedCoverageTarget = false; });
  reject("quarantined critical path counted", c => { c.greenRules.quarantinedCriticalPathDoesNotCountAsCovered = false; });
  reject("duplicate critical-path id", c => { c.criticalPaths[1].id = c.criticalPaths[0].id; });
  reject("critical path without happy path", c => { c.criticalPaths[0].requiredDimensions = ["validation-or-boundary-failure"]; });

  console.log(`CRITICAL_PATH_COVERAGE_TARGET_SELF_TEST PASS cases=${cases} paths=${result.paths} dimensions=${result.dimensions}`);
} else {
  console.log(`CRITICAL_PATH_COVERAGE_TARGET PASS task=25.09 paths=${result.paths} dimensions=${result.dimensions} target=100%`);
}
