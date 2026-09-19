import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { reportRateLimit } from "./chatgpt-rate-limit-coordinator.mjs";
import { classifyPlatformText, chooseRecoveryAction, SESSION_ISSUE, SESSION_ACTION } from "./chatgpt-session-resilience.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));

const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const POLL_MS = Number(process.env.DAVID_INTERRUPT_POLL_MS || 400);
const RETRY_COOLDOWN_MS = Number(process.env.DAVID_INTERRUPT_RETRY_COOLDOWN_MS || 5000);
const CONFIRM_MS = Number(process.env.DAVID_INTERRUPT_CONFIRM_MS || 5000);
const CONFIRM_SAMPLES = Number(process.env.DAVID_INTERRUPT_CONFIRM_SAMPLES || 4);
const SEND_TIMEOUT_COOLDOWN_MS = Number(process.env.DAVID_SEND_TIMEOUT_COOLDOWN_MS || 3000);
const SEND_TIMEOUT_MAX_RETRIES = Number(process.env.DAVID_SEND_TIMEOUT_MAX_RETRIES || 2);
const SEND_TIMEOUT_STALE_ACTIVE_MS = Number(process.env.DAVID_SEND_TIMEOUT_STALE_ACTIVE_MS || 8000);
const SEND_TIMEOUT_RELOAD_SETTLE_MS = Number(process.env.DAVID_SEND_TIMEOUT_RELOAD_SETTLE_MS || 2500);
const RECOVERY_REQUEST_FILE = path.join(HERE, ".david-recovery-request.json");
const SESSION_HEALTH_FILE = path.join(HERE, ".david-session-health.json");
const GENERIC_CONFIRM_MS = Number(process.env.DAVID_GENERIC_ERROR_CONFIRM_MS || 6000);
const GENERIC_CONFIRM_SAMPLES = Number(process.env.DAVID_GENERIC_ERROR_CONFIRM_SAMPLES || 4);
const GENERIC_RETRY_COOLDOWN_MS = Number(process.env.DAVID_GENERIC_RETRY_COOLDOWN_MS || 15000);
const GENERIC_MAX_RETRIES = Number(process.env.DAVID_GENERIC_MAX_RETRIES || 2);
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
const genericIssueSince = new Map();
const genericIssueSamples = new Map();
const genericRetryAttempts = new Map();
const genericRecoveredAt = new Map();
const sessionHealth = { checkedAt: null, workers: {} };

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

async function requestWorkerRecovery(page, reason, evidence = {}) {
  const url = page.url();
  const target = await managedKindFromPage(page);
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
    [path.join(HERE, ".david-enchev-state.json"), "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71"],
    [path.join(HERE, ".david-enchev-design-state.json"), "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7"],
    [path.join(HERE, ".david-app2-state-6aac2dbb.json"), "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4"],
    [path.join(HERE, ".david-apk-state.json"), null],
    [path.join(HERE, ".david-control-state.json"), "https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e"]
  ];
  const urls = new Set();
  for (const [file, fallback] of defs) {
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
  try { return !page.isClosed() && /^https:\/\/chatgpt\.com(?:\/|$)/i.test(page.url()); }
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
  ];
  for (const [kind, file, fallback] of defs) {
    const st = readState(file);
    const current = cleanConversationUrl(st.chatUrl) || cleanConversationUrl(fallback);
    if (current === u) return kind;
  }
  return "GLOBAL";
}

async function managedKindFromPage(page) {
  if (!isChat(page)) return null;
  const tagMap = {
    DAVID_SYSTEM_MANAGED_V1: "SYSTEM",
    DAVID_SYSTEM_PENDING_V1: "SYSTEM",
    DAVID_DESIGN_MANAGED_V1: "DESIGN",
    DAVID_DESIGN_PENDING_V1: "DESIGN",
    DAVID_APP2_MANAGED_V1: "APP2",
    DAVID_APP2_PENDING_V1: "APP2",
    DAVID_APK_MANAGED_V1: "APK",
    DAVID_APK_PENDING_V1: "APK",
    DAVID_CONTROL_MANAGED_V1: "CONTROL",
    DAVID_CONTROL_PENDING_V1: "CONTROL"
  };
  try {
    const tag = await page.evaluate(() => window.name || "");
    if (tagMap[tag]) return tagMap[tag];
  } catch {}
  const byUrl = managedKindFromUrl(page.url());
  return byUrl === "GLOBAL" ? null : byUrl;
}

