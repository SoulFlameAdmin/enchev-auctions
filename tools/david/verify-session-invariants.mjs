import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));

const workerFiles = [
  ["SYSTEM", "auto-continue-enchev-v5.mjs", true],
  ["DESIGN", "auto-continue-design-v1.mjs", true],
  ["APP2", "auto-complete-app2-v1.mjs", true],
  ["APK", "auto-continue-david-apk-v1.mjs", true],
  ["CONTROL", "auto-control-watchtower-v1.mjs", false]
];

function read(name) {
  return fs.readFileSync(path.join(HERE, name), "utf8");
}

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing function: ${signature}`);
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error(`Missing body for: ${signature}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unclosed body for: ${signature}`);
}

const helper = read("chatgpt-session-rotation.mjs");
for (const required of ["rotateOwnedChatPage", "CHATGPT_ROOT", "getComposer", "managedTag", "pendingTag"]) {
  if (!helper.includes(required)) throw new Error(`Session rotation helper missing invariant: ${required}`);
}
if (/context\.newPage\s*\(/.test(helper)) {
  throw new Error("Session rotation helper must never create a browser tab");
}

for (const [name, file, rotateAfterOk] of workerFiles) {
  const source = read(file);
  const signature = name === "CONTROL"
    ? "async function rollover(context, page, state)"
    : "async function rolloverConversation(context, page, state";
  const body = functionBody(source, signature);
  if (/context\.newPage\s*\(/.test(body)) {
    throw new Error(`${name} rollover still creates a new browser tab`);
  }
  if (!body.includes("rotateOwnedChatPage")) {
    throw new Error(`${name} rollover is not guarded by rotateOwnedChatPage`);
  }
  if (!body.includes("NO NEW TAB") && name !== "CONTROL") {
    throw new Error(`${name} rollover is missing explicit single-tab evidence/logging`);
  }
  if (rotateAfterOk && !source.includes('rolloverConversation(context, page, state, "final-ok")')) {
    throw new Error(`${name} does not rotate to a fresh session after exact final OK`);
  }
}

for (const [name, file] of workerFiles) {
  const source = read(file);
  for (const required of ["DAVID_FRESH_SESSIONS_ON_START", "FRESH_SESSION_ON_START"]) {
    if (!source.includes(required)) throw new Error(`${name} fresh-session boot missing invariant: ${required}`);
  }
}
const repoRoot = path.resolve(HERE, "..", "..");
for (const [file, required] of [
  ["RESTART_DAVID_ALL_CLEAN.ps1", ["FreshSessions", "FRESH SESSION MODE"]],
  ["START_DAVID_ALL.ps1", ["FreshSessions", "FRESH SESSION MODE"]],
  [path.join("tools", "david", "start-auto-continue.ps1"), ["FreshSessions", "DAVID_FRESH_SESSIONS_ON_START", "https://chatgpt.com/"]]
]) {
  const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Fresh restart wiring missing in ${file}: ${token}`);
  }
}

const designSource = read("auto-continue-design-v1.mjs");
for (const required of [
  "async function composer(page)",
  "async function latestAssistant(page)",
  "async function latestRole(page)",
  "async function generating(page)",
  "async function complete(page",
  "async function platformBlock(page)",
  "async function waitSendTimeoutRecovery(context, page, state)"
]) {
  if (!designSource.includes(required)) throw new Error(`DESIGN response helper missing after session refactor: ${required}`);
}

const guardSource = read("connection-interruption-guard.mjs");
for (const required of [
  "SEND_TIMEOUT_STALE_ACTIVE_MS",
  "sendTimeoutFirstSeenAt",
  "sendTimeoutLastProgressAt",
  "MANDATORY IMMEDIATE TRY AGAIN",
  "focus({ timeout: 3000 })",
  "force: true"
]) {
  if (!guardSource.includes(required)) throw new Error(`Guard recovery invariant missing: ${required}`);
}
if (!guardSource.includes("Reconnecting without process exit")) throw new Error("Guard must reconnect after CDP/context loss without exiting");

