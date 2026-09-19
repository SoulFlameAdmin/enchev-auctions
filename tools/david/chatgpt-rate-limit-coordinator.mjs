import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RATE_LIMIT_STATE_FILE = path.join(HERE, ".david-global-chatgpt-rate-limit.json");
const RATE_LIMIT_LOCK_FILE = path.join(HERE, ".david-global-chatgpt-rate-limit.lock");

const BACKOFF_MS = [10 * 60_000, 20 * 60_000, 40 * 60_000];
const PROBE_LEASE_MS = 15 * 60_000;
const LOCK_STALE_MS = 30_000;
const POLL_MS = 5_000;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function nowIso() { return new Date().toISOString(); }
function defaultState() {
  return {
    version: 1,
    status: "clear",
    stage: -1,
    blockedUntil: null,
    probeOwner: null,
    probeLeaseUntil: null,
    probeSendStartedAt: null,
    lastRateLimitAt: null,
    lastRateLimitBy: null,
    lastSuccessAt: null,
    lastSuccessBy: null,
    updatedAt: nowIso()
  };
}
function readStateRaw() {
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(RATE_LIMIT_STATE_FILE, "utf8")) };
  } catch {
    return defaultState();
  }
}
function writeStateRaw(state) {
  const next = { ...defaultState(), ...state, updatedAt: nowIso() };
  const tmp = RATE_LIMIT_STATE_FILE + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, RATE_LIMIT_STATE_FILE);
  return next;
}
async function acquireLock() {
  for (;;) {
    try {
      const fd = fs.openSync(RATE_LIMIT_LOCK_FILE, "wx");
      return () => {
        try { fs.closeSync(fd); } catch {}
        try { fs.unlinkSync(RATE_LIMIT_LOCK_FILE); } catch {}
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const st = fs.statSync(RATE_LIMIT_LOCK_FILE);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(RATE_LIMIT_LOCK_FILE);
          continue;
        }
      } catch {}
      await sleep(100);
    }
  }
}
async function withLock(fn) {
  const release = await acquireLock();
  try { return await fn(); }
  finally { release(); }
}
function msUntil(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0;
}
export function getRateLimitState() {
  return readStateRaw();
}
export function rateLimitRemainingMs(state = readStateRaw()) {
  if (state.status === "blocked") return msUntil(state.blockedUntil);
  if (state.status === "probe") return msUntil(state.probeLeaseUntil);
  return 0;
}
export async function reportRateLimit(worker, evidence = "too many requests") {
  return withLock(async () => {
    const st = readStateRaw();
    const now = Date.now();

    // Repeated observations during a block, even if its timer just expired,
    // are UI echoes. They must never escalate 10 -> 20 -> 40 by themselves.
    if (st.status === "blocked") {
      st.lastRateLimitAt = nowIso();
      st.lastRateLimitBy = worker;
      st.lastEvidence = evidence;
      return writeStateRaw(st);
    }

    let nextStage = 0;
    if (st.status === "probe") {
      // Escalate only after the single probe owner has actually begun a new
      // post-cooldown send. A stale popup seen before that is not a new event.
      if (!st.probeSendStartedAt) {
        st.lastRateLimitAt = nowIso();
        st.lastRateLimitBy = worker;
        st.lastEvidence = evidence + " (stale-before-probe-send)";
        return writeStateRaw(st);
      }
      nextStage = Math.min(2, Math.max(0, Number(st.stage || 0) + 1));
    } else if (Number(st.stage) >= 0 && st.lastSuccessAt == null) {
      nextStage = Math.min(2, Number(st.stage) + 1);
    }

    const waitMs = BACKOFF_MS[nextStage];
    const next = {
      ...st,
      status: "blocked",
      stage: nextStage,
      blockedUntil: new Date(now + waitMs).toISOString(),
      probeOwner: null,
      probeLeaseUntil: null,
      probeSendStartedAt: null,
      lastRateLimitAt: nowIso(),
      lastRateLimitBy: worker,
      lastEvidence: evidence,
      lastSuccessAt: null,
      lastSuccessBy: null
    };
    return writeStateRaw(next);
  });
}
export async function waitForGlobalSendPermit(worker, onWait = null) {
  for (;;) {
    const decision = await withLock(async () => {
      const st = readStateRaw();
      const now = Date.now();

      if (st.status === "clear") {
        return { allow: true, mode: "normal", state: st };
      }

      if (st.status === "blocked") {
        const remaining = msUntil(st.blockedUntil);
        if (remaining > 0) return { allow: false, waitMs: remaining, mode: "blocked", state: st };

        // Cooldown ended. Exactly one process atomically becomes the probe owner.
        const probe = writeStateRaw({
          ...st,
          status: "probe",
          probeOwner: worker,
          probeLeaseUntil: new Date(now + PROBE_LEASE_MS).toISOString(),
          probeSendStartedAt: null,
          blockedUntil: null
        });
        return { allow: true, mode: "probe", state: probe };
      }

      if (st.status === "probe") {
        if (st.probeOwner === worker) {
          return { allow: true, mode: "probe", state: st };
        }
        const leaseRemaining = msUntil(st.probeLeaseUntil);
        if (leaseRemaining <= 0) {
          const probe = writeStateRaw({
            ...st,
            probeOwner: worker,
            probeLeaseUntil: new Date(now + PROBE_LEASE_MS).toISOString(),
            probeSendStartedAt: null
          });
          return { allow: true, mode: "probe", state: probe };
        }
        return { allow: false, waitMs: leaseRemaining, mode: "probe-wait", state: st };
      }

      return { allow: true, mode: "normal", state: st };
    });

    if (decision.allow) return decision;

    if (typeof onWait === "function") {
      try { await onWait(decision); } catch {}
    }
    await sleep(Math.min(POLL_MS, Math.max(1000, decision.waitMs || POLL_MS)));
  }
}
export async function markProbeSendStarted(worker) {
  return withLock(async () => {
    const st = readStateRaw();
    if (st.status !== "probe" || st.probeOwner !== worker) return st;
    return writeStateRaw({
      ...st,
      probeSendStartedAt: nowIso()
    });
  });
}

