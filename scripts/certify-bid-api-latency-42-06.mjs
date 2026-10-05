import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const baseUrl = String(process.argv[2] || "").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;
const output = process.env.ENCHEV_42_06_OUTPUT || "artifacts/42-06/bid-api-latency.json";
const requestCount = Number(process.env.ENCHEV_42_06_REQUEST_COUNT || 50);

if (!/^https?:\/\//.test(baseUrl)) throw new Error("BID_API_LATENCY_42_06 FAIL: base URL missing");
if (!databaseUrl) throw new Error("BID_API_LATENCY_42_06 FAIL: DATABASE_URL missing");
if (!Number.isSafeInteger(requestCount) || requestCount < 20 || requestCount > 100) {
  throw new Error("BID_API_LATENCY_42_06 FAIL: request count must be 20..100");
}

function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [databaseUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`psql exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] || 0;
}

const rawIds = await psql(`
  set role service_role;
  insert into public.enchev_auctions (
    id,status,currency,current_bid_cents,bid_increment_cents,starts_at,ends_at
  )
  select gen_random_uuid(),'live','EUR',1000000,100,now()-interval '1 minute',now()+interval '1 hour'
  from generate_series(1,${requestCount})
  returning id::text;
`);

const auctionIds = rawIds.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[0-9a-f-]{36}$/i.test(line));
if (auctionIds.length !== requestCount) {
  throw new Error(`BID_API_LATENCY_42_06 FAIL: seeded auctions=${auctionIds.length}, expected=${requestCount}`);
}

const startedAt = new Date().toISOString();
const results = await Promise.all(auctionIds.map(async (auctionId, index) => {
  const bidderId = randomUUID();
  const token = `ci-session-${bidderId}-xxxxxxxxxxxxxxxxxxxxxxxx`;
  const t0 = process.hrtime.bigint();
  let response;
  try {
    response = await fetch(baseUrl + "/api/bids", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "idempotency-key": `lat42-06-${index}-${randomUUID()}`,
      },
      body: JSON.stringify({ auctionId, amountCents: 2_000_000 }),
    });
  } catch (error) {
    return { index, auctionId, bidderId, status: 0, latencyMs: Number(process.hrtime.bigint()-t0)/1e6, error: String(error) };
  }

  const latencyMs = Number(process.hrtime.bigint()-t0)/1e6;
  let body = null;
  try { body = await response.json(); } catch {}
  return { index, auctionId, bidderId, status: response.status, latencyMs, body };
}));

const failures = results.filter((r) =>
  r.status !== 201 ||
  r.body?.ok !== true ||
  r.body?.authority !== "postgresql" ||
  r.body?.auctionId !== r.auctionId ||
  r.body?.bidderId !== r.bidderId ||
  r.body?.amountCents !== 2_000_000 ||
  r.body?.sequence !== 1 ||
  r.body?.replayed !== false
);

if (failures.length) {
  console.error(JSON.stringify(failures.slice(0,5), null, 2));
  throw new Error(`BID_API_LATENCY_42_06 FAIL: invalid responses=${failures.length}/${requestCount}`);
}

const latencies = results.map((r) => r.latencyMs);
const report = {
  taskId: "42.06",
  title: "Bid API p50/p95/p99 recorded",
  certified: true,
  route: "POST /api/bids",
  measurement: "client_observed_http_latency_ms",
  environment: "github-actions-production-like-local",
  productionEndpointCertified: false,
  authoritativeDatabase: "postgresql-17",
  concurrentAcceptedRequests: requestCount,
  distinctAuctions: new Set(results.map((r)=>r.auctionId)).size,
  distinctBidders: new Set(results.map((r)=>r.bidderId)).size,
  successfulResponses: results.length,
  latencyMs: {
    p50: percentile(latencies,.50),
    p95: percentile(latencies,.95),
    p99: percentile(latencies,.99),
    max: Math.max(...latencies),
    min: Math.min(...latencies),
  },
  startedAt,
  completedAt: new Date().toISOString(),
  githubSha: process.env.GITHUB_SHA || "local",
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  `BID_API_LATENCY_42_06 PASS requests=${requestCount} p50_ms=${report.latencyMs.p50.toFixed(2)} p95_ms=${report.latencyMs.p95.toFixed(2)} p99_ms=${report.latencyMs.p99.toFixed(2)} max_ms=${report.latencyMs.max.toFixed(2)}`
);
