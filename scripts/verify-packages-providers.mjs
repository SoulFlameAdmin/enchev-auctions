import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const PACKAGE_JSON = "packages/providers/package.json";
const BOUNDARY_PATH = "packages/providers/boundary.json";
const SOURCE_PATH = "packages/providers/src/index.ts";

function fail(message) {
  throw new Error(`PACKAGES_PROVIDERS_BOUNDARY FAIL: ${message}`);
}

export function validateProvidersPackage(rootPackage, packageJson, boundary, source) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("packages/*")) fail('root package must register "packages/*" workspace');

  if (packageJson.name !== "@enchev/providers") fail("package name drift");
  if (packageJson.private !== true) fail("packages/providers must remain private");
  if (packageJson.types !== "./src/index.ts") fail("types entrypoint drift");
  if (packageJson.exports?.["."] !== "./src/index.ts") fail("public export entrypoint drift");
  if (packageJson.scripts?.verify !== "node ../../scripts/verify-packages-providers.mjs") fail("verify script drift");

  if (boundary.task !== "02.08") fail("task must be 02.08");
  if (boundary.workspace !== "packages/providers") fail("workspace path drift");
  if (boundary.package !== "@enchev/providers") fail("boundary package drift");
  if (boundary.layer !== "providers") fail("layer must be providers");
  if (boundary.implementation_state !== "boundary-established") fail("implementation_state drift");
  if (boundary.credential_free !== true) fail("provider boundary must be credential-free");
  if (boundary.direct_runtime_env_reads !== false) fail("direct runtime env reads must remain disabled");
  if (boundary.concrete_provider_clients !== false) fail("02.08 must not claim concrete provider clients");

  const owns = new Set(boundary.owns || []);
  for (const capability of [
    "provider-adapter-boundary",
    "provider-client-interfaces",
    "external-service-integration-boundary"
  ]) {
    if (!owns.has(capability)) fail(`missing provider ownership capability ${capability}`);
  }

  const doesNotOwn = new Set(boundary.does_not_own || []);
  for (const capability of [
    "domain-authority",
    "configuration-authority",
    "secret-storage",
    "business-workflows",
    "browser-ui",
    "auction-authority",
    "database-authority"
  ]) {
    if (!doesNotOwn.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  const forbiddenSourceTokens = [
    "process.env",
    "Deno.env",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "VERCEL_OIDC_TOKEN",
    "BEGIN PRIVATE KEY",
    "sk_live_",
    "sk-proj-"
  ];
  for (const token of forbiddenSourceTokens) {
    if (source.includes(token)) fail(`credential/runtime token forbidden in providers source: ${token}`);
  }

  if (!source.includes('PROVIDERS_PACKAGE_NAME = "@enchev/providers"')) fail("boundary marker export missing");
  if (!source.includes("credentialFree: true")) fail("credential-free marker type missing");
  if (!source.includes("concreteProviderClients: false")) fail("concrete-client marker type missing");

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
    validateProvidersPackage(mutated.rootPackage, mutated.packageJson, mutated.boundary, mutated.source);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const current = load();
validateProvidersPackage(current.rootPackage, current.packageJson, current.boundary, current.source);

if (process.argv.includes("--self-test")) {
  expectRejected("packages workspace removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: ["apps/*"] } }));
  expectRejected("package renamed", (x) => ({ ...x, packageJson: { ...x.packageJson, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.09" } }));
  expectRejected("credential-free disabled", (x) => ({ ...x, boundary: { ...x.boundary, credential_free: false } }));
  expectRejected("runtime env reads enabled", (x) => ({ ...x, boundary: { ...x.boundary, direct_runtime_env_reads: true } }));
  expectRejected("false concrete client claim", (x) => ({ ...x, boundary: { ...x.boundary, concrete_provider_clients: true } }));
  expectRejected("runtime secret read leaked", (x) => ({ ...x, source: x.source + '\nconst x = process.env.REDIS_URL;\n' }));
  expectRejected("secret literal leaked", (x) => ({ ...x, source: x.source + '\nconst x = "SUPABASE_SERVICE_ROLE_KEY";\n' }));
  console.log("PACKAGES_PROVIDERS_BOUNDARY_SELF_TEST PASS negative_cases=8");
} else {
  console.log("PACKAGES_PROVIDERS_BOUNDARY PASS workspace=packages/providers package=@enchev/providers credential_free=true");
}