export async function reportProbeSuccess(worker) {
  return withLock(async () => {
    const st = readStateRaw();
    if (st.status !== "probe" || st.probeOwner !== worker) return st;
    return writeStateRaw({
      ...defaultState(),
      lastSuccessAt: nowIso(),
      lastSuccessBy: worker
    });
  });
}
export async function clearRateLimitState(reason = "manual-clear") {
  return withLock(async () => writeStateRaw({ ...defaultState(), clearedReason: reason }));
}
export function formatRateLimitState(state = readStateRaw()) {
  const remaining = rateLimitRemainingMs(state);
  return {
    status: state.status,
    stage: state.stage,
    waitMinutes: Math.ceil(remaining / 60_000),
    blockedUntil: state.blockedUntil,
    probeOwner: state.probeOwner,
    probeLeaseUntil: state.probeLeaseUntil,
    probeSendStartedAt: state.probeSendStartedAt,
    lastRateLimitBy: state.lastRateLimitBy,
    lastRateLimitAt: state.lastRateLimitAt,
    lastSuccessBy: state.lastSuccessBy,
    lastSuccessAt: state.lastSuccessAt
  };
}

if (process.argv.includes("--self-test")) {
  const s = defaultState();
  if (s.status !== "clear" || s.stage !== -1) throw new Error("rate-limit self-test: bad default");
  if (BACKOFF_MS.join(",") !== [600000,1200000,2400000].join(",")) throw new Error("rate-limit self-test: backoff law mismatch");
  console.log("DAVID_RATE_LIMIT_COORDINATOR_SELF_TEST PASS backoff=10,20,40 probe_owner=1");
}
