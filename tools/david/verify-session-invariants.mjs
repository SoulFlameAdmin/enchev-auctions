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

const supervisor = read("dual-session-worker.mjs");
for (const required of [
  "STRICT_CHATGPT_TAB_TARGET",
  "DEDICATED_DAVID_PROFILE",
  "cleanupUnknownChatGptTabs",
  "snapshot.totalChatGptTabs > STRICT_CHATGPT_TAB_TARGET",
  "pageShowsActiveWork"
]) {
  if (!supervisor.includes(required)) throw new Error(`Supervisor missing invariant: ${required}`);
}
if (/allFiveOwned/.test(supervisor)) {
  throw new Error("Unmanaged-tab cleanup must not depend on all five workers already being healthy");
}

console.log("DAVID_SESSION_INVARIANTS PASS same_tab_rollover=5 project_ok_rotation=4 strict_tab_budget=5 active_work_protected=1");
