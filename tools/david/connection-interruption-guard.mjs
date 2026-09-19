import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { reportRateLimit } from "./chatgpt-rate-limit-coordinator.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));

const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const POLL_MS = Number(process.env.DAVID_INTERRUPT_POLL_MS || 400);
const RETRY_COOLDOWN_MS = Number(process.env.DAVID_INTERRUPT_RETRY_COOLDOWN_MS || 5000);
const CONFIRM_MS = Number(process.env.DAVID_INTERRUPT_CONFIRM_MS || 5000);
const CONFIRM_SAMPLES = Number(process.env.DAVID_INTERRUPT_CONFIRM_SAMPLES || 4);
const SEND_TIMEOUT_COOLDOWN_MS = Number(process.env.DAVID_SEND_TIMEOUT_COOLDOWN_MS || 1000);
const SEND_TIMEOUT_MAX_RETRIES = Number(process.env.DAVID_SEND_TIMEOUT_MAX_RETRIES || 3);
const SEND_TIMEOUT_STALE_ACTIVE_MS = Number(process.env.DAVID_SEND_TIMEOUT_STALE_ACTIVE_MS || 8000);
const SEND_TIMEOUT_RELOAD_SETTLE_MS = Number(process.env.DAVID_SEND_TIMEOUT_RELOAD_SETTLE_MS || 2500);
const RECOVERY_REQUEST_FILE = path.join(HERE, ".david-recovery-request.json");
const ACTIVE_MANAGED_KINDS = new Set(
  String(process.env.DAVID_ACTIVE_WORKERS || "SYSTEM,DESIGN,APP2,APK,CONTROL")
    .split(",").map((x) => x.trim().toUpperCase()).filter(Boolean)
);
ACTIVE_MANAGED_KINDS.add("CONTROL");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const recoveredAt = new Map();
const interruptionSince = new Map();
const interruptionSamples = new Map();
const sendTimeoutRecoveredAt = new Map();
const sendTimeoutAttempts = new Map();
const sendTimeoutFirstSeenAt = new Map();
const sendTimeoutLastHash = new Map();
const sendTimeoutLastProgressAt = new Map();
const sendTimeoutReloaded = new Map();
const sendTimeoutRecoveryRequestedAt = new Map();
const rateLimitReportedAt = new Map();

