import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPEC_PATH = path.join(ROOT, "packages/contracts/openapi/enchev-api.v1.json");
const API_ROOT = path.join(ROOT, "app/api");
const HTTP_METHODS = ["get","post","put","patch","delete","options","head"];

function fail(message) {
  throw new Error(`24.01_OPENAPI_API_SPECIFICATION FAIL: ${message}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function discoverImplementedRoutes() {
  const routes = new Map();
  for (const file of walk(API_ROOT).filter((p) => /route\.(ts|tsx|js|mjs)$/.test(p))) {
    const relDir = path.relative(path.join(ROOT, "app"), path.dirname(file)).replaceAll(path.sep, "/");
    const routePath = "/" + relDir
      .replace(/\[\.\.\.([^\]]+)\]/g, "{$1}")
      .replace(/\[([^\]]+)\]/g, "{$1}");
    const source = fs.readFileSync(file, "utf8");
    const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g)]
      .map((m) => m[1].toLowerCase())
      .sort();
    if (methods.length === 0) fail(`route file has no exported HTTP method: ${path.relative(ROOT,file)}`);
    routes.set(routePath, methods);
  }
  return routes;
}

function validate(spec) {
  if (spec.openapi !== "3.1.0") fail("openapi must be exactly 3.1.0");
  if (!spec.info || typeof spec.info.title !== "string" || typeof spec.info.version !== "string") {
    fail("info.title and info.version are required");
  }
  if (spec.jsonSchemaDialect !== "https://json-schema.org/draft/2020-12/schema") {
    fail("jsonSchemaDialect must be JSON Schema 2020-12");
  }

  const implemented = discoverImplementedRoutes();
  const documentedPaths = Object.keys(spec.paths || {}).sort();
  const implementedPaths = [...implemented.keys()].sort();

  if (JSON.stringify(documentedPaths) !== JSON.stringify(implementedPaths)) {
    fail(`path inventory mismatch implemented=${implementedPaths.join(",")} documented=${documentedPaths.join(",")}`);
  }

  const operationIds = new Set();
  for (const [routePath, methods] of implemented) {
    const item = spec.paths[routePath];
    const documentedMethods = HTTP_METHODS.filter((method) => item?.[method]).sort();
    if (JSON.stringify(documentedMethods) !== JSON.stringify(methods)) {
      fail(`method inventory mismatch for ${routePath}: implemented=${methods.join(",")} documented=${documentedMethods.join(",")}`);
    }
    for (const method of methods) {
      const operation = item[method];
      if (typeof operation.operationId !== "string" || !operation.operationId.trim()) {
        fail(`missing operationId for ${method.toUpperCase()} ${routePath}`);
      }
      if (operationIds.has(operation.operationId)) fail(`duplicate operationId ${operation.operationId}`);
      operationIds.add(operation.operationId);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        fail(`responses required for ${method.toUpperCase()} ${routePath}`);
      }
    }
  }

  const demoGet = spec.paths["/api/live-auction-clock"]?.get;
  const demoPost = spec.paths["/api/live-auction-clock"]?.post;
  if (!String(demoGet?.description || "").includes("auctionAuthority is always false")) {
    fail("demo GET must explicitly declare non-authoritative auction behavior");
  }
  if (!String(demoPost?.description || "").includes("not the authoritative auction bid path")) {
    fail("demo POST must explicitly declare non-authoritative bid behavior");
  }
  const demoSchema = spec.components?.schemas?.LiveAuctionClockResponse;
  if (demoSchema?.properties?.auctionAuthority?.const !== false) {
    fail("LiveAuctionClockResponse.auctionAuthority must be const false");
  }

  const raw = JSON.stringify(spec);
  for (const forbidden of ["sk_live_","service_role","SUPABASE_SERVICE_ROLE_KEY","VERCEL_TOKEN"]) {
    if (raw.includes(forbidden)) fail(`secret-like token must not appear in API spec: ${forbidden}`);
  }

  return { paths: implementedPaths.length, operations: operationIds.size };
}

function readSpec() {
  return JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
}

if (process.argv.includes("--self-test")) {
  const base = readSpec();
  const cases = [];

  {
    const x = structuredClone(base);
    x.openapi = "3.0.3";
    cases.push(["wrong-version", x]);
  }
  {
    const x = structuredClone(base);
    delete x.paths["/api/health/web"];
    cases.push(["missing-route", x]);
  }
  {
    const x = structuredClone(base);
    x.paths["/api/future-invented"] = { get: { operationId:"invented", responses:{"200":{description:"no"}} } };
    cases.push(["invented-route", x]);
  }
  {
    const x = structuredClone(base);
    delete x.paths["/api/live-auction-clock"].post;
    cases.push(["missing-method", x]);
  }
  {
    const x = structuredClone(base);
    x.paths["/api/health/web"].get.operationId = x.paths["/api/health/api"].get.operationId;
    cases.push(["duplicate-operation-id", x]);
  }
  {
    const x = structuredClone(base);
    x.components.schemas.LiveAuctionClockResponse.properties.auctionAuthority.const = true;
    cases.push(["authority-regression", x]);
  }

  for (const [name, candidate] of cases) {
    let rejected = false;
    try { validate(candidate); } catch { rejected = true; }
    if (!rejected) fail(`self-test did not reject ${name}`);
  }
  console.log(`24.01_OPENAPI_API_SPECIFICATION_SELF_TEST PASS cases=${cases.length}`);
} else {
  const result = validate(readSpec());
  console.log(`24.01_OPENAPI_API_SPECIFICATION PASS paths=${result.paths} operations=${result.operations} openapi=3.1.0`);
}
