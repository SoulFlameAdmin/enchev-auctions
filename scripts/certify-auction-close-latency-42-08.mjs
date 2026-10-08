import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const output = process.env.ENCHEV_42_08_OUTPUT || "artifacts/42-08/auction-close-latency.json";
const auctionCount = Number(process.env.ENCHEV_42_08_AUCTIONS || 50);
const dbConcurrencyLimit = Number(process.env.ENCHEV_42_08_DB_CONCURRENCY || 25);

if (!databaseUrl) throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: DATABASE_URL missing");
if (!Number.isSafeInteger(auctionCount) || auctionCount < 20 || auctionCount > 100) throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: auction count must be 20..100");
if (!Number.isSafeInteger(dbConcurrencyLimit) || dbConcurrencyLimit < 1 || dbConcurrencyLimit > 50) throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: invalid DB concurrency");

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

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] || 0;
}

let active = 0;
const waiters = [];
async function withDbSlot(fn) {
  const queuedAt = process.hrtime.bigint();
  if (active >= dbConcurrencyLimit) await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  const acquiredAt = process.hrtime.bigint();
  try {
    const value = await fn();
    return { value, queueWaitMs: Number(acquiredAt - queuedAt) / 1e6 };
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}

const fixtures = Array.from({length: auctionCount}, (_, index) => ({
  auctionId: randomUUID(),
  bidId: index < Math.floor(auctionCount / 2) ? randomUUID() : null,
  bidderId: index < Math.floor(auctionCount / 2) ? randomUUID() : null,
  amountCents: index < Math.floor(auctionCount / 2) ? 1_500_000 + index * 100 : null,
}));

const auctionValues = fixtures.map((f) =>
  `('${f.auctionId}'::uuid,'live','EUR',${f.amountCents || 1000000},100,${f.bidId ? 1 : 0},${f.bidderId ? `'${f.bidderId}'::uuid` : "null"},now()-interval '1 hour',now()-interval '1 second')`
).join(",\n");

await psql(`
  set role service_role;
  insert into public.enchev_auctions (
    id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,leader_bidder_id,starts_at,ends_at
  ) values
  ${auctionValues};
`);

const bidFixtures = fixtures.filter((f) => f.bidId);
if (bidFixtures.length) {
  const bidValues = bidFixtures.map((f, index) =>
    `('${f.bidId}'::uuid,'${f.auctionId}'::uuid,'${f.bidderId}'::uuid,${f.amountCents},'EUR',1,now()-interval '10 seconds','seed-${index}','${fingerprint("seed-"+index)}')`
  ).join(",\n");
  await psql(`
    set role service_role;
    insert into public.enchev_bids (
      id,auction_id,bidder_id,amount_cents,currency,sequence,accepted_at,idempotency_key,request_fingerprint
    ) values
    ${bidValues};
  `);
}

const startedAt = new Date().toISOString();
const results = await Promise.all(fixtures.map(async (fixture, index) => {
  const idempotencyKey = `close42-08-${index}-${randomUUID()}`;
  const requestFingerprint = fingerprint(JSON.stringify({task:"42.08",auctionId:fixture.auctionId,index}));
  const t0 = process.hrtime.bigint();

  try {
    const slot = await withDbSlot(() => psql(`
      set role service_role;
      select public.enchev_finalize_auction(
        '${escapeSql(fixture.auctionId)}'::uuid,
        '${escapeSql(idempotencyKey)}'::text,
        '${requestFingerprint}'::text
      )::text;
    `));
    const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return {
      index,
      fixture,
      idempotencyKey,
      requestFingerprint,
      latencyMs,
      queueWaitMs: slot.queueWaitMs,
      result: JSON.parse(slot.value),
    };
  } catch (error) {
    return {index, fixture, idempotencyKey, requestFingerprint, latencyMs:Number(process.hrtime.bigint()-t0)/1e6, error:String(error)};
  }
}));

const failures = results.filter((r) => r.error);
if (failures.length) throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: process failures=${failures.length}`);

for (const item of results) {
  const expectedOutcome = item.fixture.bidId ? "winner_assigned" : "closed_without_winner";
  if (item.result?.finalized !== true || item.result?.authority !== "postgresql" || item.result?.auctionId !== item.fixture.auctionId) {
    throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: invalid finalization response index=${item.index}`);
  }
  if (item.result?.outcome !== expectedOutcome) throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: outcome drift index=${item.index}`);
  if (item.result?.replayed !== false) throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: first finalization replayed index=${item.index}`);
  if (expectedOutcome === "winner_assigned") {
    if (item.result?.winnerBidId !== item.fixture.bidId || item.result?.winnerBidderId !== item.fixture.bidderId || Number(item.result?.winningAmountCents) !== item.fixture.amountCents) {
      throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: winner drift index=${item.index}`);
    }
  } else if (item.result?.winnerBidId !== null || item.result?.winnerBidderId !== null || item.result?.winningAmountCents !== null) {
    throw new Error(`AUCTION_CLOSE_LATENCY_42_08 FAIL: no-winner finalization contains winner index=${item.index}`);
  }
}

const first = results[0];
const replayRaw = await psql(`
  set role service_role;
  select public.enchev_finalize_auction(
    '${escapeSql(first.fixture.auctionId)}'::uuid,
    '${escapeSql(first.idempotencyKey)}'::text,
    '${first.requestFingerprint}'::text
  )::text;
`);
const replay = JSON.parse(replayRaw);
if (replay?.finalized !== true || replay?.replayed !== true || replay?.finalizationId !== first.result.finalizationId) {
  throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: idempotent replay drift");
}

const conflictRaw = await psql(`
  set role service_role;
  select public.enchev_finalize_auction(
    '${escapeSql(first.fixture.auctionId)}'::uuid,
    '${escapeSql(first.idempotencyKey)}'::text,
    '${"f".repeat(64)}'::text
  )::text;
`);
const conflict = JSON.parse(conflictRaw);
if (conflict?.finalized !== false || conflict?.reason !== "idempotency-conflict") {
  throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: idempotency conflict not rejected");
}

const integrityRaw = await psql(`
  set role service_role;
  select json_build_object(
    'finalizations', (select count(*) from public.enchev_auction_finalizations),
    'endedAuctions', (select count(*) from public.enchev_auctions where status='ended' and closed_at is not null),
    'winnerAssigned', (select count(*) from public.enchev_auction_finalizations where outcome='winner_assigned'),
    'closedWithoutWinner', (select count(*) from public.enchev_auction_finalizations where outcome='closed_without_winner'),
    'duplicateAuctions', (
      select count(*) from (
        select auction_id from public.enchev_auction_finalizations group by auction_id having count(*) > 1
      ) x
    )
  )::text;
`);
const integrity = JSON.parse(integrityRaw);

if (Number(integrity.finalizations) !== auctionCount || Number(integrity.endedAuctions) !== auctionCount) {
  throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: finalization count drift");
}
if (Number(integrity.duplicateAuctions) !== 0) throw new Error("AUCTION_CLOSE_LATENCY_42_08 FAIL: duplicate final result");

const latencies = results.map((r) => r.latencyMs);
const queueWaits = results.map((r) => Number(r.queueWaitMs || 0));
const report = {
  taskId:"42.08",
  title:"Auction close latency recorded",
  certified:true,
  environment:"github-actions-production-like-local",
  authority:"postgresql",
  finalizationFunction:"public.enchev_finalize_auction",
  auctionCount,
  logicalConcurrency:auctionCount,
  dbConcurrencyLimit,
  outcomes:{
    winnerAssigned:Number(integrity.winnerAssigned),
    closedWithoutWinner:Number(integrity.closedWithoutWinner),
  },
  immutableSingleResultVerified:true,
  idempotentReplayVerified:true,
  idempotencyConflictVerified:true,
  latencyMs:{
    p50:percentile(latencies,.50),
    p95:percentile(latencies,.95),
    p99:percentile(latencies,.99),
    max:Math.max(...latencies),
    min:Math.min(...latencies),
  },
  queueWaitMs:{
    p50:percentile(queueWaits,.50),
    p95:percentile(queueWaits,.95),
    p99:percentile(queueWaits,.99),
    max:Math.max(...queueWaits),
  },
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA || "local",
};

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`AUCTION_CLOSE_LATENCY_42_08 PASS auctions=${auctionCount} winner=${report.outcomes.winnerAssigned} no_winner=${report.outcomes.closedWithoutWinner} p50_ms=${report.latencyMs.p50.toFixed(2)} p95_ms=${report.latencyMs.p95.toFixed(2)} p99_ms=${report.latencyMs.p99.toFixed(2)}`);
