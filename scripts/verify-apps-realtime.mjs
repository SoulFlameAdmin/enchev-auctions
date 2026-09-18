import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const WORKSPACE_PACKAGE = "apps/realtime/package.json";
const BOUNDARY_PATH = "apps/realtime/boundary.json";

function fail(message) {
  throw new Error(`APPS_REALTIME_BOUNDARY FAIL: ${message}`);
}

export function validateAppsRealtime(rootPackage, workspacePackage, boundary, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("apps/*")) fail('root package must register "apps/*" workspace');

  if (workspacePackage.name !== "@enchev/realtime") fail("workspace package name drift");
  if (workspacePackage.private !== true) fail("apps/realtime must remain private");
  if (workspacePackage.scripts?.verify !== "node ../../scripts/verify-apps-realtime.mjs") fail("apps/realtime verify script drift");

  if (boundary.task !== "02.03") fail("task must be 02.03");
  if (boundary.workspace !== "apps/realtime") fail("workspace path drift");
  if (boundary.package !== "@enchev/realtime") fail("boundary package drift");
  if (boundary.runtime !== "node-realtime-service") fail("runtime drift");
  if (boundary.source_mode !== "workspace-shell") fail("source_mode drift");
  if (boundary.implementation_state !== "not-implemented") fail("02.03 must not claim realtime implementation");
  if (boundary.single_source !== true) fail("single_source must stay true");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["realtime-service-boundary", "socket-room-contracts", "presence-delivery-boundary"]) {
    if (!owns.has(capability)) fail(`missing realtime ownership capability ${capability}`);
  }

  const forbidden = new Set(boundary.does_not_own || []);
  for (const capability of ["auction-authority", "http-api-authority", "worker-jobs", "browser-ui"]) {
    if (!forbidden.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  if (!fsApi.existsSync("app/api/health/realtime/route.ts")) fail("realtime health endpoint contract missing");
  for (const forbiddenRuntime of [
    "apps/realtime/server.ts",
    "apps/realtime/server.mjs",
    "apps/realtime/src/server.ts",
    "apps/realtime/src/index.ts"
  ]) {
    if (fsApi.existsSync(forbiddenRuntime)) {
      fail(`runtime source present while implementation_state is not-implemented: ${forbiddenRuntime}`);
    }
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
    validateAppsRealtime(mutated.rootPackage, mutated.workspacePackage, mutated.boundary);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));
validateAppsRealtime(rootPackage, workspacePackage, boundary);

if (process.argv.includes("--self-test")) {
  expectRejected("workspace registration removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: [] } }));
  expectRejected("workspace package renamed", (x) => ({ ...x, workspacePackage: { ...x.workspacePackage, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.04" } }));
  expectRejected("false runtime implementation claim", (x) => ({ ...x, boundary: { ...x.boundary, implementation_state: "ready" } }));
  expectRejected("auction authority leaked to realtime", (x) => ({
    ...x,
    boundary: { ...x.boundary, does_not_own: x.boundary.does_not_own.filter((v) => v !== "auction-authority") }
  }));
  console.log("APPS_REALTIME_BOUNDARY_SELF_TEST PASS negative_cases=5");
} else {
  console.log("APPS_REALTIME_BOUNDARY PASS workspace=apps/realtime package=@enchev/realtime implementation_state=not-implemented");
}
