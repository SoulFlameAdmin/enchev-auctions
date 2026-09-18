import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const PACKAGE_JSON = "packages/config/package.json";
const BOUNDARY_PATH = "packages/config/boundary.json";
const SOURCE_PATH = "packages/config/src/index.ts";

function fail(message) {
  throw new Error(`PACKAGES_CONFIG_BOUNDARY FAIL: ${message}`);
}

function importedSpecifiers(source) {
  const matches = [];
  const patterns = [
    /\bimport\s+(?:[^"'\n]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^"'\n]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) matches.push(match[1]);
  }
  return matches;
}

export function validateConfigPackage(rootPackage, packageJson, boundary, source, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("packages/*")) fail('root package must register "packages/*" workspace');

  if (packageJson.name !== "@enchev/config") fail("package name drift");
  if (packageJson.private !== true) fail("packages/config must remain private");
  if (packageJson.types !== "./src/index.ts") fail("types entrypoint drift");
  if (packageJson.exports?.["."] !== "./src/index.ts") fail("public export entrypoint drift");
  if (packageJson.scripts?.verify !== "node ../../scripts/verify-packages-config.mjs") fail("verify script drift");

  if (boundary.task !== "02.07") fail("task must be 02.07");
  if (boundary.workspace !== "packages/config") fail("workspace path drift");
  if (boundary.package !== "@enchev/config") fail("boundary package drift");
  if (boundary.layer !== "config") fail("layer must be config");
  if (boundary.implementation_state !== "boundary-established") fail("implementation_state drift");
  if (boundary.secret_free !== true) fail("config package must remain secret free");
  if (boundary.runtime_env_reads !== false) fail("config package must not read runtime env directly");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["typed-config-contracts", "non-secret-defaults", "configuration-key-names"]) {
    if (!owns.has(capability)) fail(`missing config ownership capability ${capability}`);
  }

  const canonical = boundary.canonical_root_config || [];
  for (const path of [
    "config/enchev-environment-variables.json",
    "config/enchev-health-endpoints.json",
    "config/enchev-redis-environment.json",
    "config/enchev-supabase-project.json"
  ]) {
    if (!canonical.includes(path)) fail(`canonical root config registration missing: ${path}`);
    if (!fsApi.existsSync(path)) fail(`canonical root config file missing: ${path}`);
  }

  const doesNotOwn = new Set(boundary.does_not_own || []);
  for (const capability of [
    "secret-values",
    "provider-clients",
    "domain-authority",
    "http-runtime",
    "realtime-runtime",
    "background-jobs",
    "browser-ui"
  ]) {
    if (!doesNotOwn.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  if (/\bprocess\.env\b/.test(source)) fail("direct process.env reads are forbidden in packages/config");

  const imports = importedSpecifiers(source);
  for (const specifier of imports) {
    if (
      specifier === "next" ||
      specifier.startsWith("next/") ||
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier.startsWith("@supabase/") ||
      /(^|\/)app(s)?(\/|$)/.test(specifier)
    ) {
      fail(`runtime/framework import forbidden in config source: ${specifier}`);
    }
  }

  if (!source.includes('CONFIG_PACKAGE_NAME = "@enchev/config"')) fail("boundary marker export missing");
  if (!source.includes("secretFree: true")) fail("secret-free marker type missing");
  if (!source.includes("runtimeEnvReads: false")) fail("runtime-env-read marker type missing");

  return true;
}

function load() {
  return {
    rootPackage: JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8")),
    packageJson: JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")),
    boundary: JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8")),
    source: fs.readFileSync(SOURCE_PATH, "utf8")
  };
}

function expectRejected(label, mutate) {
  const state = load();
  let rejected = false;
  try {
    const mutated = mutate(state);
    validateConfigPackage(mutated.rootPackage, mutated.packageJson, mutated.boundary, mutated.source);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const current = load();
validateConfigPackage(current.rootPackage, current.packageJson, current.boundary, current.source);

if (process.argv.includes("--self-test")) {
  expectRejected("packages workspace removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: ["apps/*"] } }));
  expectRejected("package renamed", (x) => ({ ...x, packageJson: { ...x.packageJson, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.08" } }));
  expectRejected("secret-free disabled", (x) => ({ ...x, boundary: { ...x.boundary, secret_free: false } }));
  expectRejected("runtime env reads enabled", (x) => ({ ...x, boundary: { ...x.boundary, runtime_env_reads: true } }));
  expectRejected("direct process.env read", (x) => ({ ...x, source: x.source + '\nexport const leaked = process.env.SECRET;\n' }));
  expectRejected("Supabase provider import leak", (x) => ({ ...x, source: x.source + '\nimport "@supabase/supabase-js";\n' }));
  console.log("PACKAGES_CONFIG_BOUNDARY_SELF_TEST PASS negative_cases=7");
} else {
  console.log("PACKAGES_CONFIG_BOUNDARY PASS workspace=packages/config package=@enchev/config secret_free=true runtime_env_reads=false");
}
