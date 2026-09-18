import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const PACKAGE_JSON = "packages/contracts/package.json";
const BOUNDARY_PATH = "packages/contracts/boundary.json";
const SOURCE_PATH = "packages/contracts/src/index.ts";

function fail(message) {
  throw new Error(`PACKAGES_CONTRACTS_BOUNDARY FAIL: ${message}`);
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

export function validateContractsPackage(rootPackage, packageJson, boundary, source) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("packages/*")) fail('root package must register "packages/*" workspace');

  if (packageJson.name !== "@enchev/contracts") fail("package name drift");
  if (packageJson.private !== true) fail("packages/contracts must remain private");
  if (packageJson.types !== "./src/index.ts") fail("types entrypoint drift");
  if (packageJson.exports?.["."] !== "./src/index.ts") fail("public export entrypoint drift");
  if (packageJson.scripts?.verify !== "node ../../scripts/verify-packages-contracts.mjs") fail("verify script drift");

  if (boundary.task !== "02.06") fail("task must be 02.06");
  if (boundary.workspace !== "packages/contracts") fail("workspace path drift");
  if (boundary.package !== "@enchev/contracts") fail("boundary package drift");
  if (boundary.layer !== "contracts") fail("layer must be contracts");
  if (boundary.implementation_state !== "boundary-established") fail("implementation_state drift");
  if (boundary.transport_neutral !== true) fail("contracts package must remain transport neutral");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["request-response-dtos", "event-contracts", "validation-schema-interfaces"]) {
    if (!owns.has(capability)) fail(`missing contracts ownership capability ${capability}`);
  }

  const doesNotOwn = new Set(boundary.does_not_own || []);
  for (const capability of [
    "domain-authority",
    "http-runtime",
    "realtime-runtime",
    "background-jobs",
    "browser-ui",
    "provider-clients",
    "persistence-adapters"
  ]) {
    if (!doesNotOwn.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

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
      fail(`runtime/framework import forbidden in contracts source: ${specifier}`);
    }
  }

  if (!source.includes('CONTRACTS_PACKAGE_NAME = "@enchev/contracts"')) fail("boundary marker export missing");
  if (!source.includes("transportNeutral: true")) fail("transport-neutral marker type missing");

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
    validateContractsPackage(mutated.rootPackage, mutated.packageJson, mutated.boundary, mutated.source);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const current = load();
validateContractsPackage(current.rootPackage, current.packageJson, current.boundary, current.source);

if (process.argv.includes("--self-test")) {
  expectRejected("packages workspace removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: ["apps/*"] } }));
  expectRejected("package renamed", (x) => ({ ...x, packageJson: { ...x.packageJson, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.07" } }));
  expectRejected("transport neutrality disabled", (x) => ({ ...x, boundary: { ...x.boundary, transport_neutral: false } }));
  expectRejected("Next runtime import leak", (x) => ({ ...x, source: x.source + '\nimport "next/server";\n' }));
  expectRejected("Supabase provider import leak", (x) => ({ ...x, source: x.source + '\nimport "@supabase/supabase-js";\n' }));
  expectRejected("application runtime import leak", (x) => ({ ...x, source: x.source + '\nexport { x } from "../../../apps/api/x";\n' }));
  console.log("PACKAGES_CONTRACTS_BOUNDARY_SELF_TEST PASS negative_cases=7");
} else {
  console.log("PACKAGES_CONTRACTS_BOUNDARY PASS workspace=packages/contracts package=@enchev/contracts transport_neutral=true");
}
