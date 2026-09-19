import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const SYSTEM = path.join(HERE, "auto-continue-enchev-v5.mjs");
const DESIGN = path.join(HERE, "auto-continue-design-v1.mjs");
const APP2 = path.join(HERE, "auto-complete-app2-v1.mjs");
const APK = path.join(HERE, "auto-continue-david-apk-v1.mjs");
const CONTROL = path.join(HERE, "auto-control-watchtower-v1.mjs");
const INTERRUPT_GUARD = path.join(HERE, "connection-interruption-guard.mjs");
const NODE = process.execPath;
const children = new Map();
const MONITOR_FILE = path.join(HERE, ".david-tab-monitor.json");
const CONTROL_COMMAND_FILE = path.join(HERE, ".david-control-command.json");
const CONTROL_RESULT_FILE = path.join(HERE, ".david-control-result.json");
const MONITOR_MS = Number(process.env.DAVID_TAB_MONITOR_MS || 5000);
const MONITOR_CONNECT_TIMEOUT_MS = Number(process.env.DAVID_TAB_MONITOR_CONNECT_TIMEOUT_MS || 60000);
const WORKER_START_GRACE_MS = Number(process.env.DAVID_WORKER_START_GRACE_MS || 120000);
const WORKER_HEARTBEAT_STALE_MS = Number(process.env.DAVID_WORKER_HEARTBEAT_STALE_MS || 600000);
const WORKER_TAB_MISSING_MS = Number(process.env.DAVID_WORKER_TAB_MISSING_MS || 90000);
const CONTROL_START_GRACE_MS = Number(process.env.DAVID_CONTROL_START_GRACE_MS || 300000);
const CONTROL_HEARTBEAT_STALE_MS = Number(process.env.DAVID_CONTROL_HEARTBEAT_STALE_MS || 900000);
const CONTROL_TAB_MISSING_MS = Number(process.env.DAVID_CONTROL_TAB_MISSING_MS || 180000);
let shuttingDown = false;
let monitorBrowser = null;
let monitorContext = null;
let monitorBusy = false;
let lastMonitorSignature = "";
const launchedAt = new Map();
const missingTabSince = new Map();
const restartTimers = new Map();
const restartRequestedAt = new Map();
const workerGeneration = new Map();
let lastControlCommandId = null;

const specs = [
  {
    name: "SYSTEM",
    script: SYSTEM,
    stateFile: path.join(HERE, ".david-enchev-state.json"),
    env: {
      DAVID_CHAT_URL: "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71",
      DAVID_STATE_FILE: path.join(HERE, ".david-enchev-state.json")
    }
  },
  {
    name: "DESIGN",
    script: DESIGN,
    stateFile: path.join(HERE, ".david-enchev-design-state.json"),
    env: {
      DAVID_DESIGN_CHAT_URL: "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7",
      DAVID_DESIGN_STATE_FILE: path.join(HERE, ".david-enchev-design-state.json")
    }
  },
  {
    name: "APP2",
    script: APP2,
    stateFile: path.join(HERE, ".david-app2-state-6aac2dbb.json"),
    env: {
      DAVID_APP2_CHAT_URL: "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4",
      DAVID_APP2_CDP_URL: process.env.DAVID_CDP_URL || "http://127.0.0.1:9444",
      DAVID_APP2_STATE_FILE: path.join(HERE, ".david-app2-state-6aac2dbb.json")
    }
  },
  {
    name: "APK",
    script: APK,
    stateFile: path.join(HERE, ".david-apk-state.json"),
    env: {
      DAVID_APK_STATE_FILE: path.join(HERE, ".david-apk-state.json")
    }
  },
  {
    name: "CONTROL",
    script: CONTROL,
    stateFile: path.join(HERE, ".david-control-state.json"),
    env: {
      DAVID_CONTROL_CHAT_URL: "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e",
      DAVID_CONTROL_STATE_FILE: path.join(HERE, ".david-control-state.json")
    }
  },
  {
    name: "INTERRUPT",
    script: INTERRUPT_GUARD,
    env: {
      DAVID_INTERRUPT_POLL_MS: "500",
      DAVID_INTERRUPT_RETRY_COOLDOWN_MS: "15000"
    }
  }
];

function pipe(name, stream, target) {
  let pending = "";
  stream.on("data", (chunk) => {
    pending += String(chunk);
    const rows = pending.split(/\r?\n/);
    pending = rows.pop() || "";
    rows.filter(Boolean).forEach((row) => target.write(`[${name}] ${row}\n`));
  });
}

function childAlive(child) {
  return Boolean(child && child.exitCode === null && !child.killed);
}

