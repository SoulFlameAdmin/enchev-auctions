import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const PACKAGE_JSON = "packages/domain/package.json";
const BOUNDARY_PATH = "packages/domain/boundary.json";
const SOURCE_PATH = "packages/domain/src/index.ts";

function fail(message) {
  throw new Error(`PACKAGES_DOMAIN_BOUNDARY FAIL: ${message}`);
}

export function validateDomainPackage(rootPackage, packageJson, boundary, source) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("packages/*")) fail('root package must register "packages/*" workspace');

  if (packageJson.name !== "@enchev/domain") fail("package name drift");
  if (packageJson.private !== true) fail("packages/domain must remain private");
  if (packageJson.types !== "./src/index.ts") fail("types entrypoint drift");
  if (packageJson.exports?.["."] !== "./src/index.ts") fail("public export entrypoint drift");
  if (packageJson.scripts?.verify !== "node ../../scripts/verify-packages-domain.mjs") fail("verify script drift");

  if (boundary.task !== "02.05") fail("task must be 02.05");
  if (boundary.workspace !== "packages/domain") fail("workspace path drift");
  if (boundary.package !== "@enchev/domain") fail("boundary package drift");
  if (boundary.layer !== "domain") fail("layer must be domain");
  if (boundary.implementation_state !== "boundary-established") fail("implementation_state drift");
  if (boundary.framework_independent !== true) fail("domain package must remain framework independent");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["domain-types", "domain-value-objects", "domain-invariants"]) {
    if (!owns.has(capability)) fail(`missing domain ownership capability ${capability}`);
  }

  const forbiddenOwnership = new Set(boundary.does_not_own || []);
  for (const capability of [
    "http-transport",
    "realtime-transport",
    "background-jobs",
    "browser-ui",
    "provider-integrations",
    "persistence-adapters"
  ]) {
    if (!forbiddenOwnership.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  const forbiddenTokens = [
    "from \"next",
    "from 'next",
    "from \"react",
    "from 'react",
    "@supabase/",
    "app/",
    "apps/"
  ];
  for (const token of forbiddenTokens) {
    if (source.includes(token)) fail(`framework/runtime coupling forbidden in domain source: ${token}`);
  }

  if (!source.includes('DOMAIN_PACKAGE_NAME = "@enchev/domain"')) fail("boundary marker export missing");
  if (!source.includes("frameworkIndependent: true")) fail("framework-independent marker type missing");

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
    validateDomainPackage(mutated.rootPackage, mutated.packageJson, mutated.boundary, mutated.source);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const current = load();
validateDomainPackage(current.rootPackage, current.packageJson, current.boundary, current.source);

if (process.argv.includes("--self-test")) {
  expectRejected("packages workspace removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: ["apps/*"] } }));
  expectRejected("package renamed", (x) => ({ ...x, packageJson: { ...x.packageJson, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.06" } }));
  expectRejected("framework independence disabled", (x) => ({ ...x, boundary: { ...x.boundary, framework_independent: false } }));
  expectRejected("Next dependency leak", (x) => ({ ...x, source: x.source + '\nimport "next/server";\n' }));
  expectRejected("app layer leak", (x) => ({ ...x, source: x.source + '\n// app/private-runtime\n' }));
  console.log("PACKAGES_DOMAIN_BOUNDARY_SELF_TEST PASS negative_cases=6");
} else {
  console.log("PACKAGES_DOMAIN_BOUNDARY PASS workspace=packages/domain package=@enchev/domain framework_independent=true");
}
