import fs from "node:fs";

const CONFIG_PATH = "config/enchev-staging-smoke-suite.json";
const RUNTIME_CONFIG_PATH = "config/enchev-runtime-environments.json";
const HEALTH_CONFIG_PATH = "config/enchev-health-endpoints.json";
const PACKAGE_PATH = "package.json";
const PRE_GATE_PATH = "scripts/run-system-test-pre-gates.mjs";

function fail(message) {
  throw new Error(`STAGING_SMOKE_SUITE FAIL: ${message}`);
}

function same(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} drift`);
}

export function validate(config, runtimeConfig, healthConfig, packageJson, preGateSource) {
  if (config?.taskId !== "25.12") fail("taskId must be 25.12");
  if (config?.name !== "Staging smoke suite") fail("name mismatch");
  if (config?.suiteVersion !== 1) fail("suiteVersion must be 1");

  const env = config.environment;
  if (!env || env.role !== "staging" || env.platform !== "vercel" || env.platformEnvironment !== "preview") fail("staging must be Vercel Preview");
  if (env.branchPolicy !== "non-main") fail("staging branch policy must be non-main");
  if (env.productionAuthority !== false) fail("staging cannot have production authority");
  if (env.baseUrlSource !== "explicit-argument-or-STAGING_BASE_URL") fail("base URL source drift");

  if (runtimeConfig?.staging_mode !== "vercel-preview") fail("01.07 staging mode drift");
  const staging = runtimeConfig?.environments?.find(item => item.name === "staging");
  if (!staging || staging.platform_environment !== "preview" || staging.branch_policy !== "non-main" || staging.production_authority !== false) fail("01.07 staging topology drift");

  const expectedHealth = (healthConfig?.endpoints || []).map(item => ({
    component: item.component,
    path: item.path,
    httpStatus: item.http_status,
    ready: item.ready,
    status: item.status
  }));
  same(config.healthChecks, expectedHealth, "health checks");

  const expectedPages = [
    {name:"home",path:"/",httpStatus:200},
    {name:"inventory",path:"/inventory",httpStatus:200},
    {name:"lot-ea-10539",path:"/lot/EA-10539",httpStatus:200},
    {name:"live-auctions",path:"/live-auctions",httpStatus:200},
    {name:"profile",path:"/profile",httpStatus:200}
  ];
  same(config.pageChecks, expectedPages, "page checks");

  const policy = config.requestPolicy;
  if (!policy || policy.method !== "GET" || policy.redirect !== "error" || policy.cache !== "no-store") fail("request policy drift");
  if (policy.timeoutMs !== 15000) fail("timeout must be 15000ms");
  if (policy.mutatingRequestsForbidden !== true) fail("mutating requests must remain forbidden");

  for (const key of [
    "exactImplementationCommitPreviewRequired",
    "allHealthChecksMustPass",
    "allPageChecksMustPass",
    "previewMustBeNonProduction",
    "productionUrlDoesNotCountAsStagingEvidence",
    "ciContractAndNegativeSelfTestsMustPass",
    "liveSmokeEvidenceRequiredBeforeGreen"
  ]) {
    if (config.greenRules?.[key] !== true) fail(`GREEN rule disabled: ${key}`);
  }

  if (config.ownership?.runtimeEnvironmentTask !== "01.07") fail("runtime ownership drift");
  if (config.ownership?.healthEndpointTask !== "01.10") fail("health ownership drift");
  if (config.ownership?.mobileBrowserMatrixTask !== "25.11") fail("mobile ownership drift");
  if (config.ownership?.productionSmokeSuiteTask !== "25.13") fail("production smoke ownership drift");

  if (packageJson?.scripts?.["verify:staging-smoke-suite"] !== "node scripts/verify-staging-smoke-suite-ci.mjs") fail("package verify script drift");
  if (packageJson?.scripts?.["verify:staging-smoke-suite:self-test"] !== "node scripts/verify-staging-smoke-suite-ci.mjs --self-test") fail("package self-test script drift");
  if (packageJson?.scripts?.test !== "node scripts/run-system-test-pre-gates.mjs && node scripts/run-ci-tests.mjs") fail("canonical aggregate npm test drift");
  if (!preGateSource.includes('["scripts/verify-staging-smoke-suite-ci.mjs", "--self-test"]')) fail("25.12 must be registered in system pre-gates");

  return { healthChecks: config.healthChecks.length, pageChecks: config.pageChecks.length };
}

export function validateStagingBaseUrl(value, runtimeConfig) {
  let url;
  try { url = new URL(String(value || "")); } catch { fail("staging base URL must be an absolute URL"); }
  if (url.protocol !== "https:") fail("staging base URL must use https");
  if (url.username || url.password || url.search || url.hash) fail("staging URL must not contain credentials, query or fragment");
  if (url.pathname !== "/" && url.pathname !== "") fail("staging base URL must not include a path");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") fail("localhost cannot count as staging");
  const production = new URL(runtimeConfig.canonical_production_url);
  if (host === production.hostname.toLowerCase()) fail("canonical production URL cannot count as staging");
  if (!host.endsWith(".vercel.app")) fail("staging evidence must use a Vercel Preview hostname");
  return url.origin;
}

function validateHealth(check, status, body) {
  if (status !== check.httpStatus) fail(`${check.component} HTTP ${status}, expected ${check.httpStatus}`);
  if (!body || typeof body !== "object") fail(`${check.component} body must be JSON`);
  if (body.component !== check.component) fail(`${check.component} component drift`);
  if (body.ready !== check.ready || body.ok !== check.ready) fail(`${check.component} readiness drift`);
  if (body.status !== check.status) fail(`${check.component} status drift`);
  if (body.schemaVersion !== 1 || body.valuesExposed !== false) fail(`${check.component} health schema drift`);
}

async function request(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function runLive(config, runtimeConfig, baseUrl) {
  const base = validateStagingBaseUrl(baseUrl, runtimeConfig);
  const options = { method: "GET", redirect: "error", cache: "no-store" };

  for (const check of config.healthChecks) {
    const response = await request(base + check.path, options, config.requestPolicy.timeoutMs);
    let body;
    try { body = await response.json(); } catch { fail(`${check.component} health did not return JSON`); }
    validateHealth(check, response.status, body);
    console.log(`STAGING_SMOKE_HEALTH PASS component=${check.component} http=${response.status} ready=${body.ready}`);
  }

  for (const check of config.pageChecks) {
    const response = await request(base + check.path, options, config.requestPolicy.timeoutMs);
    if (response.status !== check.httpStatus) fail(`${check.name} HTTP ${response.status}, expected ${check.httpStatus}`);
    const type = response.headers.get("content-type") || "";
    if (!type.toLowerCase().includes("text/html")) fail(`${check.name} must return text/html`);
    const body = await response.text();
    if (!body.toLowerCase().includes("<html")) fail(`${check.name} response does not look like HTML`);
    console.log(`STAGING_SMOKE_PAGE PASS name=${check.name} http=${response.status}`);
  }

  console.log(`STAGING_SMOKE_LIVE PASS task=25.12 base=${base} health=${config.healthChecks.length} pages=${config.pageChecks.length}`);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const runtimeConfig = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, "utf8"));
const healthConfig = JSON.parse(fs.readFileSync(HEALTH_CONFIG_PATH, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const preGateSource = fs.readFileSync(PRE_GATE_PATH, "utf8");
const result = validate(config, runtimeConfig, healthConfig, packageJson, preGateSource);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const rejectConfig = (label, mutate) => {
    const candidate = structuredClone(config);
    mutate(candidate);
    let rejected = false;
    try { validate(candidate, runtimeConfig, healthConfig, packageJson, preGateSource); } catch { rejected = true; }
    if (!rejected) fail(`negative self-test not rejected: ${label}`);
    cases += 1;
  };
  const rejectUrl = (label, value) => {
    let rejected = false;
    try { validateStagingBaseUrl(value, runtimeConfig); } catch { rejected = true; }
    if (!rejected) fail(`negative URL self-test not rejected: ${label}`);
    cases += 1;
  };

  rejectConfig("staging gains production authority", c => { c.environment.productionAuthority = true; });
  rejectConfig("page route removed", c => { c.pageChecks.pop(); });
  rejectConfig("health check removed", c => { c.healthChecks.pop(); });
  rejectConfig("mutating requests allowed", c => { c.requestPolicy.mutatingRequestsForbidden = false; });
  rejectConfig("live evidence waived", c => { c.greenRules.liveSmokeEvidenceRequiredBeforeGreen = false; });
  rejectUrl("production URL", runtimeConfig.canonical_production_url);
  rejectUrl("localhost", "https://localhost");
  rejectUrl("non-Vercel host", "https://staging.example.com");

  let preGateRejected = false;
  try { validate(config, runtimeConfig, healthConfig, packageJson, preGateSource.replace('["scripts/verify-staging-smoke-suite-ci.mjs", "--self-test"]', "")); }
  catch { preGateRejected = true; }
  if (!preGateRejected) fail("negative pre-gate self-test not rejected");
  cases += 1;

  console.log(`STAGING_SMOKE_SUITE_SELF_TEST PASS cases=${cases} health=${result.healthChecks} pages=${result.pageChecks} fail_closed=true`);
} else if (process.argv.includes("--live")) {
  const idx = process.argv.indexOf("--live");
  await runLive(config, runtimeConfig, process.argv[idx + 1] || process.env.STAGING_BASE_URL);
} else {
  console.log(`STAGING_SMOKE_SUITE PASS task=25.12 health=${result.healthChecks} pages=${result.pageChecks} live_required_before_green=true`);
}
