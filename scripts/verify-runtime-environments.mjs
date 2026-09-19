import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "config/enchev-runtime-environments.json";
const SOURCE_PATH = "packages/config/src/runtime-environment.ts";
const INDEX_PATH = "packages/config/src/index.ts";
const ENV_VAR_CONFIG_PATH = "config/enchev-environment-variables.json";
const DOC_PATH = "docs/01_07_LOCAL_STAGING_PRODUCTION_ENVIRONMENTS.md";

const TOP_KEYS = [
  "canonical_production_url",
  "environments",
  "invariants",
  "name",
  "provider_bindings_may_be_pending",
  "schema_version",
  "secret_values_in_repository",
  "staging_mode",
  "task"
];

const ENV_KEYS = [
  "branch_policy",
  "name",
  "platform",
  "platform_environment",
  "production_authority",
  "url_policy"
];

function fail(message) {
  throw new Error(`RUNTIME_ENVIRONMENTS FAIL: ${message}`);
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} fields drift`);
  }
}

export function validateConfig(config, envVarConfig) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fail("config must be an object");
  }

  exactKeys(config, TOP_KEYS, "config");

  if (config.task !== "01.07") fail("task must be 01.07");
  if (config.name !== "Local / staging / production environments") fail("name drift");
  if (config.schema_version !== 1) fail("schema_version must be 1");
  if (config.secret_values_in_repository !== false) {
    fail("secret_values_in_repository must remain false");
  }
  if (config.staging_mode !== "vercel-preview") {
    fail("staging_mode must remain vercel-preview");
  }
  if (config.provider_bindings_may_be_pending !== true) {
    fail("provider bindings must be allowed to remain pending until owning tasks are GREEN");
  }

  let productionUrl;
  try {
    productionUrl = new URL(config.canonical_production_url);
  } catch {
    fail("canonical_production_url must be a valid URL");
  }
  if (
    productionUrl.protocol !== "https:" ||
    productionUrl.hostname !== "enchev-auctions.vercel.app" ||
    productionUrl.pathname !== "/"
  ) {
    fail("canonical production URL drift");
  }

  if (!Array.isArray(config.environments) || config.environments.length !== 3) {
    fail("exactly three runtime environments are required");
  }

  const expected = [
    {
      name: "local",
      platform: "local",
      platform_environment: "development",
      branch_policy: "developer-worktree",
      url_policy: "localhost-only",
      production_authority: false
    },
    {
      name: "staging",
      platform: "vercel",
      platform_environment: "preview",
      branch_policy: "non-main",
      url_policy: "unique-preview-url",
      production_authority: false
    },
    {
      name: "production",
      platform: "vercel",
      platform_environment: "production",
      branch_policy: "main-only",
      url_policy: "canonical-project-url",
      production_authority: true
    }
  ];

  for (let index = 0; index < expected.length; index += 1) {
    const actual = config.environments[index];
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      fail(`environments[${index}] must be an object`);
    }
    exactKeys(actual, ENV_KEYS, `environments[${index}]`);
    if (JSON.stringify(actual) !== JSON.stringify(expected[index])) {
      fail(`${expected[index].name} environment contract drift`);
    }
  }

  const wantedInvariants = [
    "local-never-production-authority",
    "preview-never-production-authority",
    "production-authority-main-only",
    "environment-specific-provider-bindings-can-remain-pending"
  ];
  if (JSON.stringify(config.invariants) !== JSON.stringify(wantedInvariants)) {
    fail("environment invariants drift");
  }

  const wantedTargets = ["local", "ci", "staging", "production"];
  if (
    !envVarConfig ||
    JSON.stringify(envVarConfig.validation_targets) !== JSON.stringify(wantedTargets)
  ) {
    fail("01.08 environment variable validation targets must cover local/ci/staging/production");
  }

  return config.environments;
}

function verifySourceContract(source, indexSource, docSource) {
  if (!indexSource.includes('export * from "./runtime-environment";')) {
    fail("packages/config public entrypoint must export runtime-environment");
  }

  for (const token of [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (source.includes(token)) {
      fail(`runtime/secret token forbidden in pure environment resolver: ${token}`);
    }
  }

  for (const token of [
    "RUNTIME_ENVIRONMENT_MODEL_VERSION = 1",
    'platformEnvironment === "development"',
    'platformEnvironment === "preview"',
    'platformEnvironment === "production"',
    'environment: "local"',
    'environment: "staging"',
    'environment: "production"',
    "export function resolveRuntimeEnvironment",
    "export function isProductionRuntimeEnvironment"
  ]) {
    if (!source.includes(token)) fail(`source contract missing token: ${token}`);
  }

  for (const token of [
    "Why Vercel Preview is the staging environment",
    "VERCEL_ENV",
    "Preview/staging is never production authority",
    "01.06 Redis/Valkey remains YELLOW",
    "does not require",
    "manual Vercel create/update/redeploy"
  ]) {
    if (!docSource.includes(token)) {
      fail(`documentation boundary missing: ${token}`);
    }
  }
}

async function loadRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchev-runtime-environments-"));
  try {
    const tscPath = path.resolve("node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [
      tscPath,
      SOURCE_PATH,
      "--ignoreConfig",
      "--target", "ES2022",
      "--module", "ES2022",
      "--moduleResolution", "Bundler",
      "--skipLibCheck",
      "--outDir", tempDir,
      "--pretty", "false"
    ], { encoding: "utf8" });

    if (result.status !== 0) {
      fail(`TypeScript compile failed: ${(result.stderr || result.stdout || "").trim()}`);
    }

    const compiled = path.join(tempDir, "runtime-environment.js");
    if (!fs.existsSync(compiled)) {
      fail("compiled runtime environment module was not produced");
    }
    return await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function expectRejected(label, fn) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const envVarConfig = JSON.parse(fs.readFileSync(ENV_VAR_CONFIG_PATH, "utf8"));
const source = fs.readFileSync(SOURCE_PATH, "utf8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const docSource = fs.readFileSync(DOC_PATH, "utf8");

validateConfig(config, envVarConfig);
verifySourceContract(source, indexSource, docSource);

const runtime = await loadRuntime();
if (runtime.RUNTIME_ENVIRONMENT_MODEL_VERSION !== 1) {
  fail("runtime model version drift");
}

const cases = [
  ["development", "local", false],
  ["preview", "staging", false],
  ["production", "production", true]
];

for (const [platformEnvironment, environment, productionAuthority] of cases) {
  const result = runtime.resolveRuntimeEnvironment(platformEnvironment);
  if (!result.ok) fail(`${platformEnvironment} mapping was rejected`);
  if (result.environment !== environment) {
    fail(`${platformEnvironment} mapped to ${result.environment}, expected ${environment}`);
  }
  if (result.productionAuthority !== productionAuthority) {
    fail(`${platformEnvironment} production authority drift`);
  }
}

for (const invalid of [null, "", "staging", "prod", "test", 42]) {
  const result = runtime.resolveRuntimeEnvironment(invalid);
  if (result.ok) fail(`unknown platform environment was accepted: ${String(invalid)}`);
}

if (runtime.isProductionRuntimeEnvironment("development")) {
  fail("development must not be production authority");
}
if (runtime.isProductionRuntimeEnvironment("preview")) {
  fail("preview must not be production authority");
}
if (!runtime.isProductionRuntimeEnvironment("production")) {
  fail("production must be production authority");
}

if (process.argv.includes("--self-test")) {
  expectRejected("preview production authority", () => validateConfig({
    ...config,
    environments: config.environments.map((item) =>
      item.name === "staging" ? { ...item, production_authority: true } : item
    )
  }, envVarConfig));

  expectRejected("local production authority", () => validateConfig({
    ...config,
    environments: config.environments.map((item) =>
      item.name === "local" ? { ...item, production_authority: true } : item
    )
  }, envVarConfig));

  expectRejected("staging on main", () => validateConfig({
    ...config,
    environments: config.environments.map((item) =>
      item.name === "staging" ? { ...item, branch_policy: "main-only" } : item
    )
  }, envVarConfig));

  expectRejected("invalid production URL", () => validateConfig({
    ...config,
    canonical_production_url: "http://localhost:3000"
  }, envVarConfig));

  expectRejected("missing staging validation target", () => validateConfig(
    config,
    { ...envVarConfig, validation_targets: ["local", "ci", "production"] }
  ));

  let rejectedEnvRead = false;
  try {
    verifySourceContract(
      source + "\nconst direct = process.env.VERCEL_ENV;\n",
      indexSource,
      docSource
    );
  } catch {
    rejectedEnvRead = true;
  }
  if (!rejectedEnvRead) fail("source contract did not reject direct runtime env read");

  let rejectedMissingExport = false;
  try {
    verifySourceContract(
      source,
      indexSource.replace('export * from "./runtime-environment";', ""),
      docSource
    );
  } catch {
    rejectedMissingExport = true;
  }
  if (!rejectedMissingExport) fail("source contract did not reject missing public export");

  console.log("RUNTIME_ENVIRONMENTS_SELF_TEST PASS mapping_cases=3 runtime_negative_cases=6 source_config_negative_cases=7 staging=vercel-preview production_authority_fail_closed=true");
} else {
  console.log("RUNTIME_ENVIRONMENTS PASS task=01.07 environments=3 local=development staging=preview production=production production_authority_fail_closed=true");
}
