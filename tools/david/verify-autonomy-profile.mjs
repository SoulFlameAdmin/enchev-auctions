import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const ROOT = path.resolve(HERE, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const dual = read("tools/david/dual-session-worker.mjs");
const control = read("tools/david/auto-control-watchtower-v1.mjs");
const guard = read("tools/david/connection-interruption-guard.mjs");
const start = read("START_DAVID_AUTONOMY.ps1");
const restart = read("RESTART_DAVID_AUTONOMY_CLEAN.ps1");

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
for (const token of [
  'DAVID_ACTIVE_WORKERS = "SYSTEM,APP2,APK,CONTROL"',
  'DAVID_CHATGPT_TAB_TARGET = "4"',
  'DESIGN=0',
  'ChatGPT=4'
]) if (!start.includes(token)) throw new Error("Launcher invariant missing: " + token);

if (!restart.includes("STOP_DAVID_ALL_CLEAN.ps1") || !restart.includes("START_DAVID_AUTONOMY.ps1")) {
  throw new Error("Restart must atomically stop old stack before AUTONOMY start");
}

console.log("DAVID_AUTONOMY_PROFILE PASS scope=SYSTEM+APP2+APK+CONTROL design=OFF strict_tabs=4 guard=ON");
