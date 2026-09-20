import fs from "node:fs";

const CONFIG_PATH = "config/enchev-mobile-browser-test-matrix.json";
const CAPTURE_PATH = "scripts/capture-visual-regression.mjs";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`MOBILE_BROWSER_TEST_MATRIX FAIL: ${message}`);
}

export function validate(config, captureSource, workflowSource, runnerSource, packageJson) {
  if (config?.taskId !== "25.11") fail("taskId must be 25.11");
  if (config?.name !== "Mobile-browser test matrix") fail("name mismatch");
  if (config?.matrixVersion !== 1) fail("matrixVersion must be 1");

  const baseline = config.executableCiBaseline;
  if (!baseline || !Array.isArray(baseline.channels) || baseline.channels.length !== 2) fail("two CI mobile channels required");
  const channelIds = baseline.channels.map(c => c.id);
  if (JSON.stringify(channelIds) !== JSON.stringify(["chrome-mobile-emulation","edge-mobile-emulation"])) fail("CI mobile channel registry drift");
  if (baseline.channels.some(c => c.required !== true || c.mode !== "CDP mobile emulation")) fail("CI mobile channels must be required CDP emulation");
  if (baseline.channels.some(c => c.engine !== "Blink")) fail("CI channel engine metadata drift");

  const expectedRoutes = ["home","inventory","lot-ea-10539","live-auctions","profile"];
  if (JSON.stringify(baseline.routes) !== JSON.stringify(expectedRoutes)) fail("mobile route matrix drift");

  const expectedViewports = [
    {name:"phone-360",width:360,height:800},
    {name:"phone-390",width:390,height:844},
    {name:"phone-430",width:430,height:932}
  ];
  if (JSON.stringify(baseline.viewports) !== JSON.stringify(expectedViewports)) fail("mobile viewport matrix drift");
  if (baseline.expectedCapturesPerChannel !== 15) fail("expected mobile captures per channel must be 15");

  const release = config.releaseTarget;
  if (!release || !Array.isArray(release.realOrPlatformBrowserChannels) || release.realOrPlatformBrowserChannels.length !== 2) {
    fail("Android Chrome and iOS Safari release targets required");
  }
  const releaseIds = release.realOrPlatformBrowserChannels.map(c => c.id);
  if (JSON.stringify(releaseIds) !== JSON.stringify(["android-chrome","ios-safari"])) fail("release mobile target drift");
  for (const channel of release.realOrPlatformBrowserChannels) {
    if (channel.requiredForFinalProductionAcceptance !== true) fail(`${channel.id} must be required for final production acceptance`);
    if (channel.currentExecutionClaimed !== false) fail(`${channel.id} current execution must not be falsely claimed`);
  }
  if (release.externalDeviceLabOrApprovedSimulatorAllowed !== true) fail("approved device lab/simulator evidence must be allowed");
  if (release.evidenceMustReferenceExactReleaseCommit !== true) fail("release evidence must reference exact commit");

  for (const key of [
    "touchEmulation",
    "viewportGeometry",
    "horizontalOverflow",
    "mobileNavigation",
    "stickyOrFixedActionSafety",
    "focusVisibility",
    "reconnectStateVisibility",
    "visualCapture",
    "artifactRetention"
  ]) {
    if (config.requiredMobileChecks?.[key] !== true) fail(`required mobile check disabled: ${key}`);
  }

  for (const key of [
    "taskGreenMeansMatrixContractAndExecutableCiBaselineVerified",
    "taskGreenDoesNotClaimRealAndroidOrIosExecution",
    "bothCiMobileChannelsMustPass",
    "allThreeMobileViewportsMustPass",
    "allFiveRoutesMustPass",
    "missingMobileArtifactBlocksGreen",
    "finalProductionAcceptanceRequiresReleaseTargetEvidence"
  ]) {
    if (config.greenRules?.[key] !== true) fail(`GREEN rule disabled: ${key}`);
  }

  if (config.ownership?.crossBrowserMatrixOwnedByTask !== "25.10") fail("cross-browser ownership drift");
  if (config.ownership?.stagingSmokeSuiteOwnedByTask !== "25.12") fail("staging-smoke ownership drift");

  for (const viewport of expectedViewports) {
    if (!captureSource.includes(`name:"${viewport.name}",width:${viewport.width},height:${viewport.height},mobile:true`)) {
      fail(`capture harness missing exact mobile viewport ${viewport.name}`);
    }
  }
  for (const route of expectedRoutes) {
    if (!captureSource.includes(`name:"${route}"`) && !captureSource.includes(`name: "${route}"`)) {
      fail(`capture harness missing mobile route ${route}`);
    }
  }
  if (!captureSource.includes("Emulation.setTouchEmulationEnabled")) fail("touch emulation missing from capture harness");
  if (!captureSource.includes("enabled:viewport.mobile")) fail("touch emulation is not bound to mobile viewport flag");

  if (!workflowSource.includes("DP2_MOBILE_BROWSER_MATRIX PASS chrome_mobile=15 edge_mobile=15 widths=360,390,430")) {
    fail("workflow mobile matrix terminal gate missing");
  }
  if (!workflowSource.includes("Upload Chrome and Edge visual regression artifact")) fail("mobile-capable artifact upload missing");

  if (!runnerSource.includes('["scripts/verify-mobile-browser-test-matrix.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.11 self-tests");
  }
  if (packageJson?.scripts?.["verify:mobile-browser-test-matrix"] !== "node scripts/verify-mobile-browser-test-matrix.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:mobile-browser-test-matrix:self-test"] !== "node scripts/verify-mobile-browser-test-matrix.mjs --self-test") {
    fail("package self-test script drift");
  }

  return {
    ciChannels: baseline.channels.length,
    routes: baseline.routes.length,
    viewports: baseline.viewports.length,
    ciMobileCaptures: baseline.expectedCapturesPerChannel * baseline.channels.length,
    releaseTargets: release.realOrPlatformBrowserChannels.length
  };
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const captureSource = fs.readFileSync(CAPTURE_PATH, "utf8");
const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");
const runnerSource = fs.readFileSync(RUNNER_PATH, "utf8");
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const result = validate(config, captureSource, workflowSource, runnerSource, packageJson);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, captureSource, workflowSource, runnerSource, packageJson); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };

  reject("CI channel removed", c => { c.executableCiBaseline.channels.pop(); });
  reject("mobile viewport removed", c => { c.executableCiBaseline.viewports.pop(); });
  reject("mobile route removed", c => { c.executableCiBaseline.routes.pop(); });
  reject("capture count reduced", c => { c.executableCiBaseline.expectedCapturesPerChannel = 10; });
  reject("Android current execution falsely claimed", c => { c.releaseTarget.realOrPlatformBrowserChannels[0].currentExecutionClaimed = true; });
  reject("iOS final acceptance made optional", c => { c.releaseTarget.realOrPlatformBrowserChannels[1].requiredForFinalProductionAcceptance = false; });
  reject("touch emulation disabled", c => { c.requiredMobileChecks.touchEmulation = false; });
  reject("final release evidence waived", c => { c.greenRules.finalProductionAcceptanceRequiresReleaseTargetEvidence = false; });

  console.log(`MOBILE_BROWSER_TEST_MATRIX_SELF_TEST PASS cases=${cases} ci_channels=${result.ciChannels} routes=${result.routes} viewports=${result.viewports} ci_mobile_captures=${result.ciMobileCaptures} release_targets=${result.releaseTargets}`);
} else {
  console.log(`MOBILE_BROWSER_TEST_MATRIX PASS task=25.11 ci_channels=${result.ciChannels} routes=${result.routes} viewports=${result.viewports} ci_mobile_captures=${result.ciMobileCaptures} release_targets=${result.releaseTargets}`);
}
