import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const SYSTEM = path.join(HERE, "auto-continue-enchev-v5.mjs");
const DESIGN = path.join(HERE, "auto-continue-design-v1.mjs");
const APK = path.join(HERE, "auto-continue-david-apk-v1.mjs");
const INTERRUPT_GUARD = path.join(HERE, "connection-interruption-guard.mjs");
const NODE = process.execPath;
const children = new Map();
const MONITOR_FILE = path.join(HERE, ".david-tab-monitor.json");
const MONITOR_MS = Number(process.env.DAVID_TAB_MONITOR_MS || 15000);
let shuttingDown = false;

const specs = [
  {
    name: "SYSTEM",
    script: SYSTEM,
    env: {
      DAVID_CHAT_URL: "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71",
      DAVID_STATE_FILE: path.join(HERE, ".david-enchev-state.json")
    }
  },
  {
    name: "DESIGN",
    script: DESIGN,
    env: {
      DAVID_DESIGN_CHAT_URL: "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7",
      DAVID_DESIGN_STATE_FILE: path.join(HERE, ".david-enchev-design-state.json")
    }
  },
  {
    name: "APK",
    script: APK,
    env: {
      DAVID_APK_STATE_FILE: path.join(HERE, ".david-apk-state.json")
    }
  },
  {
    name: "INTERRUPT",
    script: INTERRUPT_GUARD,
    env: {
      DAVID_INTERRUPT_POLL_MS: "500",
      DAVID_INTERRUPT_RETRY_COOLDOWN_MS: "8000"
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

function launch(spec) {
  if (shuttingDown) return;
  const child = spawn(NODE, [spec.script], {
    cwd: HERE,
    windowsHide: false,
    env: {
      ...process.env,
      DAVID_CDP_URL: process.env.DAVID_CDP_URL || "http://127.0.0.1:9444",
      DAVID_MAX_TURNS: process.env.DAVID_MAX_TURNS || "2147483647",
      ...spec.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  children.set(spec.name, child);
  console.log(`[DUAL] ${spec.name} worker started pid=${child.pid}`);
  pipe(spec.name, child.stdout, process.stdout);
  pipe(spec.name, child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    children.delete(spec.name);
    console.log(`[DUAL] ${spec.name} exited code=${code} signal=${signal || "none"}`);
    if (!shuttingDown) {
      console.log(`[DUAL] Restarting ${spec.name} in 3000ms...`);
      setTimeout(() => launch(spec), 3000);
    }
  });
}

function shutdown() {
  shuttingDown = true;
  for (const child of children.values()) {
    try { child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
}

async function detectManagedKind(page) {
  try {
    const u = cleanConversationUrl(page.url());
    if (!u) return null;
    const text = await page.locator('[data-message-author-role="user"],[data-message-author-role="assistant"]')
      .allInnerTexts()
      .then((xs) => xs.slice(-12).join("\n"))
      .catch(() => "");
    if (/\[DAVID_RELAY_ENCHEV_V5\]/.test(text)) return "SYSTEM";
    if (/\[DAVID_RELAY_ENCHEV_DESIGN_V1\]/.test(text)) return "DESIGN";
    if (/\[DAVID_APP2_AUTOPILOT_V2\]/.test(text)) return "APP2";
    if (/\[DAVID_RELAY_APK_V1\]/.test(text)) return "APK";
    return null;
  } catch { return null; }
}

async function cleanupManagedTabs() {
  const stateSpecs = [
    { kind: "SYSTEM", file: path.join(HERE, ".david-enchev-state.json"), fallback: "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71" },
    { kind: "DESIGN", file: path.join(HERE, ".david-enchev-design-state.json"), fallback: "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7" },
    { kind: "APP2", file: path.join(HERE, ".david-app2-state-6aac2dbb.json"), fallback: "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4" },
    { kind: "APK", file: path.join(HERE, ".david-apk-state.json"), fallback: null }
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

  const cdp = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
  try {
    const browser = await chromium.connectOverCDP(cdp, { timeout: 15000 });
    const context = browser.contexts()[0];
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

    for (const kind of ["SYSTEM","DESIGN","APP2","APK"]) {
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
    for (const kind of ["SYSTEM","DESIGN","APP2","APK"]) {
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
console.log("[DUAL] APK tab: auto-discover DAVID Phone / SoulFlame Twins / DAVID APK session; exact DAVID_APK_CHAT_URL wins when provided.");
console.log("[DUAL] INTERRUPTION GUARD: watches every ChatGPT conversation tab in this DAVID Edge profile.");
console.log("[DUAL] If ChatGPT shows connection interrupted: STOP response -> paste last user prompt -> SEND again.");
console.log("[DUAL] SYSTEM + DESIGN + APK share the same Edge CDP/profile on port 9444. APP2/DPP may run beside them in the same profile.");
async function monitorManagedTabs() {
  if (shuttingDown) return;
  const cdp = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
  try {
    const browser = await chromium.connectOverCDP(cdp, { timeout: 15000 });
    const context = browser.contexts()[0];
    if (!context) return;
    const snapshot = {
      checkedAt: new Date().toISOString(),
      totalBrowserTabs: context.pages().filter((p) => !p.isClosed()).length,
      totalChatGptTabs: 0,
      managed: { SYSTEM: [], DESIGN: [], APP2: [], APK: [] }
    };
    for (const page of context.pages()) {
      if (!page || page.isClosed()) continue;
      if (page.url().startsWith("https://chatgpt.com/")) snapshot.totalChatGptTabs += 1;
      const kind = await detectManagedKind(page);
      const u = cleanConversationUrl(page.url());
      if (kind && u) snapshot.managed[kind].push(u);
    }
    fs.writeFileSync(MONITOR_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    const duplicates = Object.entries(snapshot.managed)
      .filter(([, urls]) => urls.length > 1)
      .map(([kind, urls]) => `${kind}=${urls.length}`);
    if (duplicates.length) {
      console.log(`[DUAL] Tab monitor found duplicates: ${duplicates.join(", ")}. Cleaning...`);
      await cleanupManagedTabs();
    }
  } catch (e) {
    console.log(`[DUAL] Tab monitor skipped: ${e?.message || e}`);
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
