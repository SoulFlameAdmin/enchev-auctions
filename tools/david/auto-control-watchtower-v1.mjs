import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { waitForGlobalSendPermit, reportProbeSuccess, markProbeSendStarted } from "./chatgpt-rate-limit-coordinator.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const INITIAL_CHAT_URL = process.env.DAVID_CONTROL_CHAT_URL || "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e";
const STATE_FILE = process.env.DAVID_CONTROL_STATE_FILE || path.join(HERE, ".david-control-state.json");
const MONITOR_FILE = path.join(HERE, ".david-tab-monitor.json");
const COMMAND_FILE = path.join(HERE, ".david-control-command.json");
const RESULT_FILE = path.join(HERE, ".david-control-result.json");
const RATE_LIMIT_FILE = path.join(HERE, ".david-global-chatgpt-rate-limit.json");
const MARKER = "[DAVID_CONTROL_WATCHTOWER_V1]";
const TAB_NAME = "DAVID_CONTROL_MANAGED_V1";
const PENDING_TAB_NAME = "DAVID_CONTROL_PENDING_V1";
const POLL_MS = Number(process.env.DAVID_CONTROL_POLL_MS || 15000);
const HEARTBEAT_REPORT_MS = Number(process.env.DAVID_CONTROL_HEARTBEAT_REPORT_MS || 1800000);
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const START_TIMEOUT_MS = Number(process.env.DAVID_CONTROL_START_TIMEOUT_MS || 120000);
const COMPOSER_WAIT_MS = Number(process.env.DAVID_CONTROL_COMPOSER_WAIT_MS || 120000);
const LOAD_RETRY_BACKOFF_MS = Number(process.env.DAVID_CONTROL_LOAD_RETRY_BACKOFF_MS || 15000);
const DECISION_WARMUP_MS = Number(process.env.DAVID_CONTROL_DECISION_WARMUP_MS || 180000);
const TELEMETRY_MAX_AGE_MS = Number(process.env.DAVID_CONTROL_TELEMETRY_MAX_AGE_MS || 60000);

