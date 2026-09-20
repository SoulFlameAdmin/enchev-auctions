import fs from "node:fs";

const CONFIG_PATH = "config/enchev-cross-browser-test-matrix.json";
const CAPTURE_PATH = "scripts/capture-visual-regression.mjs";
const WORKFLOW_PATH = ".github/workflows/verify-enchev-web.yml";
const RUNNER_PATH = "scripts/run-ci-tests.mjs";
const PACKAGE_PATH = "package.json";

function fail(message) {
  throw new Error(`CROSS_BROWSER_TEST_MATRIX FAIL: ${message}`);
}

export function validate(config, captureSource, workflowSource, runnerSource, packageJson) {
  if (config?.taskId !== "25.10") fail("taskId must be 25.10");
  if (config?.name !== "Cross-browser test matrix") fail("name mismatch");
  if (config?.matrixVersion !== 1) fail("matrixVersion must be 1");

  const browsers = config.browsers;
  if (!Array.isArray(browsers) || browsers.length !== 2) fail("exactly two required browser channels must be registered");
  const ids = browsers.map(b => b.id);
  if (JSON.stringify(ids) !== JSON.stringify(["chrome","edge"])) fail("browser matrix must be chrome then edge");
  if (browsers.some(b => b.required !== true)) fail("both browsers must be required");
  if (browsers[0].engine !== "Blink" || browsers[1].engine !== "Blink") fail("browser engine metadata drift");

  const expectedRoutes = ["home","browse","lot-ea-10539","live-auctions","profile"];
  if (JSON.stringify(config.routes) !== JSON.stringify(expectedRoutes)) fail("route matrix drift");
  const expectedWidths = [360,390,430,1366,1440,1920];
  if (JSON.stringify(config.viewportWidths) !== JSON.stringify(expectedWidths)) fail("viewport matrix drift");
  if (config.expectedScreenshotsPerBrowser !== 30) fail("expected screenshots per browser must be 30");

  for (const key of [
    "browserProcessLaunches",
    "devToolsConnection",
    "routeReadiness",
    "responsiveGeometry",
    "visualScreenshotCapture",
    "manifestBrowserIdentity",
    "artifactUpload"
  ]) {
    if (config.requiredChecks?.[key] !== true) fail(`required check disabled: ${key}`);
  }

  for (const key of [
    "allRequiredBrowsersMustPass",
    "allRequiredRoutesMustPass",
    "allRequiredViewportsMustPass",
    "missingRequiredBrowserBlocksGreen",
    "missingArtifactBlocksGreen",
    "singleBrowserPassDoesNotSatisfyMatrix"
  ]) {
    if (config.greenRules?.[key] !== true) fail(`GREEN rule disabled: ${key}`);
  }

  if (config.scopeTruth?.firefoxClaimed !== false) fail("Firefox coverage must not be claimed");
  if (config.scopeTruth?.safariClaimed !== false) fail("Safari coverage must not be claimed");
  if (config.scopeTruth?.webkitClaimed !== false) fail("WebKit coverage must not be claimed");
  if (config.scopeTruth?.mobileBrowserMatrixOwnedByTask !== "25.11") fail("mobile browser ownership drift");
  if (config.ownership?.criticalPathCoverageOwnedByTask !== "25.09") fail("critical-path ownership drift");
  if (config.ownership?.mobileBrowserMatrixOwnedByTask !== "25.11") fail("mobile-browser ownership drift");

  for (const width of expectedWidths) {
    if (!captureSource.includes(`width:${width}`) && !captureSource.includes(`width: ${width}`)) {
      fail(`capture harness missing viewport width ${width}`);
    }
  }
  for (const route of expectedRoutes) {
    if (!captureSource.includes(`name:"${route}"`) && !captureSource.includes(`name: "${route}"`)) {
      fail(`capture harness missing route ${route}`);
    }
  }
  if (!captureSource.includes("entries.length!==30")) fail("capture harness must require 30 screenshots");
  if (!captureSource.includes("Chrome DevTools Protocol")) fail("capture protocol evidence missing");

  if (!workflowSource.includes("Install Microsoft Edge stable")) fail("workflow must install Microsoft Edge stable");
  if (!workflowSource.includes('CHROME_BIN="$(command -v microsoft-edge)"')) fail("workflow must execute harness against Edge");
  if (!workflowSource.includes("chrome.count!==30||edge.count!==30")) fail("workflow must verify 30 screenshots per browser");
  if (!workflowSource.includes('/edge/i.test(edge.browserExecutable)')) fail("workflow must verify Edge browser identity");
  if (!workflowSource.includes("Upload Chrome and Edge visual regression artifact")) fail("cross-browser artifact upload missing");

  if (!runnerSource.includes('["scripts/verify-cross-browser-test-matrix.mjs", "--self-test"]')) {
    fail("aggregate CI runner must include 25.10 self-tests");
  }
  if (packageJson?.scripts?.["verify:cross-browser-test-matrix"] !== "node scripts/verify-cross-browser-test-matrix.mjs") {
    fail("package invariant script drift");
  }
  if (packageJson?.scripts?.["verify:cross-browser-test-matrix:self-test"] !== "node scripts/verify-cross-browser-test-matrix.mjs --self-test") {
    fail("package self-test script drift");
  }

  return {
    browsers: browsers.length,
    routes: expectedRoutes.length,
    viewports: expectedWidths.length,
    screenshots: config.expectedScreenshotsPerBrowser * browsers.length
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

  reject("Edge optional", c => { c.browsers[1].required = false; });
  reject("browser removed", c => { c.browsers.pop(); });
  reject("route removed", c => { c.routes.pop(); });
  reject("viewport removed", c => { c.viewportWidths.pop(); });
  reject("screenshot count reduced", c => { c.expectedScreenshotsPerBrowser = 24; });
  reject("single browser accepted", c => { c.greenRules.singleBrowserPassDoesNotSatisfyMatrix = false; });
  reject("Firefox falsely claimed", c => { c.scopeTruth.firefoxClaimed = true; });
  reject("mobile ownership stolen", c => { c.ownership.mobileBrowserMatrixOwnedByTask = "25.10"; });

  console.log(`CROSS_BROWSER_TEST_MATRIX_SELF_TEST PASS cases=${cases} browsers=${result.browsers} routes=${result.routes} viewports=${result.viewports} screenshots=${result.screenshots}`);
} else {
  console.log(`CROSS_BROWSER_TEST_MATRIX PASS task=25.10 browsers=${result.browsers} routes=${result.routes} viewports=${result.viewports} screenshots=${result.screenshots}`);
}
