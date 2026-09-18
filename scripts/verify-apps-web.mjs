import fs from "node:fs";
import path from "node:path";

const ROOT_PACKAGE = "package.json";
const WORKSPACE_PACKAGE = "apps/web/package.json";
const BOUNDARY_PATH = "apps/web/boundary.json";

function fail(message) {
  throw new Error(`APPS_WEB_BOUNDARY FAIL: ${message}`);
}

export function validateAppsWeb(rootPackage, workspacePackage, boundary, fsApi = fs) {
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  if (!workspaces.includes("apps/*")) fail('root package must register "apps/*" workspace');

  if (workspacePackage.name !== "@enchev/web") fail("workspace package name drift");
  if (workspacePackage.private !== true) fail("apps/web must remain private");
  if (workspacePackage.scripts?.verify !== "node ../../scripts/verify-apps-web.mjs") fail("apps/web verify script drift");

  if (boundary.task !== "02.01") fail("task must be 02.01");
  if (boundary.workspace !== "apps/web") fail("workspace path drift");
  if (boundary.package !== "@enchev/web") fail("boundary package drift");
  if (boundary.runtime !== "nextjs") fail("runtime must be nextjs");
  if (boundary.source_mode !== "root-app-bridge") fail("source_mode drift");
  if (boundary.runtime_source !== "../../app") fail("runtime_source drift");
  if (boundary.single_source !== true) fail("single_source must stay true");

  const owns = new Set(boundary.owns || []);
  for (const capability of ["browser-ui", "web-routes", "next-route-handlers"]) {
    if (!owns.has(capability)) fail(`missing web ownership capability ${capability}`);
  }

  const forbidden = new Set(boundary.does_not_own || []);
  for (const capability of ["auction-authority", "realtime-authority", "worker-jobs"]) {
    if (!forbidden.has(capability)) fail(`missing explicit non-ownership capability ${capability}`);
  }

  for (const source of ["app/layout.tsx", "app/page.tsx"]) {
    if (!fsApi.existsSync(source)) fail(`root web source missing: ${source}`);
  }

  for (const duplicate of ["apps/web/app", "apps/web/src/app"]) {
    if (fsApi.existsSync(duplicate)) fail(`duplicate Next app source forbidden during bridge mode: ${duplicate}`);
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
    validateAppsWeb(mutated.rootPackage, mutated.workspacePackage, mutated.boundary);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8"));
const workspacePackage = JSON.parse(fs.readFileSync(WORKSPACE_PACKAGE, "utf8"));
const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, "utf8"));
validateAppsWeb(rootPackage, workspacePackage, boundary);

if (process.argv.includes("--self-test")) {
  expectRejected("workspace registration removed", (x) => ({ ...x, rootPackage: { ...x.rootPackage, workspaces: [] } }));
  expectRejected("workspace package renamed", (x) => ({ ...x, workspacePackage: { ...x.workspacePackage, name: "@enchev/other" } }));
  expectRejected("wrong frozen task", (x) => ({ ...x, boundary: { ...x.boundary, task: "02.02" } }));
  expectRejected("duplicate source mode", (x) => ({ ...x, boundary: { ...x.boundary, single_source: false } }));
  expectRejected("authoritative auction ownership leaked to web", (x) => ({
    ...x,
    boundary: { ...x.boundary, does_not_own: x.boundary.does_not_own.filter((v) => v !== "auction-authority") }
  }));
  console.log("APPS_WEB_BOUNDARY_SELF_TEST PASS negative_cases=5");
} else {
  console.log("APPS_WEB_BOUNDARY PASS workspace=apps/web package=@enchev/web source_mode=root-app-bridge single_source=true");
}
