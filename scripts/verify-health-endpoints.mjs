import fs from "node:fs";

const CONFIG_PATH = "config/enchev-health-endpoints.json";

function fail(message) {
  throw new Error(`HEALTH_ENDPOINTS FAIL: ${message}`);
}

export function validateContract(config) {
  if (!config || typeof config !== "object") fail("config must be an object");
  if (config.task !== "01.10") fail("task must be 01.10");
  if (config.name !== "Web / API / realtime / worker health endpoints") fail("name drift");
  if (config.schema_version !== 1) fail("schema_version must be 1");
  if (!Array.isArray(config.endpoints) || config.endpoints.length !== 4) fail("exactly four endpoints are required");

  const expected = new Map([
    ["web", { path: "/api/health/web", http_status: 200, ready: true, status: "healthy" }],
    ["api", { path: "/api/health/api", http_status: 200, ready: true, status: "healthy" }],
    ["realtime", { path: "/api/health/realtime", http_status: 503, ready: false, status: "service-pending" }],
    ["worker", { path: "/api/health/worker", http_status: 503, ready: false, status: "service-pending" }],
  ]);

  const seen = new Set();
  for (const endpoint of config.endpoints) {
    const e = expected.get(endpoint.component);
    if (!e) fail(`unknown component ${endpoint.component}`);
    if (seen.has(endpoint.component)) fail(`duplicate component ${endpoint.component}`);
    seen.add(endpoint.component);
    for (const key of ["path", "http_status", "ready", "status"]) {
      if (endpoint[key] !== e[key]) fail(`${endpoint.component} ${key} drift`);
    }
  }
  if (seen.size !== expected.size) fail("missing component");
  return config.endpoints;
}

export function validateResponse(endpoint, httpStatus, body) {
  if (httpStatus !== endpoint.http_status) fail(`${endpoint.component} HTTP ${httpStatus}, expected ${endpoint.http_status}`);
  if (!body || typeof body !== "object") fail(`${endpoint.component} body must be JSON object`);
  if (body.component !== endpoint.component) fail(`${endpoint.component} component drift`);
  if (body.ready !== endpoint.ready) fail(`${endpoint.component} ready drift`);
  if (body.ok !== endpoint.ready) fail(`${endpoint.component} ok must match readiness`);
  if (body.status !== endpoint.status) fail(`${endpoint.component} status drift`);
  if (body.schemaVersion !== 1) fail(`${endpoint.component} schemaVersion drift`);
  if (body.valuesExposed !== false) fail(`${endpoint.component} valuesExposed must remain false`);
}

export function validateRepository(config) {
  const routeByComponent = {
    web: "app/api/health/web/route.ts",
    api: "app/api/health/api/route.ts",
    realtime: "app/api/health/realtime/route.ts",
    worker: "app/api/health/worker/route.ts",
  };
  const sharedPath = "app/api/health/_shared.ts";
  if (!fs.existsSync(sharedPath)) fail("shared health response module missing");
  const shared = fs.readFileSync(sharedPath, "utf8");
  for (const marker of ["schemaVersion: 1", "valuesExposed: false", "status: ready ? 200 : 503"]) {
    if (!shared.includes(marker)) fail(`shared health contract missing: ${marker}`);
  }

  for (const endpoint of config.endpoints) {
    const routePath = routeByComponent[endpoint.component];
    if (!fs.existsSync(routePath)) fail(`${endpoint.component} route missing`);
    const source = fs.readFileSync(routePath, "utf8");
    const marker = `healthResponse("${endpoint.component}", ${endpoint.ready}, "${endpoint.status}")`;
    if (!source.includes(marker)) fail(`${endpoint.component} route contract drift`);
    if (!source.includes('export const dynamic = "force-dynamic"')) fail(`${endpoint.component} route must be force-dynamic`);
  }
}

function expectRejected(label, fn) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

async function runLive(config, baseUrl) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(base)) fail("--live requires an http(s) base URL");

  for (const endpoint of config.endpoints) {
    const response = await fetch(base + endpoint.path, { redirect: "error", cache: "no-store" });
    let body;
    try { body = await response.json(); }
    catch { fail(`${endpoint.component} did not return JSON`); }
    validateResponse(endpoint, response.status, body);
    console.log(`HEALTH_ENDPOINT_LIVE PASS component=${endpoint.component} http=${response.status} ready=${body.ready}`);
  }
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
validateContract(config);
validateRepository(config);

if (process.argv.includes("--self-test")) {
  const [web, api, realtime, worker] = config.endpoints;
  validateResponse(web, 200, { ok: true, component: "web", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false });
  validateResponse(api, 200, { ok: true, component: "api", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false });
  validateResponse(realtime, 503, { ok: false, component: "realtime", ready: false, status: "service-pending", schemaVersion: 1, valuesExposed: false });
  validateResponse(worker, 503, { ok: false, component: "worker", ready: false, status: "service-pending", schemaVersion: 1, valuesExposed: false });

  expectRejected("web wrong HTTP", () => validateResponse(web, 503, { ok: true, component: "web", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false }));
  expectRejected("realtime false healthy claim", () => validateResponse(realtime, 200, { ok: true, component: "realtime", ready: true, status: "healthy", schemaVersion: 1, valuesExposed: false }));
  expectRejected("worker exposes values", () => validateResponse(worker, 503, { ok: false, component: "worker", ready: false, status: "service-pending", schemaVersion: 1, valuesExposed: true }));
  expectRejected("missing endpoint", () => validateContract({ ...config, endpoints: config.endpoints.slice(0, 3) }));
  expectRejected("duplicate endpoint", () => validateContract({ ...config, endpoints: [web, api, realtime, realtime] }));

  console.log("HEALTH_ENDPOINTS_SELF_TEST PASS positive_cases=4 negative_cases=5");
} else if (process.argv.includes("--live")) {
  const idx = process.argv.indexOf("--live");
  await runLive(config, process.argv[idx + 1]);
} else {
  console.log("HEALTH_ENDPOINTS PASS components=4 web=ready api=ready realtime=pending worker=pending");
}
