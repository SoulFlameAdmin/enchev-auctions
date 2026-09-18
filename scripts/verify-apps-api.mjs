import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const WORKSPACE_PACKAGE = "apps/api/package.json";
const BOUNDARY_PATH = "apps/api/boundary.json";

function fail(message) {
  throw new Error(`APPS_API_BOUNDARY FAIL: ${message}`);
}

export function validateAppsApi(rootPackage, workspacePackage, boundary, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("apps/*")) fail('root package must register "apps/*" workspace');

  if (workspacePackage.name !== "@enchev/api") fail("workspace package name drift");
  if (workspacePackage.private !== true) fail("apps/api must remain private");
  if (workspacePackage.scripts?.verify !== "node ../../scripts/verify-apps-api.mjs") fail("apps/api verify script drift");

  if (boundary.task !== "02.02") fail("task must be 02.02");
  if (boundary.workspace !== "apps/api") fail("workspace path drift");
  if (boundary.package !== "@enchev/api") fail("boundary package drift");
  if (boundary.runtime !== "next-route-handlers") fail("runtime drift");
  if (boundary.source_mode !== "root-api-bridge") fail("source_mode drift");
  if (boundary.runtime_source !== "../../app/api") fail("runtime_source drift");
  if (boundary.single_source !== true) fail("single_source must stay true");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["http-api-boundary", "request-response-contracts", "health-api-routes"]) {
    if (!owns.has(capability)) fail(`missing API ownership capability ${capability}`);
  }

  const forbidden = new Set(boundary.does_not_own || []);
  for (const capability of ["auction-authority", "realtime-authority", "worker-jobs", "browser-ui"]) {
    if (!forbidden.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  if (!fsApi.existsSync("app/api")) fail("root API source missing: app/api");
  if (!fsApi.existsSync("app/api/health/api/route.ts")) fail("canonical API health route missing");

  for (const duplicate of ["apps/api/app", "apps/api/src/app", "apps/api/src/routes"]) {
    if (fsApi.existsSync(duplicate)) fail(`duplicate API source forbidden during bridge mode: ${duplicate}`);
  }

  return true;
}

function expectRejected(label, mutate) {
  const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
  const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
  const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));

  let rejected = false;
  try {
    const mutated = mutate({ rootPackage, workspacePackage, boundary });
    validateAppsApi(mutated.rootPackage, mutated.workspacePackage, mutated.boundary);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));
validateAppsApi(rootPackage, workspacePackage, boundary);

if (process.argv.includes("--self-test")) {
  expectRejected("workspace registration removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: [] } }));
  expectRejected("workspace package renamed", (x) => ({ ...x, workspacePackage: { ...x.workspacePackage, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.03" } }));
  expectRejected("duplicate source mode", (x) => ({ ...x, boundary: { ...x.boundary, single_source: false } }));
  expectRejected("auction authority leaked to API workspace", (x) => ({
    ...x,
    boundary: { ...x.boundary, does_not_own: x.boundary.does_not_own.filter((v) => v !== "auction-authority") }
  }));
  console.log("APPS_API_BOUNDARY_SELF_TEST PASS negative_cases=5");
} else {
  console.log("APPS_API_BOUNDARY PASS workspace=apps/api package=@enchev/api source_mode=root-api-bridge single_source=true");
}
