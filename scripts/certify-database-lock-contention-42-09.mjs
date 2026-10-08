import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const output = process.env.ENCHEV_42_09_OUTPUT || "artifacts/42-09/database-lock-contention.json";
const waiterCount = Number(process.env.ENCHEV_42_09_WAITERS || 50);
const blockerHoldSeconds = Number(process.env.ENCHEV_42_09_BLOCKER_SECONDS || 2);

if (!databaseUrl) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: DATABASE_URL missing");
if (!Number.isSafeInteger(waiterCount) || waiterCount < 10 || waiterCount > 100) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: waiter count must be 10..100");
if (!Number.isFinite(blockerHoldSeconds) || blockerHoldSeconds < 1 || blockerHoldSeconds > 5) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: blocker seconds must be 1..5");

function dbUrlWithApplicationName(name) {
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", name);
  return url.toString();
}

function psql(sql, applicationName = "enchev-42-09-control") {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [dbUrlWithApplicationName(applicationName), "-X", "-q", "-A", "-t", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], {
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

function startPsql(sql, applicationName) {
  const child = spawn("psql", [dbUrlWithApplicationName(applicationName), "-X", "-q", "-A", "-t", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`psql exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
  return {child, done};
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] || 0;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const auctionId = randomUUID();

await psql(`
  set role service_role;
  insert into public.enchev_auctions (
    id,status,currency,current_bid_cents,bid_increment_cents,current_sequence,starts_at,ends_at
  ) values (
    '${auctionId}'::uuid,'live','EUR',1000000,100,0,now()-interval '1 minute',now()+interval '1 hour'
  );
`);

const blockerSql = `
  begin;
  set role service_role;
  select id from public.enchev_auctions where id='${auctionId}'::uuid for update;
  select pg_sleep(${blockerHoldSeconds});
  commit;
`;

const blockerStartedNs = process.hrtime.bigint();
const blocker = startPsql(blockerSql, "enchev-42-09-blocker");

// Wait until the blocker is visible and holding the transaction open.
let blockerVisible = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  const raw = await psql(`
    select count(*)::int
    from pg_stat_activity
    where application_name='enchev-42-09-blocker'
      and state <> 'idle';
  `);
  if (Number(raw) >= 1) {
    blockerVisible = true;
    break;
  }
  await delay(20);
}
if (!blockerVisible) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: blocker session not observed");
await delay(100);

const startedAt = new Date().toISOString();
const waiterPromises = Array.from({length:waiterCount}, (_, index) => {
  const bidderId = randomUUID();
  const key = `lock42-09-${index}-${randomUUID()}`;
  const fp = fingerprint(JSON.stringify({task:"42.09",auctionId,bidderId,index}));
  const t0 = process.hrtime.bigint();
  return psql(`
    set role service_role;
    select public.enchev_place_bid(
      '${auctionId}'::uuid,
      '${bidderId}'::uuid,
      2000000::bigint,
      '${key}'::text,
      '${fp}'::text
    )::text;
  `, "enchev-42-09-waiter")
    .then((raw) => ({
      index,
      bidderId,
      latencyMs:Number(process.hrtime.bigint()-t0)/1e6,
      result:JSON.parse(raw),
    }))
    .catch((error) => ({
      index,
      bidderId,
      latencyMs:Number(process.hrtime.bigint()-t0)/1e6,
      error:String(error),
    }));
});

const samples = [];
const sampleStarted = Date.now();
while (Date.now() - sampleStarted < blockerHoldSeconds * 1000 + 750) {
  const raw = await psql(`
    select
      count(*)::int,
      count(*) filter (where wait_event_type='Lock')::int,
      coalesce(string_agg(distinct wait_event, ',' order by wait_event) filter (where wait_event_type='Lock'),''),
      coalesce((
        select count(*)::int
        from pg_locks l
        join pg_stat_activity a on a.pid=l.pid
        where a.application_name='enchev-42-09-waiter'
          and l.granted=false
      ),0)
    from pg_stat_activity
    where application_name='enchev-42-09-waiter';
  `);
  const [activeRaw, waitingRaw, eventsRaw, ungrantedRaw] = String(raw).split("|");
  samples.push({
    atMs:Date.now()-sampleStarted,
    active:Number(activeRaw || 0),
    waitingOnLock:Number(waitingRaw || 0),
    waitEvents:eventsRaw ? eventsRaw.split(",").filter(Boolean) : [],
    ungrantedLocks:Number(ungrantedRaw || 0),
  });
  if (samples.length >= 3 && samples.at(-1).active === 0) break;
  await delay(50);
}

await blocker.done;
const blockerHoldMs = Number(process.hrtime.bigint()-blockerStartedNs)/1e6;
const results = await Promise.all(waiterPromises);

const processFailures = results.filter((r)=>r.error);
if (processFailures.length) throw new Error(`DB_LOCK_CONTENTION_42_09 FAIL: waiter process failures=${processFailures.length}`);

const accepted = results.filter((r)=>r.result?.accepted===true);
const rejected = results.filter((r)=>r.result?.accepted===false);
if (accepted.length !== 1) throw new Error(`DB_LOCK_CONTENTION_42_09 FAIL: accepted=${accepted.length}, expected=1`);
if (rejected.length !== waiterCount-1) throw new Error(`DB_LOCK_CONTENTION_42_09 FAIL: rejected=${rejected.length}, expected=${waiterCount-1}`);
if (rejected.some((r)=>r.result?.reason!=="bid-below-minimum")) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: unexpected rejection reason");

const maxWaiting = Math.max(...samples.map((s)=>s.waitingOnLock),0);
const maxUngrantedLocks = Math.max(...samples.map((s)=>s.ungrantedLocks),0);
const samplesWithLockWait = samples.filter((s)=>s.waitingOnLock>0).length;
const waitEvents = [...new Set(samples.flatMap((s)=>s.waitEvents))].sort();

if (maxWaiting < 1) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: no lock contention observed in pg_stat_activity");
if (samplesWithLockWait < 1) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: lock wait sampling empty");

const stateRaw = await psql(`
  set role service_role;
  select json_build_object(
    'currentBidCents', current_bid_cents,
    'currentSequence', current_sequence,
    'leaderBidderId', leader_bidder_id,
    'bidRows', (select count(*) from public.enchev_bids where auction_id='${auctionId}'::uuid),
    'duplicateSequences', (
      select count(*) from (
        select sequence from public.enchev_bids
        where auction_id='${auctionId}'::uuid
        group by sequence having count(*) > 1
      ) d
    )
  )::text
  from public.enchev_auctions
  where id='${auctionId}'::uuid;
`);
const state=JSON.parse(stateRaw);
if (Number(state.currentBidCents)!==2000000 || Number(state.currentSequence)!==1 || Number(state.bidRows)!==1 || Number(state.duplicateSequences)!==0) {
  throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: authoritative state corrupted after contention");
}
if (state.leaderBidderId!==accepted[0].result.bidderId) throw new Error("DB_LOCK_CONTENTION_42_09 FAIL: leader drift");

const latencies=results.map((r)=>r.latencyMs);
const report={
  taskId:"42.09",
  title:"Database lock contention profile",
  certified:true,
  environment:"github-actions-postgresql-17",
  authority:"postgresql",
  contentionTarget:"public.enchev_auctions row FOR UPDATE",
  logicalWaiters:waiterCount,
  blockerHoldSeconds,
  blockerObserved:true,
  blockerObservedDurationMs:blockerHoldMs,
  sampleCount:samples.length,
  samplesWithLockWait,
  maxWaitingOnLock:maxWaiting,
  maxUngrantedLocks,
  waitEvents,
  waiterLatencyMs:{
    p50:percentile(latencies,.50),
    p95:percentile(latencies,.95),
    p99:percentile(latencies,.99),
    max:Math.max(...latencies),
    min:Math.min(...latencies),
  },
  resultIntegrity:{
    accepted:accepted.length,
    rejected:rejected.length,
    acceptedSequence:Number(accepted[0].result.sequence),
    noDuplicateSequence:true,
    leaderConsistent:true,
  },
  samples,
  startedAt,
  completedAt:new Date().toISOString(),
  githubSha:process.env.GITHUB_SHA || "local",
};

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(`DB_LOCK_CONTENTION_42_09 PASS waiters=${waiterCount} max_waiting=${maxWaiting} ungranted_max=${maxUngrantedLocks} wait_events=${waitEvents.join(",")||"none"} p50_ms=${report.waiterLatencyMs.p50.toFixed(2)} p95_ms=${report.waiterLatencyMs.p95.toFixed(2)} p99_ms=${report.waiterLatencyMs.p99.toFixed(2)}`);
