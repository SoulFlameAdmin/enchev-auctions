import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const count = Number(process.argv[2]);
const taskId = String(process.argv[3] || "");
const output = String(process.argv[4] || "");

if (!databaseUrl) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: DATABASE_URL missing");
if (![10, 50, 100].includes(count)) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: count must be 10, 50 or 100");
if (!/^42\.(02|03|04)$/.test(taskId)) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: invalid taskId");
if (!output) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: output path missing");

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

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] || 0;
}

const startAmount = 1_000_000;
const bidAmount = 2_000_000;
const increment = 100;

await psql(`
  set role service_role;
  insert into public.enchev_auctions (
    id,status,currency,current_bid_cents,bid_increment_cents,starts_at,ends_at
  ) values (
    '${randomUUID()}','live','EUR',${startAmount},${increment},now()-interval '1 minute',now()+interval '1 hour'
  );
`);

const auctionId = await psql(`
  set role service_role;
  select id::text
  from public.enchev_auctions
  where status='live'
  order by created_at desc
  limit 1;
`);

if (!/^[0-9a-f-]{36}$/i.test(auctionId)) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: auction seed failed");

const startedAt = new Date().toISOString();
const tasks = Array.from({ length: count }, (_, index) => {
  const bidderId = randomUUID();
  const idempotencyKey = `ci-${taskId}-${index}-${randomUUID()}`;
  const requestFingerprint = fingerprint(JSON.stringify({taskId,index,auctionId,bidderId,bidAmount}));

  return (async () => {
    const t0 = process.hrtime.bigint();
    try {
      const raw = await psql(`
        set role service_role;
        select public.enchev_place_bid(
          '${auctionId}'::uuid,
          '${bidderId}'::uuid,
          ${bidAmount}::bigint,
          '${idempotencyKey}'::text,
          '${requestFingerprint}'::text
        )::text;
      `);
      const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
      return { index, bidderId, latencyMs, result: JSON.parse(raw) };
    } catch (error) {
      const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
      return { index, bidderId, latencyMs, error: String(error) };
    }
  })();
});

const results = await Promise.all(tasks);
const failures = results.filter((item) => item.error);
if (failures.length) throw new Error(`POSTGRES_CONCURRENCY_CERT FAIL: process failures=${failures.length}`);

const accepted = results.filter((item) => item.result?.accepted === true);
const rejected = results.filter((item) => item.result?.accepted === false);
const wrongReasons = rejected.filter((item) => item.result?.reason !== "bid-below-minimum");

if (accepted.length !== 1) throw new Error(`POSTGRES_CONCURRENCY_CERT FAIL: accepted=${accepted.length}, expected=1`);
if (rejected.length !== count - 1) throw new Error(`POSTGRES_CONCURRENCY_CERT FAIL: rejected=${rejected.length}, expected=${count - 1}`);
if (wrongReasons.length) throw new Error(`POSTGRES_CONCURRENCY_CERT FAIL: unexpected rejection reasons=${wrongReasons.length}`);
if (accepted[0].result?.authority !== "postgresql") throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: authority is not postgresql");
if (accepted[0].result?.sequence !== 1) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: first accepted sequence must be 1");
if (accepted[0].result?.amountCents !== bidAmount) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: accepted amount mismatch");
if (accepted[0].result?.replayed !== false) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: accepted bid unexpectedly replayed");

const stateRaw = await psql(`
  set role service_role;
  select json_build_object(
    'currentBidCents', a.current_bid_cents,
    'currentSequence', a.current_sequence,
    'leaderBidderId', a.leader_bidder_id,
    'acceptedBidRows', (select count(*) from public.enchev_bids b where b.auction_id=a.id),
    'maxSequence', (select coalesce(max(sequence),0) from public.enchev_bids b where b.auction_id=a.id)
  )::text
  from public.enchev_auctions a
  where a.id='${auctionId}'::uuid;
`);
const state = JSON.parse(stateRaw);

if (Number(state.currentBidCents) !== bidAmount) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: authoritative current bid drift");
if (Number(state.currentSequence) !== 1) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: authoritative sequence drift");
if (Number(state.acceptedBidRows) !== 1) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: more than one accepted bid row");
if (Number(state.maxSequence) !== 1) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: sequence uniqueness drift");
if (state.leaderBidderId !== accepted[0].result.bidderId) throw new Error("POSTGRES_CONCURRENCY_CERT FAIL: leader identity drift");

const latencies = results.map((item) => item.latencyMs);
const artifact = {
  taskId,
  title: `${count} concurrent bidders certified on clean PostgreSQL 17`,
  certified: true,
  scope: "authoritative-postgresql-core",
  productionEndpointCertified: false,
  authority: "postgresql",
  postgresMajor: 17,
  bidderCount: count,
  distinctBidderCount: new Set(results.map((item) => item.bidderId)).size,
  acceptedCount: accepted.length,
  rejectedCount: rejected.length,
  acceptedSequence: accepted.map((item) => item.result.sequence),
  rejectionReasons: [...new Set(rejected.map((item) => item.result.reason))],
  authoritativeState: state,
  latencyMs: {
    p50: percentile(latencies, .50),
    p95: percentile(latencies, .95),
    p99: percentile(latencies, .99),
    max: Math.max(...latencies),
  },
  startedAt,
  completedAt: new Date().toISOString(),
  githubSha: process.env.GITHUB_SHA || "local",
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + "\n");
console.log(`POSTGRES_CONCURRENCY_CERT PASS task=${taskId} bidders=${count} accepted=1 rejected=${count - 1} p95_ms=${artifact.latencyMs.p95.toFixed(2)}`);
