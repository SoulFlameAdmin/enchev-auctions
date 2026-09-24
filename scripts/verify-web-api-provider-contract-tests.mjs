import fs from "node:fs";
import path from "node:path";

const TASK = "24.14";
const API_ROOT = "app/api";
const INVENTORY_PATH = "config/enchev-api-endpoint-inventory.json";
const OPENAPI_PATH = "packages/contracts/openapi/enchev-api.v1.json";
const API_BOUNDARY_PATH = "apps/api/boundary.json";
const PROVIDER_BOUNDARY_PATH = "packages/providers/boundary.json";
const PROVIDER_SOURCE_PATH = "packages/providers/src/index.ts";
const WEB_CONSUMER_PATH = "app/live-auctions/page.tsx";

function fail(message) {
  throw new Error(`${TASK} WEB_API_PROVIDER_CONTRACT_TESTS FAIL: ${message}`);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

function discoverRoutes(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "route.ts") files.push(full.replaceAll("\\", "/"));
    }
  };
  walk(root);
  return files.sort();
}

function routePath(file) {
  return "/api/" + file.slice(API_ROOT.length + 1).replace(/\/route\.ts$/, "");
}
function methods(source) {
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g)]
    .map((m) => m[1]);
}
function ordered(items) {
  return [...items].sort((a,b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

export function validate(x) {
  if (x.inventory.task !== "24.09" || x.inventory.sourceOfTruth !== OPENAPI_PATH || x.inventory.implementationRoot !== API_ROOT) {
    fail("endpoint inventory identity/source drift");
  }
  if (!String(x.inventory.authorityBoundary || "").includes("PostgreSQL remains authoritative")) fail("authority boundary missing");
  if (x.apiBoundary.runtime_source !== "../../app/api" || x.apiBoundary.single_source !== true) fail("apps/api single-source bridge drift");
  if (!x.apiBoundary.owns?.includes("request-response-contracts")) fail("apps/api request-response ownership missing");

  const actual = ordered(x.routeFiles.flatMap((file) => {
    const exported = methods(x.routeSources[file] || "");
    if (!exported.length) fail("route exports no HTTP method: " + file);
    return exported.map((method) => ({ method, path: routePath(file) }));
  }));
  const expected = ordered(x.inventory.endpoints.map((e) => ({
    method: String(e.method).toUpperCase(),
    path: String(e.path),
    operationId: String(e.operationId)
  })));

  if (actual.length !== expected.length) fail("runtime/inventory operation count mismatch");
  for (let i=0;i<expected.length;i++) {
    if (actual[i].method !== expected[i].method || actual[i].path !== expected[i].path) {
      fail("runtime/inventory route mismatch");
    }
    const op = x.spec?.paths?.[expected[i].path]?.[expected[i].method.toLowerCase()];
    if (!op) fail("OpenAPI operation missing: " + expected[i].method + " " + expected[i].path);
    if (op.operationId !== expected[i].operationId) fail("OpenAPI operationId mismatch");
    if (!op.responses || Object.keys(op.responses).length === 0) fail("OpenAPI responses missing");
  }

  const specOps = [];
  for (const [p,item] of Object.entries(x.spec.paths || {})) {
    for (const m of ["get","post","put","patch","delete","head","options"]) if (item?.[m]) specOps.push({method:m.toUpperCase(),path:p});
  }
  if (ordered(specOps).length !== expected.length) fail("OpenAPI/inventory operation count mismatch");

  if (!x.webSource.includes('fetch("/api/live-auction-clock",{cache:"no-store"})')) fail("web GET contract drift");
  if (!/fetch\("\/api\/live-auction-clock",[\s\S]*?method:"POST"/.test(x.webSource)) fail("web POST contract drift");
  if (!x.webSource.includes('JSON.stringify({action:"bid"})')) fail("web bid body drift");
  if (!x.webSource.includes('data.auctionAuthority!==false')) fail("web authority guard missing");

  if (x.providerBoundary.workspace !== "packages/providers" || x.providerBoundary.credential_free !== true) fail("provider credential-free boundary drift");
  if (x.providerBoundary.direct_runtime_env_reads !== false) fail("provider runtime env read enabled");
  if (x.providerBoundary.concrete_provider_clients !== false) fail("unverified concrete provider client enabled");
  if (!x.providerBoundary.owns?.includes("provider-adapter-boundary")) fail("provider adapter ownership missing");
  if (/process\.env|\bfetch\s*\(|authorization\s*:/i.test(x.providerSource)) fail("provider boundary contains live credential/network behavior");

  return { routes:x.routeFiles.length, operations:expected.length };
}

function load() {
  const routeFiles = discoverRoutes(API_ROOT);
  return {
    inventory: readJson(INVENTORY_PATH),
    spec: readJson(OPENAPI_PATH),
    apiBoundary: readJson(API_BOUNDARY_PATH),
    providerBoundary: readJson(PROVIDER_BOUNDARY_PATH),
    providerSource: fs.readFileSync(PROVIDER_SOURCE_PATH, "utf8"),
    webSource: fs.readFileSync(WEB_CONSUMER_PATH, "utf8"),
    routeFiles,
    routeSources: Object.fromEntries(routeFiles.map((f)=>[f,fs.readFileSync(f,"utf8")]))
  };
}

const input = load();
const result = validate(input);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  const reject = (label, mutate) => {
    const copy = structuredClone(input);
    mutate(copy);
    let rejected = false;
    try { validate(copy); } catch { rejected = true; }
    if (!rejected) fail("negative self-test accepted: " + label);
    cases++;
  };
  reject("route missing", x => { x.routeFiles = x.routeFiles.slice(1); });
  reject("OpenAPI operation missing", x => { delete x.spec.paths["/api/health/web"].get; });
  reject("operationId drift", x => { x.spec.paths["/api/health/api"].get.operationId = "wrong"; });
  reject("API bridge drift", x => { x.apiBoundary.runtime_source = "../../wrong"; });
  reject("web POST drift", x => { x.webSource = x.webSource.replace('method:"POST"', 'method:"PUT"'); });
  reject("provider concrete client", x => { x.providerBoundary.concrete_provider_clients = true; });
  reject("provider network behavior", x => { x.providerSource += "\nfetch('https://provider.invalid');\n"; });
  console.log(`${TASK} WEB_API_PROVIDER_CONTRACT_TESTS_SELF_TEST PASS negative_cases=${cases} routes=${result.routes} operations=${result.operations}`);
} else {
  console.log(`${TASK} WEB_API_PROVIDER_CONTRACT_TESTS PASS routes=${result.routes} operations=${result.operations} web=PASS provider=credential-free-boundary`);
}
