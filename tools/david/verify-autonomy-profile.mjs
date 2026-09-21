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
const effort = read("tools/david/chatgpt-effort-mode.mjs");

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
  for (const token of ["semanticTerminalCandidate", "SEMANTIC_TERMINAL_QUIET_MS", "human-terminal-gate", "ensureChatGptEffortMode", '"medium"']) {
    if (!source.includes(token)) throw new Error(name + " autonomy invariant missing: " + token);
  }
}
for (const token of ["ensurePendingApkPage", "DAVID_APK_PENDING_V1", "Pending ChatGPT tab created immediately"]) {
  if (!apkWorker.includes(token)) throw new Error("APK fourth-tab invariant missing: " + token);
}
for (const token of ["ensureChatGptEffortMode", '"medium"']) {
  if (!control.includes(token)) throw new Error("CONTROL effort invariant missing: " + token);
}
for (const token of ["Medium", "Средно", "target=medium"]) {
  if (!effort.includes(token)) throw new Error("Shared effort-mode invariant missing: " + token);
}
for (const token of [
  'DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK,CONTROL"',
  'DAVID_CHATGPT_TAB_TARGET = "4"',
  'DAVID_PROJECT_EFFORT_MODE = "medium"',
  'DESIGN=0',
  'ChatGPT=4'
]) if (!start.includes(token)) throw new Error("Launcher invariant missing: " + token);

if (!restart.includes("STOP_DAVID_ALL_CLEAN.ps1") || !restart.includes("START_DAVID_AUTONOMY.ps1") || !restart.includes("WaitOne(90000)")) {
  throw new Error("Restart must atomically stop old stack, wait for an active orchestration, then AUTONOMY start");
}
if (!abRestart.includes("STOP_DAVID_ALL_CLEAN.ps1") || !abRestart.includes("START_DAVID_FREETALK_ONLY.ps1") || !abRestart.includes("WaitOne(90000)")) {
  throw new Error("A+B restart-first invariant missing");
}

console.log("DAVID_AUTONOMY_PROFILE PASS restart_first_wait=90s scope=SYSTEM+APP2+APK+CONTROL design=OFF strict_tabs=4 apk_fourth_tab=GUARANTEED effort=MEDIUM guard=ON semantic_terminal=SYSTEM+DPP+APK");