let activeChatUrl = INITIAL_CHAT_URL;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function nowIso() { return new Date().toISOString(); }
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function saveJson(file, value) {
  try { fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8"); } catch {}
}
function loadState() {
  const st = readJson(STATE_FILE) || {};
  if (cleanConversationUrl(st.chatUrl)) activeChatUrl = cleanConversationUrl(st.chatUrl);
  return st;
}
function save(state, action) {
  state.updatedAt = nowIso();
  state.lastAction = action;
  state.chatUrl = activeChatUrl;
  saveJson(STATE_FILE, state);
}
function hashText(text) {
  let h = 2166136261;
  for (const ch of String(text || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return String(h >>> 0);
}
function lastLine(text) {
  return String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).at(-1) || "";
}
function endsOk(text) { return /^OK$/i.test(lastLine(text)); }

async function pageTag(page) {
  try { return await page.evaluate(() => window.name || ""); }
  catch { return ""; }
}

async function setPageTag(page, value) {
  try { await page.evaluate((v) => { window.name = v; }, value); }
  catch {}
}

async function findTaggedPage(context, names = [TAB_NAME, PENDING_TAB_NAME]) {
  for (const page of [...context.pages()].reverse()) {
    if (!page || page.isClosed()) continue;
    const tag = await pageTag(page);
    if (names.includes(tag)) return page;
  }
  return null;
}

async function ensurePage(context, current, state) {
  if (current && !current.isClosed()) {
    const currentUrl = cleanConversationUrl(current.url());
    const active = cleanConversationUrl(activeChatUrl);
    if ((active && currentUrl === active) || (!active && current.url().startsWith("https://chatgpt.com/"))) {
      await setPageTag(current, TAB_NAME);
      return current;
    }
  }

  const tagged = await findTaggedPage(context);
  if (tagged) {
    await setPageTag(tagged, TAB_NAME);
    return tagged;
  }

  let page = cleanConversationUrl(activeChatUrl)
    ? context.pages().find((p) => !p.isClosed() && cleanConversationUrl(p.url()) === cleanConversationUrl(activeChatUrl))
    : null;

  if (!page) {
    page = await context.newPage();
    await setPageTag(page, cleanConversationUrl(activeChatUrl) ? TAB_NAME : PENDING_TAB_NAME);
    await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }

  await setPageTag(page, TAB_NAME);
  return page;
}

async function latestAssistant(page) {
  try {
    const nodes = page.locator('[data-message-author-role="assistant"]');
    if (!await nodes.count()) return "";
    return (await nodes.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
}

async function generating(page) {
  try {
    for (const sel of [
      '[data-testid="stop-button"]',
      '[data-testid*="stop" i]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="stop"]',
      'button[aria-label*="Спри"]',
      'button:has-text("Stop generating")',
      'button:has-text("Stop thinking")',
      'button:has-text("Спри да мисли")',
      'button:has-text("Спри отговора")'
    ]) {
      const n = page.locator(sel).last();
      if (await n.isVisible().catch(() => false)) return true;
    }
  } catch {}
  return false;
}

async function getComposer(page) {
  for (const sel of ['#prompt-textarea','div[contenteditable="true"][data-lexical-editor="true"]','textarea']) {
    try {
      const loc = page.locator(sel).last();
      if (await loc.isVisible().catch(() => false)) return loc;
    } catch {}
  }
  return null;
}

async function waitForComposer(page, state, maxMs = COMPOSER_WAIT_MS) {
  const end = Date.now() + maxMs;
  let nextHeartbeat = 0;
  while (Date.now() < end) {
    const composer = await getComposer(page);
    if (composer) return composer;
    if (Date.now() >= nextHeartbeat) {
      state.watchdog = "control-slow-load-wait";
      save(state, "CONTROL page/composer still loading; WAIT, no refresh");
      nextHeartbeat = Date.now() + 5000;
    }
    await sleep(1000);
  }
  return null;
}

async function fillComposer(composer, text) {
  await composer.click({ timeout: 5000 }).catch(() => {});
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase()).catch(() => "div");
  if (tag === "textarea") {
    await composer.fill(text);
    return;
  }
  await composer.fill(text).catch(async () => {
    await composer.press("Control+A").catch(() => {});
    await composer.press("Backspace").catch(() => {});
    await composer.evaluate((el, value) => {
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    }, text);
  });
}

async function sendComposer(page, composer) {
  for (const sel of ['[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']) {
    const b = page.locator(sel).last();
    if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
      await b.click({ timeout: 4000 });
      return "button";
    }
  }
  await composer.press("Enter");
  return "enter";
}

function conversationLimitText(text) {
  return /(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i.test(String(text || ""));
}

async function conversationMaxed(page) {
  try {
    const body = await page.locator("body").innerText();
    return conversationLimitText(body);
  } catch { return false; }
}

async function rollover(context, page, state) {
  const old = cleanConversationUrl(page && page.url ? page.url() : "") || activeChatUrl;
  state.previousChatUrl = old;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), old])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;

  activeChatUrl = "https://chatgpt.com/";
  state.chatUrl = activeChatUrl;
  save(state, "CONTROL rollover #" + state.rolloverCount + " reserved; adopting/creating one pending tab");

  let next = await findTaggedPage(context, [PENDING_TAB_NAME]);
  if (!next || next === page || next.isClosed()) {
    next = await context.newPage();
    await setPageTag(next, PENDING_TAB_NAME);
    await next.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  await setPageTag(next, TAB_NAME);

  if (page && !page.isClosed() && page !== next) {
    await setPageTag(page, "");
    await page.close({ runBeforeUnload: false }).catch(() => {});
  }

  save(state, "CONTROL rollover #" + state.rolloverCount + "; single new tab adopted; old tab closed");
  console.log("[CONTROL] Max length -> SINGLE NEW TAB #" + state.rolloverCount + "; OLD TAB CLOSED.");
  return next;
}

function compactWorkerState(file) {
  const s = readJson(path.join(HERE, file)) || {};
  return {
    updatedAt: s.updatedAt || null,
    watchdog: s.watchdog || null,
    lastAction: s.lastAction || null,
    problem: s.problem || null,
    lastResult: s.lastResult || null,
    turnsSent: s.turnsSent ?? null,
    chatUrl: cleanConversationUrl(s.chatUrl)
  };
}

function buildTelemetry() {
  const monitor = readJson(MONITOR_FILE) || {};
  const result = readJson(RESULT_FILE) || null;
  const rateLimit = readJson(RATE_LIMIT_FILE) || { status: "clear", stage: -1 };
  return {
    checkedAt: monitor.checkedAt || nowIso(),
    managed: monitor.managed || {},
    workerHealth: monitor.workerHealth || {},
    totalChatGptTabs: monitor.totalChatGptTabs ?? null,
    workers: {
      SYSTEM: compactWorkerState(".david-enchev-state.json"),
      DESIGN: compactWorkerState(".david-enchev-design-state.json"),
      APP2: compactWorkerState(".david-app2-state-6aac2dbb.json"),
      APK: compactWorkerState(".david-apk-state.json")
    },
    lastControlResult: result,
    globalChatGptRateLimit: rateLimit
  };
}

function telemetrySignature(t) {
  const compact = {};
  for (const n of ["SYSTEM","DESIGN","APP2","APK"]) {
    compact[n] = {
      tabs: Array.isArray(t.managed && t.managed[n]) ? t.managed[n].length : 0,
      alive: t.workerHealth && t.workerHealth[n] ? t.workerHealth[n].processAlive : null,
      hbBucket: t.workerHealth && t.workerHealth[n] && t.workerHealth[n].heartbeatAgeMs != null
        ? Math.floor(Number(t.workerHealth[n].heartbeatAgeMs) / 60000) : null,
      problem: t.workers && t.workers[n] ? t.workers[n].problem : null
    };
  }
  compact.lastControlResult = t.lastControlResult ? t.lastControlResult.id : null;
  return hashText(JSON.stringify(compact));
}

function telemetryReady(t) {
  const checkedAt = Date.parse(String(t?.checkedAt || ""));
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > TELEMETRY_MAX_AGE_MS) return false;
  for (const n of ["SYSTEM","DESIGN","APP2","APK"]) {
    if (!Array.isArray(t?.managed?.[n])) return false;
    if (!t?.workerHealth?.[n]) return false;
  }
  return true;
}

