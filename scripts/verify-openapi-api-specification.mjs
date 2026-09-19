import fs from "node:fs";
import path from "node:path";

const SPEC_PATH = "packages/contracts/openapi/enchev-api.v1.json";
const API_ROOT = "app/api";
const ALLOWED_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"];
const METHOD_KEYS = new Set(ALLOWED_METHODS.map((value) => value.toLowerCase()));

function fail(message) {
  throw new Error(`OPENAPI_API_SPECIFICATION FAIL: ${message}`);
}

function routeFiles(root) {
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "route.ts") out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

function routePath(file) {
  const relative = path.relative("app", path.dirname(file)).split(path.sep).join("/");
  return `/${relative}`;
}

function implementedOperations(source) {
  const found = [];
  for (const method of ALLOWED_METHODS) {
    const patterns = [
      new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`),
      new RegExp(`export\\s+function\\s+${method}\\s*\\(`),
      new RegExp(`export\\s+const\\s+${method}\\s*=`)
    ];
    if (patterns.some((pattern) => pattern.test(source))) found.push(method.toLowerCase());
  }
  return found;
}

export function validateSpec(spec, discovered) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail("spec must be an object");
  if (spec.openapi !== "3.1.0") fail("OpenAPI version must be 3.1.0");
  if (spec["x-enchev-task"] !== "24.01") fail("x-enchev-task must be 24.01");
  if (typeof spec["x-authority-boundary"] !== "string" || !spec["x-authority-boundary"].includes("PostgreSQL remains authoritative")) {
    fail("auction authority boundary is missing");
  }
  if (!spec.info || typeof spec.info.title !== "string" || !spec.info.title.trim()) fail("info.title is required");
  if (!spec.info.version || typeof spec.info.version !== "string") fail("info.version is required");
  if (!spec.paths || typeof spec.paths !== "object" || Array.isArray(spec.paths)) fail("paths must be an object");

  const actual = [];
  const operationIds = new Set();
  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    if (!apiPath.startsWith("/api/")) fail(`non-API path is forbidden: ${apiPath}`);
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) fail(`invalid path item: ${apiPath}`);
    for (const [key, operation] of Object.entries(pathItem)) {
      if (!METHOD_KEYS.has(key)) continue;
      actual.push(`${key.toUpperCase()} ${apiPath}`);
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) fail(`invalid operation: ${key} ${apiPath}`);
      if (typeof operation.operationId !== "string" || !operation.operationId.trim()) fail(`operationId missing: ${key} ${apiPath}`);
      if (operationIds.has(operation.operationId)) fail(`duplicate operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      if (!operation.responses || typeof operation.responses !== "object" || !Object.keys(operation.responses).length) {
        fail(`responses missing: ${key} ${apiPath}`);
      }
    }
  }

  const expected = [...discovered].sort();
  actual.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((item) => !actual.includes(item));
    const stale = actual.filter((item) => !expected.includes(item));
    fail(`route parity drift missing=[${missing.join(", ")}] stale=[${stale.join(", ")}]`);
  }

  const demo = spec.paths["/api/live-auction-clock"];
  const serializedDemo = JSON.stringify(demo);
  if (!serializedDemo.includes('"auctionAuthority"') || !serializedDemo.includes('"const":false')) {
    fail("live-auction demo must remain explicitly non-authoritative");
  }
  return { operations: actual.length, paths: Object.keys(spec.paths).length };
}

function discover() {
  const operations = [];
  for (const file of routeFiles(API_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    const methods = implementedOperations(source);
    if (!methods.length) fail(`no exported HTTP method found in ${file}`);
    const apiPath = routePath(file);
    for (const method of methods) operations.push(`${method.toUpperCase()} ${apiPath}`);
  }
  return operations.sort();
}

const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
const discovered = discover();
const result = validateSpec(spec, discovered);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  function rejected(label, mutate, discoveredOverride = discovered) {
    const copy = structuredClone(spec);
    mutate(copy);
    let didReject = false;
    try { validateSpec(copy, discoveredOverride); } catch { didReject = true; }
    if (!didReject) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  }

  rejected("missing task identity", (copy) => { delete copy["x-enchev-task"]; });
  rejected("missing authority boundary", (copy) => { delete copy["x-authority-boundary"]; });
  rejected("missing implemented route", (copy) => { delete copy.paths["/api/health/web"]; });
  rejected("stale documented method", (copy) => {
    copy.paths["/api/health/web"].post = {
      operationId: "staleWebPost",
      responses: { "200": { description: "stale" } }
    };
  });
  rejected("duplicate operationId", (copy) => {
    copy.paths["/api/health/api"].get.operationId = copy.paths["/api/health/web"].get.operationId;
  });
  rejected("demo authority drift", (copy) => {
    copy.components.schemas.LiveAuctionDemoClock.properties.auctionAuthority.const = true;
  });
  rejected("new implementation missing from spec", () => {}, [...discovered, "GET /api/example-untracked"].sort());

  console.log(`OPENAPI_API_SPECIFICATION_SELF_TEST PASS cases=${cases} operations=${result.operations} paths=${result.paths}`);
} else {
  console.log(`OPENAPI_API_SPECIFICATION PASS task=24.01 operations=${result.operations} paths=${result.paths} exact_route_parity=true authority_boundary=true`);
}