function flushSessionHealth() {
  sessionHealth.checkedAt = new Date().toISOString();
  try {
    writeJsonAtomic(SESSION_HEALTH_FILE, sessionHealth);
  } catch {}
}

function recordSessionHealth(kind, page, {
  state = "ready",
  issue = SESSION_ISSUE.NONE,
  action = SESSION_ACTION.WAIT,
  detail = null
} = {}) {
  if (!kind) return;
  sessionHealth.workers[kind] = {
    checkedAt: new Date().toISOString(),
    url: cleanConversationUrl(page?.url?.()) || page?.url?.() || null,
    state,
    issue,
    action,
    detail
  };
  flushSessionHealth();
}

async function rateLimitVisible(page) {
  if (!isChat(page)) return false;
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
  if (!isChat(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const re = /(изпращането на съобщението изтече по време|message sending timed out|sending the message timed out|message send timed out|sending timed out|съобщението не можа да бъде изпратено навреме)/i;
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
        if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
          await b.click({ timeout: 4000 });
          return true;
        }
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

  if (await activeAssistantWork(page)) {
    if (noProgressMs < SEND_TIMEOUT_STALE_ACTIVE_MS) {
      console.log(`[INTERRUPT] SEND TIMEOUT + active GPT: WAIT ${noProgressMs}ms/${SEND_TIMEOUT_STALE_ACTIVE_MS}ms while real progress remains plausible.`);
      return;
    }
    console.log(`[INTERRUPT] SEND TIMEOUT + stale active indicator: no assistant progress for ${noProgressMs}ms. RETRY now takes precedence.`);
  }

  const attempt = Number(sendTimeoutAttempts.get(url) || 0) + 1;
  if (attempt <= SEND_TIMEOUT_MAX_RETRIES) {
    sendTimeoutAttempts.set(url, attempt);
    sendTimeoutRecoveredAt.set(url, now);
    console.log(`[INTERRUPT] FAST RECOVERY step=RETRY attempt=${attempt}/${SEND_TIMEOUT_MAX_RETRIES} url=${url}`);

    const clicked = await clickSendTimeoutRetry(page);
    if (clicked) {
      await sleep(1500);
      if (await activeAssistantWork(page)) {
        clearSendTimeoutTracking(url);
        console.log("[INTERRUPT] RETRY accepted; GPT became active.");
        return;
      }
      if (!await sendTimeoutVisible(page)) {
        clearSendTimeoutTracking(url);
        console.log("[INTERRUPT] RETRY cleared send-timeout UI.");
        return;
      }
    }

    if (attempt < SEND_TIMEOUT_MAX_RETRIES) {
      console.log("[INTERRUPT] RETRY did not clear timeout; short backoff then one more Retry.");
      return;
    }
  }

  if (!sendTimeoutReloaded.get(url)) {
    sendTimeoutReloaded.set(url, true);
    sendTimeoutRecoveredAt.set(url, now);
    const beforeHash = await assistantTextHash(page);
    console.log(`[INTERRUPT] FAST RECOVERY step=RELOAD url=${url}`);
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
  const progressAfterReload = Boolean(finalHash && lastHash && finalHash !== lastHash);
  if (progressAfterReload) {
    clearSendTimeoutTracking(url);
    console.log("[INTERRUPT] Assistant text progressed after recovery ladder; WAIT.");
    return;
  }

  await requestWorkerRecovery(page, "send-timeout survived Retry x2 + Reload", {
    noProgressMs,
    retries: SEND_TIMEOUT_MAX_RETRIES,
    reloaded: true,
    assistantHash: finalHash || null
  });
  sendTimeoutRecoveredAt.set(url, now);
}

async function visibleGenericIssue(page) {
  if (!isChat(page)) return { issue: SESSION_ISSUE.NONE, text: "" };
  try {
    const texts = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const out = [];
      const selectors = [
        '[role="dialog"]',
        '[role="alert"]',
        '[aria-live="assertive"]',
        '[aria-live="polite"]',
        '[data-testid*="error" i]',
        '[data-testid*="toast" i]',
        '[data-testid*="banner" i]',
        'button'
      ];
      for (const el of document.querySelectorAll(selectors.join(","))) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
        if (text && text.length <= 700) out.push(text);
        if (out.length >= 80) break;
      }
      return Array.from(new Set(out));
    });
    for (const text of texts) {
      const hit = classifyPlatformText(text);
      if (hit.issue !== SESSION_ISSUE.NONE) return hit;
    }
  } catch {}

  for (const selector of ['iframe[src*="captcha" i]', 'iframe[src*="challenge" i]', '[data-sitekey]']) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) {
        return { issue: SESSION_ISSUE.HUMAN_REQUIRED, text: "challenge/captcha UI" };
      }
    } catch {}
  }

  try {
    const url = String(page.url() || "");
    if (/\/auth\/|\/login(?:[/?#]|$)|\/signin(?:[/?#]|$)/i.test(url)) {
      return { issue: SESSION_ISSUE.AUTH_REQUIRED, text: "authentication route" };
    }
  } catch {}
  return { issue: SESSION_ISSUE.NONE, text: "" };
}

async function retryButtonVisible(page) {
  const labels = [/^Опитайте отново$/i, /^Try again$/i, /^Retry$/i, /^Regenerate$/i, /^Генерирай отново$/i];
  for (const label of labels) {
    try {
      const buttons = page.getByRole("button", { name: label });
      for (let i = (await buttons.count()) - 1; i >= 0; i--) {
        const b = buttons.nth(i);
        if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) return true;
      }
    } catch {}
  }
  return false;
}