function anomaly(t) {
  for (const n of ["SYSTEM","DESIGN","APP2","APK"]) {
    if ((Array.isArray(t.managed && t.managed[n]) ? t.managed[n].length : 0) !== 1) return true;
    if (t.workerHealth && t.workerHealth[n] && t.workerHealth[n].processAlive === false) return true;
    if (Number(t.workerHealth && t.workerHealth[n] ? t.workerHealth[n].heartbeatAgeMs || 0 : 0) > 300000) return true;
    const watchdog = String(t.workers && t.workers[n] ? t.workers[n].watchdog || "" : "");
    if (/(fatal|composer-missing|session-missing|cdp|browser-dead|platform-error)/i.test(watchdog)) return true;
  }
  return false;
}

function controlPrompt(t, reason) {
  return MARKER + "\n\n" +
    "DAVID CONTROL / WATCHTOWER 24/7\n" +
    "Reason: " + reason + "\n\n" +
    "You supervise DAVID only. You do NOT perform project work, code changes, deploys, shell commands, GitHub edits, or free-form browser actions.\n\n" +
    "HARD LAWS:\n" +
    "- Healthy worker => WAIT. Never interfere with active thinking/writing/tool work.\n" +
    "- Exact final OK gate remains owned by each project worker.\n" +
    "- Never bypass CAPTCHA/MFA/login/permission gates.\n" +
    "- Never issue duplicate project prompts.\n" +
    "- Prefer the smallest recovery action affecting only one worker.\n" +
    "- RESTART is stronger than REFRESH; use it only for dead/stale/missing workers.\n" +
    "- CLEAN_DUPLICATES only when a managed worker has more than one owned tab.\n" +
    "- Project PROBLEM IN, Redis/Valkey/Vercel/provider credentials, quota, deploy blockers and test failures are NOT session-health failures: normally WAIT.\n" +
    "- If central guard is already handling connection interruption or send timeout, WAIT unless the worker/tab/heartbeat is actually dead.\n" +
    "- If TELEMETRY.globalChatGptRateLimit.status is blocked or probe, normally ACTION WAIT. Do not REFRESH/RESTART workers merely for rate-limit waiting.\n" +
    "- Do not command actions outside the allowlist.\n\n" +
    "ALLOWLISTED OUTPUT:\n" +
    "ACTION WAIT\n" +
    "ACTION REFRESH SYSTEM|DESIGN|APP2|APK\n" +
    "ACTION RESTART SYSTEM|DESIGN|APP2|APK\n" +
    "ACTION CLEAN_DUPLICATES\n\n" +
    "You may output multiple ACTION lines only when independently necessary.\n" +
    "End the final non-empty line with exactly:\nOK\n\n" +
    "If evidence is insufficient, output ACTION WAIT and OK.\n\n" +
    "TELEMETRY:\n" + JSON.stringify(t, null, 2);
}

function parseActions(text) {
  if (!endsOk(text)) return [];
  const actions = [];
  for (const row of String(text || "").split(/\r?\n/)) {
    const line = row.trim().toUpperCase();
    if (line === "ACTION WAIT") actions.push({ type: "WAIT" });
    else if (line === "ACTION CLEAN_DUPLICATES") actions.push({ type: "CLEAN_DUPLICATES" });
    else {
      const m = line.match(/^ACTION\s+(REFRESH|RESTART)\s+(SYSTEM|DESIGN|APP2|APK)$/);
      if (m) actions.push({ type: m[1], target: m[2] });
    }
  }
  return actions.slice(0, 4);
}

