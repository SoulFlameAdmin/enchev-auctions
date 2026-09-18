import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const WORKSPACE_PACKAGE = "apps/worker/package.json";
const BOUNDARY_PATH = "apps/worker/boundary.json";

function fail(message) {
  throw new Error(`APPS_WORKER_BOUNDARY FAIL: ${message}`);
}

export function validateAppsWorker(rootPackage, workspacePackage, boundary, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("apps/*")) fail('root package must register "apps/*" workspace');

  if (workspacePackage.name !== "@enchev/worker") fail("workspace package name drift");
  if (workspacePackage.private !== true) fail("apps/worker must remain private");
  if (workspacePackage.scripts?.verify !== "node ../../scripts/verify-apps-worker.mjs") fail("apps/worker verify script drift");

  if (boundary.task !== "02.04") fail("task must be 02.04");
  if (boundary.workspace !== "apps/worker") fail("workspace path drift");
  if (boundary.package !== "@enchev/worker") fail("boundary package drift");
  if (boundary.runtime !== "node-background-worker") fail("runtime drift");
  if (boundary.source_mode !== "workspace-shell") fail("source_mode drift");
  if (boundary.implementation_state !== "not-implemented") fail("02.04 must not claim worker implementation");
  if (boundary.single_source !== true) fail("single_source must stay true");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["background-job-boundary", "scheduled-job-contracts", "async-processing-boundary"]) {
    if (!owns.has(capability)) fail(`missing worker ownership capability ${capability}`);
  }

  const forbidden = new Set(boundary.does_not_own || []);
  for (const capability of ["auction-authority", "http-api-authority", "realtime-authority", "browser-ui", "david-automation"]) {
    if (!forbidden.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  if (!fsApi.existsSync("app/api/health/worker/route.ts")) fail("worker health endpoint contract missing");
  for (const forbiddenRuntime of [
    "apps/worker/server.ts",
    "apps/worker/server.mjs",
    "apps/worker/src/index.ts",
    "apps/worker/src/worker.ts"
  ]) {
    if (fsApi.existsSync(forbiddenRuntime)) fail(`runtime source present while implementation_state is not-implemented: ${forbiddenRuntime}`);
  }

  const readme = fsApi.readFileSync("apps/worker/README.md", "utf8");
  if (!readme.includes("tools/david/")) fail("README must separate product worker from DAVID automation");

  return true;
}

function expectRejected(label, mutate) {
  const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
  const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
  const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));

  let rejected = false;
  try {
    const mutated = mutate({ rootPackage, workspacePackage, boundary });
    validateAppsWorker(mutated.rootPackage, mutated.workspacePackage, mutated.boundary);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));
validateAppsWorker(rootPackage, workspacePackage, boundary);

if (process.argv.includes("--self-test")) {
  expectRejected("workspace registration removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: [] } }));
  expectRejected("workspace package renamed", (x) => ({ ...x, workspacePackage: { ...x.workspacePackage, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.05" } }));
  expectRejected("false runtime implementation claim", (x) => ({ ...x, boundary: { ...x.boundary, implementation_state: "ready" } }));
  expectRejected("DAVID automation ownership leaked to product worker", (x) => ({
    ...x,
    boundary: { ...x.boundary, does_not_own: x.boundary.does_not_own.filter((v) => v !== "david-automation") }
  }));
  console.log("APPS_WORKER_BOUNDARY_SELF_TEST PASS negative_cases=5");
} else {
  console.log("APPS_WORKER_BOUNDARY PASS workspace=apps/worker package=@enchev/worker implementation_state=not-implemented");
}