const sendAckSource = read("chatgpt-send-ack.mjs");
const sharedPointerSafe =
  sendAckSource.includes("page.keyboard.insertText(text)") &&
  sendAckSource.includes("force:true") &&
  sendAckSource.includes("sendPromptVerified");

for (const file of ["auto-continue-enchev-v5.mjs","auto-continue-design-v1.mjs","auto-complete-app2-v1.mjs","auto-continue-david-apk-v1.mjs"]) {
  const source = read(file);
  const legacyPointerSafe = source.includes("focus({ timeout: 3000 })") && source.includes("force: true");
  const reacquirePointerSafe =
    source.includes("await composer(page)") &&
    source.includes("page.keyboard.insertText(text)") &&
    source.includes("force: true");
  const sharedSendAck = source.includes('from "./chatgpt-send-ack.mjs"') && sharedPointerSafe;
  if (!legacyPointerSafe && !reacquirePointerSafe && !sharedSendAck) {
    throw new Error(`Pointer-safe ChatGPT composer fallback missing: ${file}`);
  }
}

const coordinatorSource = read("chatgpt-rate-limit-coordinator.mjs");
if (!coordinatorSource.includes("releaseWorkerLeases")) {
  throw new Error("Rate-limit coordinator must release dead worker leases");
}

const supervisorPrewarm = read("dual-session-worker.mjs");
for (const required of [
  "FRESH_SESSION_ON_START",
  "prewarmFreshManagedTabs",
  "Promise.all(tasks)",
  "roles.length",
  "ACTIVE_MANAGED_KINDS",
  "resetFreshBootTransientState"
]) {
  if (!supervisorPrewarm.includes(required)) throw new Error(`Fresh startup prewarm invariant missing: ${required}`);
}

const coordinatorFresh = read("chatgpt-rate-limit-coordinator.mjs");
if (!coordinatorFresh.includes("resetFreshBootTransientState")) {
  throw new Error("Fresh restart must clear stale transient probe/send ownership");
}

const controlSource = read("auto-control-watchtower-v1.mjs");
if (!controlSource.includes("focus({ timeout: 3000 })") || !controlSource.includes("force: true")) {
  throw new Error("CONTROL pointer-safe send fallback missing");
}

const fastGuard = read("connection-interruption-guard.mjs");
for (const required of [
  "SEND_TIMEOUT_MAX_RETRIES || 3",
  "SEND_TIMEOUT_STALE_ACTIVE_MS || 8000",
  "MANDATORY IMMEDIATE TRY AGAIN",
  "FAST RECOVERY step=RELOAD",
  "requestWorkerRecovery",
  ".david-recovery-request.json"
]) {
  if (!fastGuard.includes(required)) throw new Error(`Fast recovery guard invariant missing: ${required}`);
}

const supervisor = read("dual-session-worker.mjs");
for (const required of [
  "STRICT_CHATGPT_TAB_TARGET",
  "DEDICATED_DAVID_PROFILE",
  "cleanupUnknownChatGptTabs",
  "snapshot.totalChatGptTabs > STRICT_CHATGPT_TAB_TARGET",
  "pageShowsActiveWork",
  "releaseWorkerLeases(spec.name, \"exited\")",
  "executeRecoveryRequest(context)",
  "FAST RECOVERY executed RESTART",
  "DAVID_TAB_MONITOR_MS || 2000"
]) {
  if (!supervisor.includes(required)) throw new Error(`Supervisor missing invariant: ${required}`);
}
if (/allFiveOwned/.test(supervisor)) {
  throw new Error("Unmanaged-tab cleanup must not depend on all five workers already being healthy");
}

console.log("DAVID_SESSION_INVARIANTS PASS same_tab_rollover=5 project_ok_rotation=4 dynamic_tab_budget=1 active_work_protected=1 fresh_restart_wiring=5 pointer_safe_send=5 mandatory_immediate_try_again=1 retry_x3_reload_restart=1 dead_worker_lease_release=1 dynamic_fresh_parallel_prewarm=1 transient_probe_reset=1 monitor_2s=1");