async function sendAndWait(context, page, state, prompt) {
  for (;;) {
    if (await conversationMaxed(page)) page = await rollover(context, page, state);
    const before = hashText(await latestAssistant(page));
    let composer = await waitForComposer(page, state);
    if (!composer) {
      state.watchdog = "control-load-timeout-refresh-once";
      save(state, "CONTROL composer absent after slow-load window -> one bounded refresh");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      composer = await waitForComposer(page, state, 60000);
      if (!composer) {
        state.watchdog = "control-load-backoff";
        save(state, "CONTROL still not interactive after bounded refresh; backoff without restart");
        await sleep(LOAD_RETRY_BACKOFF_MS);
        continue;
      }
    }

    const permit = await waitForGlobalSendPermit("CONTROL", async (decision) => {
      state.watchdog = "control-global-rate-limit-wait";
      state.problemRetryAt = decision.state?.blockedUntil || decision.state?.probeLeaseUntil || null;
      save(state, `GLOBAL RATE LIMIT WAIT mode=${decision.mode}; owner=${decision.state?.probeOwner || "none"}`);
    });
    if (permit.mode === "probe") {
      state.watchdog = "control-global-rate-limit-probe";
      save(state, "CONTROL owns the single post-cooldown probe send");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(2500);
    }

    await fillComposer(composer, prompt);
    await sendComposer(page, composer);
    if (permit.mode === "probe") await markProbeSendStarted("CONTROL");
    state.turnsSent = Number(state.turnsSent || 0) + 1;
    state.watchdog = "control-waiting-response";
    save(state, "CONTROL telemetry sent cycle " + state.turnsSent);

    const startEnd = Date.now() + START_TIMEOUT_MS;
    let started = false;
    while (Date.now() < startEnd) {
      if (await generating(page)) { started = true; break; }
      const text = await latestAssistant(page);
      if (text && hashText(text) !== before) { started = true; break; }
      await sleep(500);
    }
    if (!started) {
      state.watchdog = "control-no-start-backoff";
      save(state, "CONTROL GPT did not start within long start window; WAIT/backoff before one bounded refresh");
      await sleep(LOAD_RETRY_BACKOFF_MS);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(5000);
      continue;
    }

    let stableHash = null;
    let stableSince = 0;
    while (true) {
      if (await conversationMaxed(page)) {
        page = await rollover(context, page, state);
        break;
      }
      if (await generating(page)) {
        state.watchdog = "control-gpt-active";
        save(state, "CONTROL GPT active");
        stableHash = null;
        stableSince = 0;
        await sleep(1000);
        continue;
      }
      const text = await latestAssistant(page);
      const h = hashText(text);
      if (!text || h === before) {
        await sleep(1000);
        continue;
      }
      if (h !== stableHash) {
        stableHash = h;
        stableSince = Date.now();
      }
      if (Date.now() - stableSince >= COMPLETE_QUIET_MS) {
        if (!endsOk(text)) {
          state.watchdog = "control-awaiting-final-ok";
          save(state, "CONTROL response complete-looking but final OK missing; waiting");
          await sleep(COMPLETE_SAMPLE_MS);
          continue;
        }
        const current = cleanConversationUrl(page.url());
        if (current && current !== activeChatUrl) {
          activeChatUrl = current;
          state.chatUrl = current;
        }
        state.watchdog = "control-complete";
        await reportProbeSuccess("CONTROL");
        delete state.problemRetryAt;
        save(state, "CONTROL response complete with final OK");
        return { page, text };
      }
      await sleep(COMPLETE_SAMPLE_MS);
    }
  }
}