async function clickGenericRetry(page) {
  const labels = [/^Опитайте отново$/i, /^Try again$/i, /^Retry$/i, /^Regenerate$/i, /^Генерирай отново$/i];
  for (const label of labels) {
    try {
      const buttons = page.getByRole("button", { name: label });
      for (let i = (await buttons.count()) - 1; i >= 0; i--) {
        const b = buttons.nth(i);
        if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
          await b.click({ timeout: 4000 });
          return true;
        }
      }
    } catch {}
  }
  return false;
}

function clearGenericIssueTracking(url) {
  for (const key of Array.from(genericIssueSince.keys())) {
    if (!key.startsWith(url + "|")) continue;
    genericIssueSince.delete(key);
    genericIssueSamples.delete(key);
    genericRetryAttempts.delete(key);
  }
}

async function recoverGenericIssue(page, kind, hit) {
  const url = page.url();
  const key = url + "|" + hit.issue;
  const now = Date.now();

  if (await activeAssistantWork(page)) {
    genericIssueSince.delete(key);
    genericIssueSamples.delete(key);
    recordSessionHealth(kind, page, { state: "active", issue: hit.issue, action: SESSION_ACTION.WAIT, detail: "active GPT/tool work protected" });
    console.log(`[INTERRUPT] ${kind} issue=${hit.issue}, but GPT is active. WAIT; no click/refresh.`);
    return;
  }

  const firstSeen = Number(genericIssueSince.get(key) || now);
  if (!genericIssueSince.has(key)) genericIssueSince.set(key, now);
  const samples = Number(genericIssueSamples.get(key) || 0) + 1;
  genericIssueSamples.set(key, samples);
  const confirmed = now - firstSeen >= GENERIC_CONFIRM_MS && samples >= GENERIC_CONFIRM_SAMPLES;
  const retryVisible = await retryButtonVisible(page);
  const retryAttempt = Number(genericRetryAttempts.get(key) || 0);
  const action = chooseRecoveryAction({
    issue: hit.issue,
    active: false,
    progressed: false,
    retryVisible,
    retryAttempt,
    maxRetryAttempts: GENERIC_MAX_RETRIES,
    confirmed
  });

  recordSessionHealth(kind, page, {
    state: confirmed ? "platform-problem-confirmed" : "platform-problem-observed",
    issue: hit.issue,
    action,
    detail: hit.text
  });

  if (!confirmed) return;

  if (action === SESSION_ACTION.HUMAN_REQUIRED) {
    console.log(`[INTERRUPT] ${kind} HUMAN GATE issue=${hit.issue}. No bypass; waiting for user authentication/verification.`);
    return;
  }

  if (action === SESSION_ACTION.ROTATE_CHAT) {
    console.log(`[INTERRUPT] ${kind} issue=${hit.issue}. Worker owns safe same-tab fresh-chat rotation; guard will not click blindly.`);
    return;
  }

  if (action === SESSION_ACTION.RATE_LIMIT_COORDINATOR) return;

  if (now - Number(genericRecoveredAt.get(key) || 0) < GENERIC_RETRY_COOLDOWN_MS) return;

  if (action === SESSION_ACTION.CLICK_RETRY) {
    const attempt = retryAttempt + 1;
    genericRetryAttempts.set(key, attempt);
    genericRecoveredAt.set(key, now);
    const clicked = await clickGenericRetry(page);
    console.log(`[INTERRUPT] ${kind} issue=${hit.issue} Retry attempt ${attempt}/${GENERIC_MAX_RETRIES} clicked=${clicked}.`);
    if (clicked) {
      await sleep(1500);
      if (await activeAssistantWork(page)) {
        clearGenericIssueTracking(url);
        recordSessionHealth(kind, page, { state: "active", issue: SESSION_ISSUE.NONE, action: SESSION_ACTION.WAIT, detail: "retry accepted; GPT resumed" });
      }
    }
    return;
  }

  if (action === SESSION_ACTION.REFRESH_VERIFY || action === SESSION_ACTION.WAIT_BACKOFF) {
    genericRecoveredAt.set(key, now);
    if (action === SESSION_ACTION.WAIT_BACKOFF) await sleep(3000);
    if (await activeAssistantWork(page)) return;
    console.log(`[INTERRUPT] ${kind} issue=${hit.issue}. Safe view refresh; worker retains task ownership and duplicate-send protection.`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(1500);
  }
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
  console.log("[INTERRUPT] DAVID Session Resilience V1 ON. Watches tagged/owned CONTROL/SYSTEM/DESIGN/APP2/APK chats, including fresh-rollover URLs.");

  while (true) {
    const pages = context.pages().filter(isChat);
    for (const page of pages) {
      const kind = await managedKindFromPage(page);
      if (!kind) continue;
      try {
        if (await rateLimitVisible(page)) {
          const key = page.url();
          const now = Date.now();
          recordSessionHealth(kind, page, { state: "rate-limited", issue: SESSION_ISSUE.RATE_LIMIT, action: SESSION_ACTION.RATE_LIMIT_COORDINATOR });
          if (now - Number(rateLimitReportedAt.get(key) || 0) > 30000) {
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
          recordSessionHealth(kind, page, { state: "send-timeout", issue: SESSION_ISSUE.SEND_TIMEOUT, action: SESSION_ACTION.CLICK_RETRY });
          await recoverSendTimeout(page);
          continue;
        } else {
          clearSendTimeoutTracking(page.url());
        }

        if (await interruptionVisible(page)) {
          recordSessionHealth(kind, page, { state: "interrupted", issue: SESSION_ISSUE.INTERRUPTION, action: SESSION_ACTION.REFRESH_VERIFY });
          await recover(page);
          continue;
        } else {
          const key = page.url();
          interruptionSince.delete(key);
          interruptionSamples.delete(key);
        }

        const hit = await visibleGenericIssue(page);
        if (hit.issue !== SESSION_ISSUE.NONE) {
          await recoverGenericIssue(page, kind, hit);
          continue;
        }

        clearGenericIssueTracking(page.url());
        recordSessionHealth(kind, page, {
          state: await activeAssistantWork(page) ? "active" : "ready",
          issue: SESSION_ISSUE.NONE,
          action: SESSION_ACTION.WAIT
        });
      } catch (error) {
        recordSessionHealth(kind, page, { state: "guard-error", issue: SESSION_ISSUE.NONE, action: SESSION_ACTION.WAIT, detail: error?.message || String(error) });
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
