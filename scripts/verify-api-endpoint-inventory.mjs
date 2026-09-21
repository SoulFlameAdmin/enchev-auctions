import fs from "node:fs";
import path from "node:path";

const INVENTORY_PATH = "config/enchev-api-endpoint-inventory.json";
const SPEC_PATH = "packages/contracts/openapi/enchev-api.v1.json";
const API_ROOT = "app/api";
const ALLOWED_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"];

function fail(message) {
  throw new Error(`API_ENDPOINT_INVENTORY FAIL: ${message}`);
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

function implementedMethods(source) {
  return ALLOWED_METHODS.filter((method) => [
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`),
    new RegExp(`export\\s+function\\s+${method}\\s*\\(`),
    new RegExp(`export\\s+const\\s+${method}\\s*=`)
  ].some((pattern) => pattern.test(source)));
}

function discoverImplemented() {
  const out = [];
  for (const file of routeFiles(API_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    const methods = implementedMethods(source);
    if (!methods.length) fail(`no exported HTTP method found in ${file}`);
    for (const method of methods) out.push(`${method} ${routePath(file)}`);
  }
  return out.sort();
}

function specEntries(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail("OpenAPI spec must be an object");
  if (!spec.paths || typeof spec.paths !== "object" || Array.isArray(spec.paths)) fail("OpenAPI paths missing");
  const entries = [];
  for (const [apiPath, item] of Object.entries(spec.paths)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(`invalid path item ${apiPath}`);
    for (const method of ALLOWED_METHODS) {
      const operation = item[method.toLowerCase()];
      if (!operation) continue;
      if (typeof operation.operationId !== "string" || !operation.operationId.trim()) {
        fail(`operationId missing for ${method} ${apiPath}`);
      }
      if (typeof operation.summary !== "string" || !operation.summary.trim()) {
        fail(`summary missing for ${method} ${apiPath}`);
      }
      entries.push({ method, path: apiPath, operationId: operation.operationId, summary: operation.summary });
    }
  }
  return entries.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

export function validateInventory(inventory, spec, implemented) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) fail("inventory must be an object");
  if (inventory.version !== 1) fail("version must be 1");
  if (inventory.task !== "24.09") fail("task must be 24.09");
  if (inventory.sourceOfTruth !== SPEC_PATH) fail("sourceOfTruth drift");
  if (inventory.implementationRoot !== API_ROOT) fail("implementationRoot drift");
  if (typeof inventory.authorityBoundary !== "string" || !inventory.authorityBoundary.includes("PostgreSQL remains authoritative")) {
    fail("authority boundary missing");
  }
  if (!Array.isArray(inventory.endpoints) || inventory.endpoints.length === 0) fail("endpoints must be a non-empty array");

  const seenOperationIds = new Set();
  const seenRoutes = new Set();
  for (const endpoint of inventory.endpoints) {
    if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint)) fail("invalid endpoint entry");
    if (!ALLOWED_METHODS.includes(endpoint.method)) fail(`invalid method ${endpoint.method}`);
    if (typeof endpoint.path !== "string" || !endpoint.path.startsWith("/api/")) fail("invalid API path");
    if (typeof endpoint.operationId !== "string" || !endpoint.operationId.trim()) fail("operationId missing");
    if (typeof endpoint.summary !== "string" || !endpoint.summary.trim()) fail("summary missing");
    const routeKey = `${endpoint.method} ${endpoint.path}`;
    if (seenRoutes.has(routeKey)) fail(`duplicate route ${routeKey}`);
    if (seenOperationIds.has(endpoint.operationId)) fail(`duplicate operationId ${endpoint.operationId}`);
    seenRoutes.add(routeKey);
    seenOperationIds.add(endpoint.operationId);
  }

  const fromSpec = specEntries(spec);
  const normalizedInventory = [...inventory.endpoints].sort((a, b) =>
    `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)
  );
  if (JSON.stringify(normalizedInventory) !== JSON.stringify(fromSpec)) {
    fail("inventory does not exactly match canonical OpenAPI operations");
  }

  const inventoryRoutes = normalizedInventory.map((entry) => `${entry.method} ${entry.path}`).sort();
  const implementedRoutes = [...implemented].sort();
  if (JSON.stringify(inventoryRoutes) !== JSON.stringify(implementedRoutes)) {
    const missing = implementedRoutes.filter((entry) => !inventoryRoutes.includes(entry));
    const stale = inventoryRoutes.filter((entry) => !implementedRoutes.includes(entry));
    fail(`implementation parity drift missing=[${missing.join(", ")}] stale=[${stale.join(", ")}]`);
  }

  return { endpoints: normalizedInventory.length, paths: new Set(normalizedInventory.map((entry) => entry.path)).size };
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
const implemented = discoverImplemented();
const result = validateInventory(inventory, spec, implemented);

if (process.argv.includes("--self-test")) {
  let cases = 0;
  function rejected(label, mutateInventory, mutateSpec = () => {}, implementedOverride = implemented) {
    const inventoryCopy = structuredClone(inventory);
    const specCopy = structuredClone(spec);
    mutateInventory(inventoryCopy);
    mutateSpec(specCopy);
    let didReject = false;
    try { validateInventory(inventoryCopy, specCopy, implementedOverride); } catch { didReject = true; }
    if (!didReject) fail(`negative self-test was not rejected: ${label}`);
    cases += 1;
  }

  rejected("missing endpoint", (copy) => { copy.endpoints.pop(); });
  rejected("stale endpoint", (copy) => {
    copy.endpoints.push({ method: "GET", path: "/api/stale", operationId: "getStale", summary: "Stale" });
  });
  rejected("duplicate route", (copy) => { copy.endpoints.push(structuredClone(copy.endpoints[0])); });
  rejected("duplicate operationId", (copy) => { copy.endpoints[1].operationId = copy.endpoints[0].operationId; });
  rejected("summary drift", (copy) => { copy.endpoints[0].summary = "Drifted"; });
  rejected("authority boundary missing", (copy) => { delete copy.authorityBoundary; });
  rejected("implementation drift", () => {}, () => {}, [...implemented, "GET /api/example-untracked"].sort());

  console.log(`API_ENDPOINT_INVENTORY_SELF_TEST PASS cases=${cases} endpoints=${result.endpoints} paths=${result.paths}`);
} else {
  console.log(`API_ENDPOINT_INVENTORY PASS task=24.09 endpoints=${result.endpoints} paths=${result.paths} openapi_parity=true implementation_parity=true`);
}