function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
}
function writeJsonAtomic(file, value) {
  const tmp = file + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function requestWorkerRecovery(page, reason, evidence = {}) {
  const url = page.url();
  const target = managedKindFromUrl(url);
  if (!target || target === "GLOBAL") {
    console.log(`[INTERRUPT] Recovery escalation skipped for unmanaged URL ${url}.`);
    return false;
  }

  const now = Date.now();
  const last = Number(sendTimeoutRecoveryRequestedAt.get(url) || 0);
  if (now - last < 15000) return false;
  sendTimeoutRecoveryRequestedAt.set(url, now);

  const request = {
    id: `recover-${target.toLowerCase()}-${now}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: new Date(now).toISOString(),
    target,
    action: "RESTART",
    reason,
    sourceUrl: url,
    evidence
  };
  writeJsonAtomic(RECOVERY_REQUEST_FILE, request);
  console.log(`[INTERRUPT] FAST RECOVERY requested worker RESTART target=${target} reason=${reason}`);
  return true;
}

function clearSendTimeoutTracking(url) {
  sendTimeoutAttempts.delete(url);
  sendTimeoutFirstSeenAt.delete(url);
  sendTimeoutLastHash.delete(url);
  sendTimeoutLastProgressAt.delete(url);
  sendTimeoutReloaded.delete(url);
  sendTimeoutRecoveryRequestedAt.delete(url);
}


function managedConversationUrls() {
  const defs = [
    ["SYSTEM", path.join(HERE, ".david-enchev-state.json"), "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"],
    ["DESIGN", path.join(HERE, ".david-enchev-design-state.json"), "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7"],
    ["APP2", path.join(HERE, ".david-app2-state-6aac2dbb.json"), "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"],
    ["APK", path.join(HERE, ".david-apk-state.json"), null],
    ["CONTROL", path.join(HERE, ".david-control-state.json"), "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e"]
  ].filter(([kind]) => ACTIVE_MANAGED_KINDS.has(kind));
  const urls = new Set();
  for (const [, file, fallback] of defs) {
    const st = readState(file);
    const u = cleanConversationUrl(st.chatUrl) || cleanConversationUrl(fallback);
    if (u) urls.add(u);
  }
  return urls;
}

function isManagedChat(page) {
  if (!isChat(page)) return false;
  const u = cleanConversationUrl(page.url());
  return Boolean(u && managedConversationUrls().has(u));
}

function isChat(page) {
  try { return !page.isClosed() && /^https:\/\/chatgpt\.com\/c\//i.test(page.url()); }
  catch { return false; }
}

function managedKindFromUrl(url) {
  const u = cleanConversationUrl(url);
  if (!u) return "GLOBAL";
  const defs = [
    ["SYSTEM", path.join(HERE, ".david-enchev-state.json"), "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"],
    ["DESIGN", path.join(HERE, ".david-enchev-design-state.json"), "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7"],
    ["APP2", path.join(HERE, ".david-app2-state-6aac2dbb.json"), "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"],
    ["APK", path.join(HERE, ".david-apk-state.json"), null],
    ["CONTROL", path.join(HERE, ".david-control-state.json"), "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e"]
  ].filter(([kind]) => ACTIVE_MANAGED_KINDS.has(kind));
  for (const [kind, file, fallback] of defs) {
    const st = readState(file);
    const current = cleanConversationUrl(st.chatUrl) || cleanConversationUrl(fallback);
    if (current === u) return kind;
  }
  return "GLOBAL";
}

async function rateLimitVisible(page) {
  if (!isManagedChat(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const re = /(твърде много заявки|правите заявки прекалено бързо|изчакайте няколко минути|too many requests|requests too quickly|please wait a few minutes|rate limit)/i;
      for (const el of document.querySelectorAll('[role="dialog"],[role="alert"],[aria-live="assertive"],[data-testid*="error" i],div,section,p,span')) {
        if (!visible(el)) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 600 && re.test(text)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function clickRateLimitAcknowledge(page) {
  const labels = [/^Разбрано$/i, /^Got it$/i, /^Understood$/i, /^Okay$/i];
  try {
    const dialogs = page.locator('[role="dialog"]');
    for (let d = (await dialogs.count()) - 1; d >= 0; d--) {
      const dialog = dialogs.nth(d);
      if (!await dialog.isVisible().catch(() => false)) continue;
      const text = (await dialog.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (!/(твърде много заявки|правите заявки прекалено бързо|too many requests|requests too quickly|rate limit)/i.test(text)) continue;
      for (const label of labels) {
        const buttons = dialog.getByRole("button", { name: label });
        for (let i = (await buttons.count()) - 1; i >= 0; i--) {
          const b = buttons.nth(i);
          if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
            await b.click({ timeout: 4000 });
            return true;
          }
        }
      }
    }

    // Fallback: only after rateLimitVisible() has already confirmed the popup.
    for (const label of labels) {
      const buttons = page.getByRole("button", { name: label });
      for (let i = (await buttons.count()) - 1; i >= 0; i--) {
        const b = buttons.nth(i);
        if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
          await b.click({ timeout: 4000 });
          return true;
        }
      }
    }
  } catch {}
  return false;
}

async function sendTimeoutVisible(page) {
  if (!isManagedChat(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const re = /(изпращането на съобщението изтече по време|моля, опитайте отново|message sending timed out|sending the message timed out|message send timed out|please try again)/i;
      for (const el of document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="error" i],div,section,p,span')) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role="assistant"]')) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 360 && re.test(text)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function clickSendTimeoutRetry(page) {
  const labels = [/^Опитайте отново$/i, /^Try again$/i, /^Retry$/i];
  for (const label of labels) {
    try {
      const buttons = page.getByRole("button", { name: label });
      for (let i = (await buttons.count()) - 1; i >= 0; i--) {
        const b = buttons.nth(i);
        if (!await b.isVisible().catch(() => false) || !await b.isEnabled().catch(() => false)) continue;
        try {
          await b.click({ timeout: 1500 });
          return true;
        } catch {}
        try {
          await b.click({ force: true, timeout: 1500 });
          return true;
        } catch {}
      }
    } catch {}
  }
  return false;
}

async function recoverSendTimeout(page) {
  const url = page.url();
  const now = Date.now();
  if (now - Number(sendTimeoutRecoveredAt.get(url) || 0) < SEND_TIMEOUT_COOLDOWN_MS) return;

  const firstSeenAt = Number(sendTimeoutFirstSeenAt.get(url) || now);
  if (!sendTimeoutFirstSeenAt.has(url)) sendTimeoutFirstSeenAt.set(url, now);

  const currentHash = await assistantTextHash(page);
  const previousHash = String(sendTimeoutLastHash.get(url) || "");
  if (currentHash && currentHash !== previousHash) {
    sendTimeoutLastHash.set(url, currentHash);
    sendTimeoutLastProgressAt.set(url, now);
  }
  const lastProgressAt = Number(sendTimeoutLastProgressAt.get(url) || firstSeenAt);
  const noProgressMs = now - lastProgressAt;

  // HARD LAW: when ChatGPT renders the explicit send-timeout Try again button,
  // click it immediately. The timeout UI is stronger evidence than a stale
  // "thinking" indicator; do not make the user wait for the stale-active timer.
  const attempt = Number(sendTimeoutAttempts.get(url) || 0) + 1;
  if (attempt <= SEND_TIMEOUT_MAX_RETRIES) {
    sendTimeoutAttempts.set(url, attempt);
    sendTimeoutRecoveredAt.set(url, now);
    console.log(`[INTERRUPT] MANDATORY IMMEDIATE TRY AGAIN attempt=${attempt}/${SEND_TIMEOUT_MAX_RETRIES} url=${url}`);

    const clicked = await clickSendTimeoutRetry(page);
    if (clicked) {
      await sleep(1000);
      if (!await sendTimeoutVisible(page)) {
        clearSendTimeoutTracking(url);
        console.log("[INTERRUPT] Try again cleared the send-timeout UI.");
        return;
      }
      if (await activeAssistantWork(page)) {
        console.log("[INTERRUPT] Try again clicked; GPT now active. WAIT for response, no duplicate send.");
        return;
      }
    } else {
      console.log("[INTERRUPT] Try again button was expected but click did not land; next 400ms scan retries immediately.");
    }

    if (attempt < SEND_TIMEOUT_MAX_RETRIES) return;
  }

  if (!sendTimeoutReloaded.get(url)) {
    sendTimeoutReloaded.set(url, true);
    sendTimeoutRecoveredAt.set(url, now);
    const beforeHash = await assistantTextHash(page);
    console.log(`[INTERRUPT] FAST RECOVERY step=RELOAD after mandatory Try again attempts url=${url}`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(SEND_TIMEOUT_RELOAD_SETTLE_MS);

    if (await activeAssistantWork(page)) {
      console.log("[INTERRUPT] GPT active after RELOAD; WAIT.");
      return;
    }

    const afterHash = await assistantTextHash(page);
    if (beforeHash && afterHash && beforeHash !== afterHash) {
      clearSendTimeoutTracking(url);
      console.log("[INTERRUPT] Assistant progressed after RELOAD; recovery cancelled.");
      return;
    }

    if (!await sendTimeoutVisible(page)) {
      clearSendTimeoutTracking(url);
      console.log("[INTERRUPT] RELOAD cleared send-timeout UI.");
      return;
    }
  }

  if (await activeAssistantWork(page)) {
    console.log("[INTERRUPT] Recovery escalation blocked because GPT became active again.");
    return;
  }

  const finalHash = await assistantTextHash(page);
  const lastHash = String(sendTimeoutLastHash.get(url) || "");
  if (finalHash && lastHash && finalHash !== lastHash) {
    clearSendTimeoutTracking(url);
    console.log("[INTERRUPT] Assistant text progressed after recovery ladder; WAIT.");
    return;
  }

  requestWorkerRecovery(page, "send-timeout survived mandatory Try again x3 + Reload", {
    noProgressMs,
    retries: SEND_TIMEOUT_MAX_RETRIES,
    reloaded: true,
    assistantHash: finalHash || null
  });
  sendTimeoutRecoveredAt.set(url, now);
}

async function interruptionVisible(page) {
  if (!isChat(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const re = /(връзката беше прекъсната|изчакване на пълния отговор|connection (?:was )?interrupted|waiting for (?:the )?full response)/i;
      const nodes = Array.from(document.querySelectorAll("div,span,p"));
      for (const el of nodes) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 260 && re.test(text)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function activeAssistantWork(page) {
  if (!isChat(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };

      const stopSelectors = [
        '[data-testid="stop-button"]',
        '[data-testid*="stop" i]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="stop"]',
        'button[aria-label*="Спри"]'
      ];
      for (const sel of stopSelectors) {
        for (const el of document.querySelectorAll(sel)) if (visible(el)) return true;
      }

      // Static historical tool cards ("Извикан инструмент") are NOT enough to
      // classify the turn as still active. Only live status outside completed
      // conversation turns counts as active when no Stop control is visible.
      const liveRe = /^(thinking|мислене|мисли|working|работи|searching|търсене|browsing|преглежда|analyzing|анализира)(\.{0,3})$/i;
      for (const el of document.querySelectorAll("div,span,p")) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 80 && liveRe.test(text)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function assistantTextHash(page) {
  try {
    const nodes = page.locator('[data-message-author-role="assistant"]');
    if (!await nodes.count()) return "";
    const text = (await nodes.last().innerText().catch(() => "")).trim();
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return String(h >>> 0);
  } catch { return ""; }
}
async function latestUserText(page) {
  try {
    const nodes = page.locator('[data-message-author-role="user"]');
    const count = await nodes.count();
    if (!count) return "";
    return (await nodes.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
}

async function getComposer(page) {
  const selectors = [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    try {
      const x = page.locator(selector).last();
      if (await x.count() && await x.isVisible().catch(() => false)) return x;
    } catch {}
  }
  return null;
}

async function fillComposer(composer, text) {
  try {
    await composer.fill(text, { timeout: 5000 });
    return;
  } catch {}
  await composer.focus({ timeout: 3000 }).catch(() => {});
  await composer.evaluate((el, value) => {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.value = value;
    else el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, text);
}

async function sendComposer(page, composer) {
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Изпрати"]'
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).last();
      if (await button.count() && await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false)) {
        try {
          await button.click({ timeout: 2000 });
          return "button";
        } catch {}
      }
    } catch {}
  }
  try {
    await composer.focus({ timeout: 2000 });
    await composer.press("Enter", { timeout: 3000 });
    return "enter";
  } catch {}

  for (const selector of selectors) {
    const button = page.locator(selector).last();
    if (await button.count() && await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false)) {
      await button.click({ force: true, timeout: 3000 });
      return "force-button";
    }
  }
  throw new Error("Guard send failed after pointer-safe fallbacks");
}

async function recover(page) {
  const url = page.url();
  const key = url;
  const now = Date.now();
  if (now - Number(recoveredAt.get(key) || 0) < RETRY_COOLDOWN_MS) return;

  if (await activeAssistantWork(page)) {
    interruptionSince.delete(key);
    interruptionSamples.delete(key);
    console.log(`[INTERRUPT] Interruption-like UI seen on ${url}, but GPT is still active. NO ACTION.`);
    return;
  }

  const firstSeen = Number(interruptionSince.get(key) || 0);
  const samples = Number(interruptionSamples.get(key) || 0) + 1;
  if (!firstSeen) interruptionSince.set(key, now);
  interruptionSamples.set(key, samples);

  const age = now - Number(interruptionSince.get(key) || now);
  if (age < CONFIRM_MS || samples < CONFIRM_SAMPLES) {
    console.log(`[INTERRUPT] Candidate on ${url}; confirming ${samples}/${CONFIRM_SAMPLES}, age=${age}ms. NO STOP.`);
    return;
  }

  const beforeHash = await assistantTextHash(page);
  await sleep(2500);
  if (await activeAssistantWork(page)) {
    interruptionSince.delete(key);
    interruptionSamples.delete(key);
    console.log(`[INTERRUPT] GPT resumed on ${url}. Recovery cancelled.`);
    return;
  }
  const afterHash = await assistantTextHash(page);
  if (beforeHash && afterHash && beforeHash !== afterHash) {
    interruptionSince.delete(key);
    interruptionSamples.delete(key);
    console.log(`[INTERRUPT] Assistant text progressed on ${url}. Recovery cancelled.`);
    return;
  }

  const prompt = await latestUserText(page);
  if (!prompt) {
    console.log(`[INTERRUPT] Confirmed interruption on ${url}, but no previous user prompt was found.`);
    interruptionSince.delete(key);
    interruptionSamples.delete(key);
    return;
  }

  recoveredAt.set(key, Date.now());
  interruptionSince.delete(key);
  interruptionSamples.delete(key);

  console.log(`[INTERRUPT] CONFIRMED interruption on ${url}. LAW: REFRESH -> VERIFY -> RESEND. Never stop active GPT.`);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(2500);

  if (await activeAssistantWork(page)) {
    console.log("[INTERRUPT] GPT is active after refresh. Resend cancelled.");
    return;
  }

  const refreshedHash = await assistantTextHash(page);
  const refreshedText = await page.locator('[data-message-author-role="assistant"]').last().innerText().catch(() => "");
  const terminal = String(refreshedText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).at(-1) || "";
  if (/^OK$/i.test(terminal) || /^PROBLEM IN:/i.test(terminal)) {
    console.log("[INTERRUPT] Response recovered to a terminal marker after refresh. Resend cancelled.");
    return;
  }
  if (beforeHash && refreshedHash && beforeHash !== refreshedHash) {
    console.log("[INTERRUPT] Assistant response progressed after refresh. Waiting instead of resending.");
    return;
  }

  // A confirmed interruption with no active GPT, no terminal marker and no
  // assistant progress means the accepted turn was stranded. Resend even if
  // the banner disappeared during reload.
  console.log("[INTERRUPT] Confirmed stranded turn after refresh. Safe resend allowed.");

  let composer = await getComposer(page);
  for (let i = 0; !composer && i < 8; i++) {
    await sleep(500);
    composer = await getComposer(page);
  }
  if (!composer) {
    console.log("[INTERRUPT] Composer unavailable after confirmed refresh; waiting for next scan.");
    return;
  }

  await fillComposer(composer, prompt);
  await sleep(250);
  const via = await sendComposer(page, composer);
  console.log(`[INTERRUPT] Previous prompt resent via ${via} after confirmed interruption.`);
}

async function main() {
  console.log(`[INTERRUPT] Connecting to shared Edge CDP ${CDP_URL}`);
  let browser = null;
  let context = null;
  while (!context) {
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 120000 });
      context = browser.contexts()[0] || null;
      if (!context) throw new Error("No active Chromium context on CDP port.");
    } catch (error) {
      console.log(`[INTERRUPT] CDP not ready: ${error?.message || error}. WAIT 5s -> reconnect. Guard stays alive.`);
      browser = null;
      context = null;
      await sleep(5000);
    }
  }
  console.log("[INTERRUPT] Managed-only ChatGPT guard ON. Watches CONTROL/SYSTEM/DESIGN/APP2/APK owned URLs only.");

  while (true) {
    const pages = context.pages().filter(isManagedChat);
    for (const page of pages) {
      try {
        if (await rateLimitVisible(page)) {
          const key = page.url();
          const now = Date.now();
          if (now - Number(rateLimitReportedAt.get(key) || 0) > 30000) {
            const kind = managedKindFromUrl(key);
            const rl = await reportRateLimit(kind, "ChatGPT UI: too many requests / requests too quickly");
            rateLimitReportedAt.set(key, now);
            const until = rl.blockedUntil || rl.probeLeaseUntil || null;
            console.log(`[INTERRUPT] GLOBAL RATE LIMIT detected by ${kind}; status=${rl.status}; stage=${rl.stage}; until=${until}`);
          }

          const dismissed = await clickRateLimitAcknowledge(page);
          if (dismissed) {
            console.log(`[INTERRUPT] Rate-limit popup acknowledged automatically on ${key}. Cooldown remains active.`);
          }
          continue;
        }

        if (await sendTimeoutVisible(page)) {
          await recoverSendTimeout(page);
          continue;
        } else {
          const key = page.url();
          clearSendTimeoutTracking(key);
        }

        if (await interruptionVisible(page)) {
          await recover(page);
        } else {
          const key = page.url();
          interruptionSince.delete(key);
          interruptionSamples.delete(key);
        }
      } catch (error) {
        console.log(`[INTERRUPT] Recovery scan error: ${error?.message || error}`);
      }
    }
    await sleep(POLL_MS);
  }
}

main().catch((error) => {
  console.error("[INTERRUPT] FATAL", error?.stack || error);
  process.exit(1);
});
