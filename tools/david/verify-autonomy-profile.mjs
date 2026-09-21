import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const ROOT = path.resolve(HERE, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const dual = read("tools/david/dual-session-worker.mjs");
const control = read("tools/david/auto-control-watchtower-v1.mjs");
const guard = read("tools/david/connection-interruption-guard.mjs");
const systemWorker = read("tools/david/auto-continue-enchev-v5.mjs");
const dppWorker = read("tools/david/auto-complete-app2-v1.mjs");
const apkWorker = read("tools/david/auto-continue-david-apk-v1.mjs");
const start = read("START_DAVID_AUTONOMY.ps1");
const restart = read("RESTART_DAVID_AUTONOMY_CLEAN.ps1");
const abRestart = read("RESTART_DAVID_FREETALK_ONLY_CLEAN.ps1");
const singleStart = read("START_DAVID_SINGLE.ps1");
const singleRestart = read("RESTART_DAVID_SINGLE_CLEAN.ps1");
const effort = read("tools/david/chatgpt-effort-mode.mjs");
const launcher = read("tools/david/start-auto-continue.ps1");

for (const token of [
  "DAVID_ACTIVE_WORKERS",
  "ACTIVE_MANAGED_KINDS",
  "ACTIVE_PROJECT_WORKERS",
  "MANAGED_KINDS",
  "DAVID_CHATGPT_TAB_TARGET || MANAGED_KINDS.length"
]) if (!dual.includes(token)) throw new Error("Supervisor autonomy invariant missing: " + token);

for (const token of ["ACTIVE_PROJECT_WORKERS", "ACTIVE_PROJECT_WORKER_SET", "WORKER_STATE_FILES"]) {
  if (!control.includes(token)) throw new Error("Watchtower autonomy invariant missing: " + token);
}
for (const token of ["ACTIVE_MANAGED_KINDS", "DAVID_ACTIVE_WORKERS"]) {
  if (!guard.includes(token)) throw new Error("Guard autonomy invariant missing: " + token);
}
for (const [name, source] of [["SYSTEM", systemWorker], ["DPP", dppWorker], ["APK", apkWorker]]) {
  for (const token of ["semanticTerminalCandidate", "SEMANTIC_TERMINAL_QUIET_MS", "human-terminal-gate", "ensureChatGptEffortMode", "EFFORT_MODE", "DAVID_PROJECT_EFFORT_MODE"]) {
    if (!source.includes(token)) throw new Error(name + " autonomy invariant missing: " + token);
  }
}
for (const token of ["ensurePendingApkPage", "DAVID_APK_PENDING_V1", "Pending ChatGPT tab created immediately", "fresh-owned-tab-after-discovery-miss", "No unique APK session discovered"]) {
  if (!apkWorker.includes(token)) throw new Error("APK owned-tab invariant missing: " + token);
}
for (const token of ["restartWorker", "workerHealth", "managed tab missing", "heartbeat stale"]) {
  if (!dual.includes(token)) throw new Error("Background WATCH supervisor invariant missing: " + token);
}
for (const token of ["recoverSendTimeout", "requestWorkerRecovery", "activeAssistantWork"]) {
  if (!guard.includes(token)) throw new Error("Background WATCH guard invariant missing: " + token);
}
for (const token of ["Medium", "Средно", "target=medium"]) {
  if (!effort.includes(token)) throw new Error("Shared effort-mode invariant missing: " + token);
}
for (const token of [
  'DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK"',
  'DAVID_CONTROL_ENABLED = "0"',
  'DAVID_CHATGPT_TAB_TARGET = "3"',
  'DAVID_PROJECT_EFFORT_MODE = "medium"',
  'DAVID_REQUIRE_FRESH_EDGE_ON_START = "1"',
  'DESIGN=0',
  'ChatGPT=3'
]) if (!start.includes(token)) throw new Error("Launcher invariant missing: " + token);

if (!restart.includes("STOP_DAVID_ALL_CLEAN.ps1") || !restart.includes("START_DAVID_AUTONOMY.ps1") || !restart.includes("WaitOne(90000)")) {
  throw new Error("Restart must atomically stop old stack, wait for an active orchestration, then AUTONOMY start");
}
if (!abRestart.includes("STOP_DAVID_ALL_CLEAN.ps1") || !abRestart.includes("START_DAVID_FREETALK_ONLY.ps1") || !abRestart.includes("WaitOne(90000)")) {
  throw new Error("A+B restart-first invariant missing");
}

for (const token of [
  '[ValidateSet("SYSTEM","APP2","APK")]',
  '$env:DAVID_ACTIVE_WORKERS=$Worker',
  '$env:DAVID_CONTROL_ENABLED="0"',
  '$env:DAVID_CHATGPT_TAB_TARGET="1"',
  '$env:DAVID_PROJECT_EFFORT_MODE="instant"',
  '$env:DAVID_REQUIRE_FRESH_EDGE_ON_START="1"',
  '$env:DAVID_GLOBAL_SEND_INTERVAL_MS="1500"',
  '$env:DAVID_COMPLETE_QUIET_MS="1200"',
  '$env:DAVID_COMPLETE_STABLE_SAMPLES="2"',
  '$env:DAVID_SEMANTIC_TERMINAL_QUIET_MS="2500"',
  'WATCH BACKGROUND',
  'ChatGPT=1'
]) if (!singleStart.includes(token)) throw new Error("FAST SOLO start invariant missing: " + token);

for (const token of ["STOP_DAVID_ALL_CLEAN.ps1", "START_DAVID_SINGLE.ps1", "WaitOne(90000)", "-Worker $Worker"]) {
  if (!singleRestart.includes(token)) throw new Error("FAST SOLO restart invariant missing: " + token);
}

for (const token of ["DAVID_REQUIRE_FRESH_EDGE_ON_START","FRESH EDGE REQUIRED","--new-window","FRESH EDGE VERIFIED","Edg/"]) {
  if (!launcher.includes(token)) throw new Error("Fresh Edge launcher invariant missing: " + token);
}

console.log("DAVID_AUTONOMY_PROFILE PASS restart_first_wait=90s fresh_edge=VERIFIED scope=SYSTEM+APP2+APK watch=BACKGROUND control_tab=OFF design=OFF strict_tabs=3 fast_solo=SYSTEM|DPP|APK fast_solo_tabs=1 fast_solo_effort=INSTANT fast_solo_watch=BACKGROUND apk_tab=GUARANTEED apk_discovery_miss_autostart=ON effort=MEDIUM guard=ON semantic_terminal=SYSTEM+DPP+APK");