function clearRestartTimer(name) {
  const timer = restartTimers.get(name);
  if (timer) clearTimeout(timer);
  restartTimers.delete(name);
}

function scheduleRestart(spec, delayMs = 3000, reason = "worker exit") {
  if (shuttingDown) return;
  if (restartTimers.has(spec.name)) return;

  const timer = setTimeout(() => {
    restartTimers.delete(spec.name);
    if (shuttingDown) return;
    const current = children.get(spec.name);
    if (childAlive(current)) {
      console.log(`[DUAL] ${spec.name} restart timer skipped; worker already alive pid=${current.pid}`);
      return;
    }
    launch(spec);
  }, delayMs);

  restartTimers.set(spec.name, timer);
  console.log(`[DUAL] ${spec.name} restart scheduled in ${delayMs}ms: ${reason}`);
}

function launch(spec) {
  if (shuttingDown) return null;

  const existing = children.get(spec.name);
  if (childAlive(existing)) {
    console.log(`[DUAL] ${spec.name} launch suppressed; already running pid=${existing.pid}`);
    return existing;
  }

  clearRestartTimer(spec.name);
  const generation = Number(workerGeneration.get(spec.name) || 0) + 1;
  workerGeneration.set(spec.name, generation);

  const child = spawn(NODE, [spec.script], {
    cwd: HERE,
    windowsHide: false,
    env: {
      ...process.env,
      DAVID_CDP_URL: process.env.DAVID_CDP_URL || "http://127.0.0.1:9444",
      DAVID_MAX_TURNS: process.env.DAVID_MAX_TURNS || "2147483647",
      DAVID_WORKER_GENERATION: String(generation),
      ...spec.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.set(spec.name, child);
  launchedAt.set(spec.name, Date.now());
  console.log(`[DUAL] ${spec.name} worker started pid=${child.pid} generation=${generation}`);
  pipe(spec.name, child.stdout, process.stdout);
  pipe(spec.name, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    const current = children.get(spec.name);
    if (current === child) {
      children.delete(spec.name);
      launchedAt.delete(spec.name);
    }

    console.log(`[DUAL] ${spec.name} exited code=${code} signal=${signal || "none"} generation=${generation}`);
    if (!shuttingDown && current === child) {
      scheduleRestart(spec, 3000, "owned worker exit");
    }
  });

  return child;
}

function shutdown() {
  shuttingDown = true;
  for (const timer of restartTimers.values()) clearTimeout(timer);
  restartTimers.clear();
  for (const child of children.values()) {
    try { child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

function restartWorker(name, reason) {
  if (shuttingDown) return;
  const spec = specs.find((x) => x.name === name);
  if (!spec) return;

  const now = Date.now();
  const last = Number(restartRequestedAt.get(name) || 0);
  if (now - last < 30000) {
    console.log(`[DUAL] SELF-HEAL ${name} suppressed by 30s debounce: ${reason}`);
    return;
  }
  restartRequestedAt.set(name, now);
  clearRestartTimer(name);
  missingTabSince.delete(name);

  const child = children.get(name);
  console.log(`[DUAL] SELF-HEAL ${name}: ${reason}`);
  if (childAlive(child)) {
    try { child.kill("SIGTERM"); } catch {}
    scheduleRestart(spec, 3000, "self-heal");
  } else {
    scheduleRestart(spec, 1000, "self-heal missing worker");
  }
}

function stateHeartbeatAgeMs(spec) {
  if (!spec?.stateFile) return null;
  const st = readState(spec.stateFile);
  const ts = Date.parse(st.updatedAt || "");
  if (!Number.isFinite(ts)) return null;
  return Date.now() - ts;
}

function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
}

async function getMonitorContext() {
  if (monitorContext) {
    try {
      void monitorContext.pages();
      return monitorContext;
    } catch {
      monitorContext = null;
      monitorBrowser = null;
    }
  }
  const cdp = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
  monitorBrowser = await chromium.connectOverCDP(cdp, { timeout: MONITOR_CONNECT_TIMEOUT_MS });
  monitorContext = monitorBrowser.contexts()[0] || null;
  if (!monitorContext) {
    monitorBrowser = null;
    throw new Error("No shared Edge context available for tab monitor");
  }
  monitorBrowser.on("disconnected", () => {
    monitorBrowser = null;
    monitorContext = null;
    console.log("[DUAL] Persistent tab monitor CDP disconnected; next cycle will reconnect.");
  });
  console.log("[DUAL] Persistent tab monitor CDP connected.");
  return monitorContext;
}

function currentOwnedUrls() {
  const defs = [
    ["SYSTEM", path.join(HERE, ".david-enchev-state.json"), "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"],
    ["DESIGN", path.join(HERE, ".david-enchev-design-state.json"), "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7"],
    ["APP2", path.join(HERE, ".david-app2-state-6aac2dbb.json"), "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"],
    ["APK", path.join(HERE, ".david-apk-state.json"), null],
    ["CONTROL", path.join(HERE, ".david-control-state.json"), "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e"]
  ];
  const byUrl = new Map();
  for (const [kind, file, fallback] of defs) {
    const st = readState(file);
    const u = cleanConversationUrl(st.chatUrl) || cleanConversationUrl(fallback);
    if (u) byUrl.set(u, kind);
  }
  return byUrl;
}

async function detectManagedKind(page) {
  try {
    const u = cleanConversationUrl(page.url());
    if (!u) return null;

    // Primary ownership is the persisted current chat URL. This remains stable
    // even after the relay marker has scrolled far out of the recent messages.
    const owned = currentOwnedUrls().get(u);
    if (owned) return owned;

    // Marker scan is only a fallback for first discovery / rollover races.
    const text = await page.locator('[data-message-author-role="user"],[data-message-author-role="assistant"]')
      .allInnerTexts()
      .then((xs) => xs.slice(-60).join("\n"))
      .catch(() => "");
    if (/\[DAVID_RELAY_ENCHEV_V5\]/.test(text)) return "SYSTEM";
    if (/\[DAVID_RELAY_ENCHEV_DESIGN_V1\]/.test(text)) return "DESIGN";
    if (/\[DAVID_APP2_AUTOPILOT_V2\]/.test(text)) return "APP2";
    if (/\[DAVID_RELAY_APK_V1\]/.test(text)) return "APK";
    if (/\[DAVID_CONTROL_WATCHTOWER_V1\]/.test(text)) return "CONTROL";
    return null;
  } catch { return null; }
}

async function pageShowsActiveWork(page) {
  if (!page || page.isClosed()) return false;
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
    try {
      const n = page.locator(sel).last();
      if (await n.isVisible().catch(() => false)) return true;
    } catch {}
  }
  return false;
}

async function controlActionProtected(target, context) {
  const spec = specs.find((x) => x.name === target);
  const st = spec?.stateFile ? readState(spec.stateFile) : {};
  const watchdog = String(st?.watchdog || "");
  if (/(thinking|writing|tool|active|settling|awaiting-final-ok|waiting-response|sending|send-timeout)/i.test(watchdog)) {
    return { protected: true, reason: "worker watchdog protected: " + watchdog };
  }

  const owned = currentOwnedUrls();
  let targetUrl = null;
  for (const [url, kind] of owned.entries()) if (kind === target) targetUrl = url;
  const page = targetUrl ? context.pages().find((p) => !p.isClosed() && cleanConversationUrl(p.url()) === targetUrl) : null;
  if (page && await pageShowsActiveWork(page)) {
    return { protected: true, reason: "owned ChatGPT tab shows active generation" };
  }
  return { protected: false, page, targetUrl };
}

async function executeControlCommand(context) {
  if (!lastControlCommandId) {
    const previous = readState(CONTROL_RESULT_FILE);
    if (previous?.id) lastControlCommandId = previous.id;
  }
  const command = readState(CONTROL_COMMAND_FILE);
  if (!command?.id || command.id === lastControlCommandId) return;
  lastControlCommandId = command.id;

  const allowedWorkers = new Set(["SYSTEM","DESIGN","APP2","APK"]);
  const actions = Array.isArray(command.actions) ? command.actions.slice(0, 4) : [];
  const results = [];

  for (const action of actions) {
    const type = String(action?.type || "").toUpperCase();
    const target = String(action?.target || "").toUpperCase();

    if (type === "WAIT") {
      results.push({ type, ok: true, detail: "no-op" });
      continue;
    }

    if (type === "CLEAN_DUPLICATES") {
      await cleanupManagedTabs();
      results.push({ type, ok: true, detail: "cleanup invoked" });
      continue;
    }

    if ((type === "REFRESH" || type === "RESTART") && allowedWorkers.has(target)) {
      const guard = await controlActionProtected(target, context);
      if (guard.protected) {
        results.push({ type, target, ok: false, detail: "REJECTED: " + guard.reason });
        continue;
      }

      if (type === "RESTART") {
        restartWorker(target, "CONTROL command " + command.id);
        results.push({ type, target, ok: true, detail: "worker restart requested" });
        continue;
      }

      const page = guard.page;
      if (page) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        results.push({ type, target, ok: true, detail: "owned tab refreshed" });
      } else {
        restartWorker(target, "CONTROL refresh fallback: owned tab missing");
        results.push({ type, target, ok: true, detail: "tab missing; worker restart requested" });
      }
      continue;
    }

    results.push({ type, target: target || null, ok: false, detail: "rejected by allowlist" });
  }

  const result = {
    id: command.id,
    executedAt: new Date().toISOString(),
    sourceChatUrl: command.sourceChatUrl || null,
    results
  };
  try { fs.writeFileSync(CONTROL_RESULT_FILE, JSON.stringify(result, null, 2), "utf8"); } catch {}
  console.log("[DUAL] CONTROL command " + command.id + " executed: " + JSON.stringify(results));
}

async function cleanupManagedTabs() {
  const stateSpecs = [
    { kind: "SYSTEM", file: path.join(HERE, ".david-enchev-state.json"), fallback: "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71" },
    { kind: "DESIGN", file: path.join(HERE, ".david-enchev-design-state.json"), fallback: "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7" },
    { kind: "APP2", file: path.join(HERE, ".david-app2-state-6aac2dbb.json"), fallback: "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4" },
    { kind: "APK", file: path.join(HERE, ".david-apk-state.json"), fallback: null },
    { kind: "CONTROL", file: path.join(HERE, ".david-control-state.json"), fallback: "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e" }
  ];
  const preferredByKind = new Map();
  const stale = new Set();

  for (const spec of stateSpecs) {
    const st = readState(spec.file);
    const cur = cleanConversationUrl(st.chatUrl) || cleanConversationUrl(spec.fallback);
    if (cur) preferredByKind.set(spec.kind, cur);
    const prev = cleanConversationUrl(st.previousChatUrl);
    if (prev) stale.add(prev);
    for (const old of Array.isArray(st.staleChatUrls) ? st.staleChatUrls : []) {
      const u = cleanConversationUrl(old);
      if (u) stale.add(u);
    }
  }
  for (const u of preferredByKind.values()) stale.delete(u);

  try {
    const context = await getMonitorContext();
    if (!context) return;

    const managed = [];
    for (const page of context.pages()) {
      if (!page || page.isClosed()) continue;
      const u = cleanConversationUrl(page.url());
      if (!u) continue;
      const kind = await detectManagedKind(page);
      if (kind) managed.push({ page, url: u, kind });
    }

    let closed = 0;
    for (const u of stale) {
      for (const item of managed) {
        if (item.page.isClosed()) continue;
        if (item.url !== u) continue;
        await item.page.close({ runBeforeUnload: false }).catch(() => {});
        closed++;
      }
    }

    for (const kind of ["SYSTEM","DESIGN","APP2","APK","CONTROL"]) {
      const tabs = managed.filter((x) => x.kind === kind && !x.page.isClosed());
      if (tabs.length <= 1) continue;
      const preferred = preferredByKind.get(kind);
      let keep = tabs.find((x) => preferred && x.url === preferred) || tabs.at(-1);
      for (const item of tabs) {
        if (item === keep || item.page.isClosed()) continue;
        await item.page.close({ runBeforeUnload: false }).catch(() => {});
        closed++;
      }
    }

    const remaining = {};
    for (const kind of ["SYSTEM","DESIGN","APP2","APK","CONTROL"]) {
      remaining[kind] = managed.filter((x) => x.kind === kind && !x.page.isClosed()).length;
    }
    console.log(`[DUAL] Managed tab cleanup complete. closed=${closed} remaining=${JSON.stringify(remaining)}`);
  } catch (e) {
    console.log(`[DUAL] Managed tab cleanup skipped: ${e?.message || e}`);
  }
}

console.log("[DUAL] DAVID multi-session mode ON.");
console.log("[DUAL] SYSTEM tab: 6aab44e1-385c-83eb-b122-c4ae9836cb71");
console.log("[DUAL] DESIGN tab: 6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7");
console.log("[DUAL] APP2 tab: 6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4");
console.log("[DUAL] APK tab: auto-discover DAVID Phone / SoulFlame Twins / DAVID APK session; exact DAVID_APK_CHAT_URL wins when provided.");
console.log("[DUAL] CONTROL tab: 6aade2fa-e2a0-83ed-96af-702c0430d49e");
console.log("[DUAL] INTERRUPTION GUARD: watches every managed ChatGPT conversation in this DAVID Edge profile.");
console.log("[DUAL] 24/7 law: active GPT/tool work => WAIT; confirmed frozen interruption => refresh/verify/resend; workers self-heal by heartbeat/tab ownership.");
console.log("[DUAL] CONTROL law: GPT WATCHTOWER may request only allowlisted REFRESH/RESTART/CLEAN_DUPLICATES actions after exact final OK.");
console.log("[DUAL] CONTROL + SYSTEM + DESIGN + APP2 + APK share the same Edge CDP/profile on port 9444.");
async function monitorManagedTabs() {
  if (shuttingDown || monitorBusy) return;
  monitorBusy = true;
  try {
    const context = await getMonitorContext();
    if (!context) return;
    const snapshot = {
      checkedAt: new Date().toISOString(),
      totalBrowserTabs: context.pages().filter((p) => !p.isClosed()).length,
      totalChatGptTabs: 0,
      managed: { SYSTEM: [], DESIGN: [], APP2: [], APK: [], CONTROL: [] }
    };
    for (const page of context.pages()) {
      if (!page || page.isClosed()) continue;
      if (page.url().startsWith("https://chatgpt.com/")) snapshot.totalChatGptTabs += 1;
      const kind = await detectManagedKind(page);
      const u = cleanConversationUrl(page.url());
      if (kind && u) snapshot.managed[kind].push(u);
    }
    const counts = Object.fromEntries(Object.entries(snapshot.managed).map(([kind, urls]) => [kind, urls.length]));

    snapshot.workerHealth = {};
    for (const spec of specs.filter((x) => x.name !== "INTERRUPT")) {
      const ageMs = stateHeartbeatAgeMs(spec);
      const launchAge = Date.now() - Number(launchedAt.get(spec.name) || Date.now());
      const processAlive = Boolean(children.get(spec.name));
      const tabCount = Number(counts[spec.name] || 0);
      const isControl = spec.name === "CONTROL";
      const startGraceMs = isControl ? CONTROL_START_GRACE_MS : WORKER_START_GRACE_MS;
      const heartbeatStaleMs = isControl ? CONTROL_HEARTBEAT_STALE_MS : WORKER_HEARTBEAT_STALE_MS;
      const tabMissingMs = isControl ? CONTROL_TAB_MISSING_MS : WORKER_TAB_MISSING_MS;
      snapshot.workerHealth[spec.name] = { processAlive, heartbeatAgeMs: ageMs, tabCount, startGraceMs, heartbeatStaleMs, tabMissingMs };

      if (tabCount > 0) {
        missingTabSince.delete(spec.name);
      } else if (launchAge > startGraceMs) {
        const since = Number(missingTabSince.get(spec.name) || Date.now());
        if (!missingTabSince.has(spec.name)) missingTabSince.set(spec.name, Date.now());
        if (Date.now() - since > tabMissingMs) {
          restartWorker(spec.name, `managed tab missing for >${tabMissingMs}ms`);
          continue;
        }
      }

      if (
        processAlive &&
        ageMs !== null &&
        ageMs > heartbeatStaleMs &&
        launchAge > startGraceMs
      ) {
        restartWorker(spec.name, `heartbeat stale for ${ageMs}ms`);
      } else if (!processAlive && launchAge > 5000) {
        launch(spec);
      }
    }
    fs.writeFileSync(MONITOR_FILE, JSON.stringify(snapshot, null, 2), "utf8");

    const signature = JSON.stringify(counts);
    if (signature !== lastMonitorSignature) {
      lastMonitorSignature = signature;
      console.log(`[DUAL] TRACK CONTROL=${counts.CONTROL} SYSTEM=${counts.SYSTEM} DESIGN=${counts.DESIGN} APP2=${counts.APP2} APK=${counts.APK} chatgptTabs=${snapshot.totalChatGptTabs}`);
    }
    await executeControlCommand(context);

    const duplicates = Object.entries(snapshot.managed)
      .filter(([, urls]) => urls.length > 1)
      .map(([kind, urls]) => `${kind}=${urls.length}`);
    if (duplicates.length) {
      console.log(`[DUAL] Tab monitor found duplicates: ${duplicates.join(", ")}. Cleaning...`);
      await cleanupManagedTabs();
    }
  } catch (e) {
    monitorBrowser = null;
    monitorContext = null;
    console.log(`[DUAL] Tab monitor skipped: ${e?.message || e}`);
  } finally {
    monitorBusy = false;
  }
}

await cleanupManagedTabs();
await monitorManagedTabs();
specs.forEach(launch);
const monitorTimer = setInterval(() => {
  monitorManagedTabs().catch((e) => console.log(`[DUAL] Tab monitor error: ${e?.message || e}`));
}, MONITOR_MS);
monitorTimer.unref?.();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