async function main() {
  const state = loadState();
  state.startedAt = state.startedAt || nowIso();
  state.role = "DAVID_CONTROL_WATCHTOWER";
  state.watchdog = "control-starting";
  save(state, "CONTROL starting");

  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 60000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error("CONTROL: no shared Edge context");
  let page = await ensurePage(context, null, state);
  console.log("[CONTROL] Session ready: " + page.url());

  let lastSignature = state.lastTelemetrySignature || "";
  let lastReportAt = Number(state.lastReportAt || 0);
  let first = true;
  const processStartedAt = Date.now();

  while (true) {
    if (page.isClosed()) page = await ensurePage(context, null, state);
    if (await conversationMaxed(page)) page = await rollover(context, page, state);

    const current = cleanConversationUrl(page.url());
    if (current && current !== activeChatUrl) {
      activeChatUrl = current;
      state.chatUrl = current;
      state.pendingNewChat = false;
      await setPageTag(page, TAB_NAME);
      save(state, "CONTROL URL synced: " + current);
    }

    const telemetry = buildTelemetry();
    const sig = telemetrySignature(telemetry);
    const ready = telemetryReady(telemetry);
    const warmingUp = Date.now() - processStartedAt < DECISION_WARMUP_MS;
    const unhealthy = ready ? anomaly(telemetry) : false;
    const periodic = Date.now() - lastReportAt >= HEARTBEAT_REPORT_MS;
    const changed = sig !== lastSignature;

    if (!ready || warmingUp) {
      state.watchdog = !ready ? "control-waiting-fresh-telemetry" : "control-startup-warmup";
      save(state, !ready
        ? "CONTROL waiting for fresh complete telemetry; no action allowed"
        : "CONTROL startup warm-up; monitoring only, no recovery commands");
      await sleep(POLL_MS);
      continue;
    }

    if (first || (unhealthy && changed) || periodic) {
      const reason = first ? "startup" : unhealthy ? "health-state-change" : "periodic-heartbeat";
      state.watchdog = "control-sending-telemetry";
      save(state, "CONTROL report: " + reason);
      const result = await sendAndWait(context, page, state, controlPrompt(telemetry, reason));
      page = result.page;
      const actions = parseActions(result.text);
      const executable = actions.filter((a) => a.type !== "WAIT");
      let id = null;
      if (executable.length) {
        id = "ctrl-" + Date.now() + "-" + Math.random().toString(16).slice(2,10);
        saveJson(COMMAND_FILE, { id, createdAt: nowIso(), actions: executable, sourceChatUrl: activeChatUrl, responseHash: hashText(result.text) });
      }
      state.lastCommandId = id;
      state.lastControlActions = actions;
      state.lastTelemetrySignature = sig;
      state.lastReportAt = Date.now();
      save(state, "CONTROL actions queued: " + (actions.map((a) => a.type + (a.target ? " " + a.target : "")).join(", ") || "none"));
      lastSignature = sig;
      lastReportAt = Date.now();
      first = false;
    } else {
      state.watchdog = "control-monitoring";
      save(state, unhealthy ? "CONTROL monitoring unhealthy unchanged state" : "CONTROL monitoring healthy state");
    }

    await sleep(POLL_MS);
  }
}

if (process.argv.includes("--self-test")) {
  const good = parseActions("ACTION REFRESH SYSTEM\nACTION CLEAN_DUPLICATES\nOK");
  if (good.length !== 2 || good[0].type !== "REFRESH" || good[0].target !== "SYSTEM" || good[1].type !== "CLEAN_DUPLICATES") {
    throw new Error("CONTROL self-test: allowlisted actions were not parsed correctly");
  }
  const bad = parseActions("ACTION SHELL SYSTEM\nACTION DELETE APK\nOK");
  if (bad.length !== 0) throw new Error("CONTROL self-test: non-allowlisted command escaped parser");
  const noOk = parseActions("ACTION RESTART APP2");
  if (noOk.length !== 0) throw new Error("CONTROL self-test: action executed without exact final OK");
  if (!conversationLimitText("Достигнахте максималната продължителност на този разговор, но можете да продължите да говорите, като започнете нов чат.")) {
    throw new Error("CONTROL self-test: BG conversation max-length text not detected");
  }
  if (!conversationLimitText("You've reached the maximum length for this conversation, but you can keep talking by starting a new chat.")) {
    throw new Error("CONTROL self-test: EN conversation max-length text not detected");
  }
  if (conversationLimitText("Start a new chat")) {
    throw new Error("CONTROL self-test: generic Start a new chat UI text caused false rollover");
  }
  const staleTelemetry = { checkedAt: new Date(Date.now() - TELEMETRY_MAX_AGE_MS - 1000).toISOString(), managed: {}, workerHealth: {} };
  if (telemetryReady(staleTelemetry)) {
    throw new Error("CONTROL self-test: stale/incomplete telemetry incorrectly accepted");
  }
  console.log("DAVID_CONTROL_WATCHTOWER_SELF_TEST PASS allowlist=1 final_ok_gate=1 arbitrary_command_rejected=1 rollover_false_positive=0 slow_load_tolerant=1 warmup_guard=1");
  process.exit(0);
}

main().catch((error) => {
  console.error("[CONTROL] fatal:", error && (error.stack || error.message) || error);
  process.exit(1);
});
