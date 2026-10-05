import fs from "node:fs";

const ROOT_PACKAGE = "package.json";
const WORKSPACE_PACKAGE = "apps/realtime/package.json";
const BOUNDARY_PATH = "apps/realtime/boundary.json";
const RUNTIME_PATH = "apps/realtime/server.mjs";

function fail(message) {
  throw new Error(`APPS_REALTIME_BOUNDARY FAIL: ${message}`);
}

export function validateAppsRealtime(rootPackage, workspacePackage, boundary, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("apps/*")) fail('root package must register "apps/*" workspace');

  if (workspacePackage.name !== "@enchev/realtime") fail("workspace package name drift");
  if (workspacePackage.private !== true) fail("apps/realtime must remain private");
  if (workspacePackage.scripts?.start !== "node server.mjs") fail("apps/realtime start script drift");
  if (workspacePackage.scripts?.verify !== "node ../../scripts/verify-apps-realtime.mjs") fail("apps/realtime verify script drift");

  if (boundary.task !== "02.03") fail("task must be 02.03");
  if (boundary.workspace !== "apps/realtime") fail("workspace path drift");
  if (boundary.package !== "@enchev/realtime") fail("boundary package drift");
  if (boundary.runtime !== "node-realtime-service") fail("runtime drift");
  if (boundary.source_mode !== "runtime") fail("source_mode must reflect implemented runtime");
  if (boundary.implementation_state !== "implemented") fail("realtime runtime must remain explicitly implemented");
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
  if (!fsApi.existsSync(RUNTIME_PATH)) fail("realtime runtime source missing");

  const runtimeSource = fsApi.readFileSync(RUNTIME_PATH, "utf8");
  for (const marker of [
    'registry.transportAuthority !== false',
    'server.on("upgrade"',
    'url.pathname === "/publish"',
    'socket.write(encoded)'
  ]) {
    if (!runtimeSource.includes(marker)) fail(`runtime contract missing marker: ${marker}`);
  }

  for (const forbiddenAuthorityToken of [
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "enchev_place_bid",
    "public.enchev_auctions",
    "public.enchev_bids"
  ]) {
    if (runtimeSource.includes(forbiddenAuthorityToken)) {
      fail(`realtime runtime must not own auction persistence: ${forbiddenAuthorityToken}`);
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
  expectRejected("runtime state reverted", (x) => ({ ...x, boundary: { ...x.boundary, implementation_state: "not-implemented" } }));
  expectRejected("runtime source mode reverted", (x) => ({ ...x, boundary: { ...x.boundary, source_mode: "workspace-shell" } }));
  expectRejected("auction authority leaked to realtime", (x) => ({
    ...x,
    boundary: { ...x.boundary, does_not_own: x.boundary.does_not_own.filter((v) => v !== "auction-authority") }
  }));
  console.log("APPS_REALTIME_BOUNDARY_SELF_TEST PASS negative_cases=6");
} else {
  console.log("APPS_REALTIME_BOUNDARY PASS workspace=apps/realtime package=@enchev/realtime implementation_state=implemented");
}
