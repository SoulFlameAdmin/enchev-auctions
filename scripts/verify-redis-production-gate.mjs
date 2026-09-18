const DEFAULT_BASE_URL = "https://enchev-auctions.vercel.app";
const ALLOWED_BINDINGS = new Set(["tcp-url", "upstash-rest", "vercel-kv-rest"]);
const REDIS_KEY_SUFFIXES = [
  "REDIS_URL",
  "VALKEY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

function fail(message) {
  throw new Error(`REDIS_PRODUCTION_GATE FAIL: ${message}`);
}

export function validateBaseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { fail("production URL is invalid"); }
  if (url.protocol !== "https:") fail("production URL must use HTTPS");
  if (!url.hostname) fail("production URL hostname is missing");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function validateHealthResponse(status, body) {
  if (status !== 200) fail(`health endpoint returned HTTP ${status}`);
  if (!body || body.ok !== true || body.configured !== true || body.status !== "pong") {
    fail("health endpoint did not prove configured PONG");
  }
  if (!ALLOWED_BINDINGS.has(body.binding)) fail("health endpoint returned unsupported binding kind");
  if (body.tls !== true) fail("production Redis binding must prove TLS");
  if (!Number.isFinite(body.latencyMs) || body.latencyMs < 0) fail("health endpoint latency evidence is invalid");
  return { binding: body.binding, tls: body.tls, latencyMs: body.latencyMs };
}

export function validateEnvProbeResponse(status, body) {
  if (status !== 200) fail(`env probe returned HTTP ${status}`);
  if (!body || body.ok !== true) fail("env probe is not healthy");
  if (body.valuesExposed !== false) fail("env probe must never expose secret values");
  if (!Number.isInteger(body.candidateKeyCount) || body.candidateKeyCount < 1) {
    fail("env probe found no Redis-like binding keys");
  }
  if (!Array.isArray(body.candidateKeys) || body.candidateKeys.length !== body.candidateKeyCount) {
    fail("env probe candidate key metadata is inconsistent");
  }
  for (const key of body.candidateKeys) {
    if (typeof key !== "string" || !REDIS_KEY_SUFFIXES.some((suffix) => key === suffix || key.endsWith(`_${suffix}`))) {
      fail("env probe returned an unexpected candidate key");
    }
  }
  return { candidateKeyCount: body.candidateKeyCount, candidateKeys: body.candidateKeys };
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    let body;
    try { body = await response.json(); }
    catch { fail(`${url.pathname} did not return JSON`); }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyProduction(baseUrl = process.env.ENCHEV_PRODUCTION_URL || DEFAULT_BASE_URL) {
  const base = validateBaseUrl(baseUrl);
  const healthUrl = new URL("/api/health/redis", base);
  const envUrl = new URL("/api/health/redis-env", base);

  const [healthResponse, envResponse] = await Promise.all([
    fetchJson(healthUrl),
    fetchJson(envUrl),
  ]);

  const health = validateHealthResponse(healthResponse.status, healthResponse.body);
  const env = validateEnvProbeResponse(envResponse.status, envResponse.body);

  console.log(
    `REDIS_PRODUCTION_GATE PASS binding=${health.binding} tls=${health.tls} latency_ms=${health.latencyMs} candidate_keys=${env.candidateKeyCount}`,
  );
  return { health, env };
}

function expectReject(fn, label) {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  if (!rejected) fail(`self-test did not reject ${label}`);
}

function runSelfTest() {
  validateBaseUrl("https://enchev-auctions.vercel.app");
  expectReject(() => validateBaseUrl("http://enchev-auctions.vercel.app"), "non-HTTPS production URL");
  expectReject(() => validateBaseUrl("not-a-url"), "invalid production URL");

  validateHealthResponse(200, {
    ok: true,
    configured: true,
    status: "pong",
    binding: "upstash-rest",
    tls: true,
    latencyMs: 12,
  });
  expectReject(
    () => validateHealthResponse(503, { ok: false, configured: false, status: "missing-redis-binding" }),
    "missing production binding",
  );
  expectReject(
    () => validateHealthResponse(200, {
      ok: true,
      configured: true,
      status: "pong",
      binding: "tcp-url",
      tls: false,
      latencyMs: 1,
    }),
    "non-TLS production Redis",
  );

  validateEnvProbeResponse(200, {
    ok: true,
    candidateKeyCount: 2,
    candidateKeys: ["UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REDIS_REST_URL"],
    valuesExposed: false,
  });
  expectReject(
    () => validateEnvProbeResponse(200, {
      ok: true,
      candidateKeyCount: 0,
      candidateKeys: [],
      valuesExposed: false,
    }),
    "zero Redis env keys",
  );
  expectReject(
    () => validateEnvProbeResponse(200, {
      ok: true,
      candidateKeyCount: 1,
      candidateKeys: ["REDIS_URL"],
      valuesExposed: true,
    }),
    "secret exposure",
  );

  console.log("REDIS_PRODUCTION_GATE_SELF_TEST PASS base_url=3 health=3 env_probe=3");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else if (process.argv.includes("--live")) {
  await verifyProduction();
} else {
  console.log("Usage: node scripts/verify-redis-production-gate.mjs --self-test | --live");
}
