import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CHAT_URL = process.env.DAVID_CHAT_URL || "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71";
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const MAX_TURNS = Number(process.env.DAVID_MAX_TURNS || 30);
const POLL_MS = Number(process.env.DAVID_POLL_MS || 1400);
const COOLDOWN_MS = Number(process.env.DAVID_COOLDOWN_MS || 2200);
const RESPONSE_START_TIMEOUT_MS = Number(process.env.DAVID_RESPONSE_START_TIMEOUT_MS || 20000);
const STALL_TIMEOUT_MS = Number(process.env.DAVID_STALL_TIMEOUT_MS || 120000);
const REFRESH_SETTLE_MS = Number(process.env.DAVID_REFRESH_SETTLE_MS || 5000);
const MAX_RECOVERY_ATTEMPTS = Number(process.env.DAVID_MAX_RECOVERY_ATTEMPTS || 4);
const PLATFORM_BACKOFF_MS = Number(process.env.DAVID_PLATFORM_BACKOFF_MS || 300000);
const STATE_FILE = process.env.DAVID_STATE_FILE || path.join(process.cwd(), ".david-enchev-state.json");
const RESUME_ONCE_FILE = process.env.DAVID_RESUME_ONCE_FILE || path.join(process.cwd(), ".david-resume-once");
const STOP_MARKER = "[[DAVID_STOP]]";
const RELAY_MARKER = "[DAVID_RELAY_ENCHEV_V3]";

const CONTINUE_PROMPT = `@GitHub @Vercel @Supabase

Продължи следващата незавършена зависима задача по Enchev Auctions и MASTER SYSTEM PLAN v1.0 FROZEN.
Провери реалното състояние чрез GitHub, Vercel и Supabase, когато са приложими. Направи реалната промяна, тествай я и маркирай GREEN само с evidence. Не прескачай blocker и не добавяй pricing/payment/finance в tracker.
Работи по една логически завършена задача или свързан блок, след което кажи какво е доказано и коя е следващата задача.
Ако е нужно човешко решение, платен ресурс, secret/API key, MFA/CAPTCHA/login, destructive/необратимо действие, правен sign-off, security exception или липсващ достъп, завърши с точния маркер ${STOP_MARKER}.

${RELAY_MARKER}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hashText = (text) => createHash("sha256").update(String(text || "")).digest("hex");

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      turnsSent: 0,
      relayAttempts: 0,
      recoveryAttempt: 0,
      lastAssistantHash: null,
      stopped: false,
      watchdog: "boot"
    };
  }
}

function saveState(state, action = null) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function consumeResumeOnce() {
  try {
    if (!fs.existsSync(RESUME_ONCE_FILE)) return false;
    fs.unlinkSync(RESUME_ONCE_FILE);
    return true;
  } catch { return false; }
}

function usable(page) { return Boolean(page && !page.isClosed()); }
async function safeUrl(page) { try { return usable(page) ? page.url() : ""; } catch { return ""; } }

async function ensureTargetPage(context, current = null) {
  if (usable(current) && (await safeUrl(current)).startsWith(CHAT_URL)) return current;

  const pages = context.pages().filter((p) => !p.isClosed());
  let page = pages.find((p) => p.url().startsWith(CHAT_URL))
    || pages.find((p) => p.url().includes("chatgpt.com/c/"))
    || pages.find((p) => p.url().includes("chatgpt.com"))
    || await context.newPage();

  const url = await safeUrl(page);
  if (!url.startsWith(CHAT_URL) && !url.includes("/auth/") && !url.includes("/login")) {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  return page;
}

async function getComposer(page) {
  if (!usable(page)) return null;
  for (const selector of [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ]) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return loc;
    } catch {}
  }
  return null;
}

async function latestTurnInfo(page) {
  if (!usable(page)) return { role: null, text: "" };
  try {
    const nodes = page.locator('[data-message-author-role="assistant"], [data-message-author-role="user"]');
    const count = await nodes.count();
    if (!count) return { role: null, text: "" };
    const node = nodes.nth(count - 1);
    return {
      role: await node.getAttribute("data-message-author-role"),
      text: (await node.innerText().catch(() => "")).trim()
    };
  } catch {
    return { role: null, text: "" };
  }
}

async function latestAssistantText(page) {
  if (!usable(page)) return "";
  try {
    const primary = page.locator('[data-message-author-role="assistant"]');
    if (await primary.count()) return (await primary.last().innerText().catch(() => "")).trim();
  } catch {}
  return "";
}

async function latestAssistantTurn(page) {
  if (!usable(page)) return null;
  try {
    const turns = page.locator('article[data-testid^="conversation-turn-"]');
    for (let i = (await turns.count()) - 1; i >= 0; i--) {
      const turn = turns.nth(i);
      if (await turn.locator('[data-message-author-role="assistant"]').count()) return turn;
    }
  } catch {}
  return null;
}

async function isGenerating(page) {
  if (!usable(page)) return false;
  for (const selector of [
    '[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button:has-text("Stop generating")',
    'button:has-text("Спри генерирането")'
  ]) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return true;
    } catch {}
  }
  return false;
}

async function hasFinalActionBar(page) {
  if (!usable(page) || await isGenerating(page)) return false;
  const turn = await latestAssistantTurn(page);
  if (!turn) return false;

  const selectors = [
    'button[aria-label*="Copy"]', 'button[aria-label*="copy"]',
    'button[aria-label*="Good"]', 'button[aria-label*="Bad"]',
    'button[aria-label*="Like"]', 'button[aria-label*="Dislike"]',
    'button[aria-label*="Share"]', 'button[aria-label*="share"]',
    'button[aria-label*="Regenerate"]', 'button[aria-label*="Retry"]',
    'button[title*="Copy"]', 'button[title*="Share"]', 'button[title*="Regenerate"]',
    'button[data-testid*="copy"]', 'button[data-testid*="thumb"]',
    'button[data-testid*="share"]', 'button[data-testid*="regenerate"]'
  ];

  let matched = 0;
  for (const selector of selectors) {
    try {
      const items = turn.locator(selector);
      for (let i = 0; i < await items.count(); i++) {
        if (await items.nth(i).isVisible().catch(() => false)) {
          matched += 1;
          break;
        }
      }
    } catch {}
  }
  if (matched >= 2) return true;

  try {
    const buttons = turn.locator("button");
    let visible = 0;
    for (let i = 0; i < await buttons.count(); i++) {
      const b = buttons.nth(i);
      if (!await b.isVisible().catch(() => false)) continue;
      const label = `${await b.getAttribute("aria-label").catch(() => "") || ""} ${await b.getAttribute("title").catch(() => "") || ""}`.toLowerCase();
      if (label.includes("stop") || label.includes("send")) continue;
      visible += 1;
    }
    return visible >= 4;
  } catch { return false; }
}

async function responseComplete(page) {
  if (!usable(page) || await isGenerating(page)) return false;
  const text = await latestAssistantText(page);
  if (!text) return false;
  if (await hasFinalActionBar(page)) return true;

  const a = text;
  await sleep(1800);
  if (!usable(page) || await isGenerating(page)) return false;
  const b = await latestAssistantText(page);
  return Boolean(b && a === b);
}

async function visiblePlatformBlock(page) {
  if (!usable(page)) return null;

  // Only inspect global UI alerts/toasts. Never scan conversation text, because
  // an assistant answer may legitimately contain phrases like "Vercel rate limit".
  try {
    const result = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll([
        '[role="alert"]',
        '[aria-live="assertive"]',
        '[data-testid*="toast" i]',
        '[data-testid*="error" i]',
        '[data-testid*="banner" i]'
      ].join(',')));

      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };

      for (const el of candidates) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || '').trim().toLowerCase();
        if (!text) continue;
        if (/verify you are human|потвърдете, че сте човек/.test(text)) return 'human verification';
        if (/too many requests|rate limit|твърде много заявки/.test(text)) return 'rate limit';
        if (/you(?:'ve| have) reached your limit|достигнахте лимита/.test(text)) return 'limit';
        if (/network error|нещо се обърка|something went wrong/.test(text)) return 'network error';
      }
      return null;
    });
    if (result) return result;
  } catch {}

  for (const selector of ['iframe[src*="captcha" i]', 'iframe[src*="challenge" i]', '[data-sitekey]']) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return "captcha";
    } catch {}
  }
  return null;
}

async function waitForSession(context, page) {
  while (true) {
    page = await ensureTargetPage(context, page);
    const url = await safeUrl(page);

    if (url.includes("/auth/") || url.includes("/login")) {
      await sleep(POLL_MS);
      continue;
    }
    if (!url.startsWith(CHAT_URL)) {
      await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(POLL_MS);
      continue;
    }
    if (await getComposer(page) || await latestAssistantText(page)) return page;
    await sleep(POLL_MS);
  }
}

async function fillComposer(composer, text) {
  try { await composer.fill(text); return; } catch {}
  await composer.click();
  await composer.evaluate((el, value) => {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.value = value;
    else el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, text);
}

async function sendRelay(page) {
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found.");
  await fillComposer(composer, CONTINUE_PROMPT);
  await sleep(500);

  for (const selector of ['button[data-testid="send-button"]', 'button[aria-label*="Send"]', 'button[aria-label*="Изпрати"]']) {
    try {
      const btn = page.locator(selector).last();
      if (await btn.count() && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
        await btn.click();
        console.log("[DAVID] Relay sent via send button.");
        return;
      }
    } catch {}
  }

  await composer.press("Enter");
  console.log("[DAVID] Relay sent via Enter.");
}

async function refreshChat(context, page, state, attempt) {
  state.watchdog = "refreshing-chat";
  state.recoveryAttempt = attempt;
  saveState(state, `Refreshing ChatGPT recovery ${attempt}`);
  console.log(`[DAVID] Refreshing ChatGPT (recovery ${attempt}/${MAX_RECOVERY_ATTEMPTS}).`);

  page = await waitForSession(context, page);
  if (usable(page)) await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(REFRESH_SETTLE_MS);
  return waitForSession(context, page);
}

async function handlePlatformBlock(context, page, state, blocker) {
  if (blocker === "captcha" || blocker === "human verification") {
    state.stopped = true;
    state.stopReason = `platform blocker: ${blocker}`;
    state.watchdog = "human-blocked";
    saveState(state, `Human action required: ${blocker}`);
    console.log(`[DAVID] Human action required: ${blocker}.`);
    return { stop: true, page };
  }

  const waitMs = blocker === "network error" ? 15000 : PLATFORM_BACKOFF_MS;
  state.watchdog = "platform-backoff";
  state.platformBlocker = blocker;
  state.platformRetryAt = new Date(Date.now() + waitMs).toISOString();
  saveState(state, `Platform ${blocker}; waiting before retry`);
  console.log(`[DAVID] Platform ${blocker}. Waiting ${Math.round(waitMs / 1000)}s before retry.`);
  await sleep(waitMs);
  page = await refreshChat(context, page, state, 0);
  delete state.platformBlocker;
  delete state.platformRetryAt;
  saveState(state, "Platform backoff ended; checking session");
  return { stop: false, page };
}

async function waitForResponseStart(context, page, baselineHash, state) {
  const until = Date.now() + RESPONSE_START_TIMEOUT_MS;
  while (Date.now() < until) {
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) return { started: false, blocker, page };

    if (await isGenerating(page)) {
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT started thinking/generating");
      return { started: true, blocker: null, page };
    }

    const text = await latestAssistantText(page);
    if (text && hashText(text) !== baselineHash) {
      state.watchdog = "gpt-writing";
      saveState(state, "GPT started a new response");
      return { started: true, blocker: null, page };
    }

    await sleep(POLL_MS);
  }
  return { started: false, blocker: null, page };
}

async function sendRelayWithRecovery(context, page, state) {
  const baselineText = await latestAssistantText(page);
  const baselineHash = hashText(baselineText);

  for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      const handled = await handlePlatformBlock(context, page, state, blocker);
      page = handled.page;
      if (handled.stop) return { ok: false, page };
      attempt -= 1;
      continue;
    }

    if (attempt >= 3) page = await refreshChat(context, page, state, attempt);

    state.watchdog = attempt === 1 ? "sending-relay" : "retrying-relay";
    state.recoveryAttempt = attempt - 1;
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    saveState(state, attempt === 1 ? "Sending relay" : `Retrying relay attempt ${attempt}`);
    console.log(`[DAVID] Sending relay attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}.`);

    await sendRelay(page);
    const started = await waitForResponseStart(context, page, baselineHash, state);
    page = started.page;

    if (started.blocker) {
      const handled = await handlePlatformBlock(context, page, state, started.blocker);
      page = handled.page;
      if (handled.stop) return { ok: false, page };
      continue;
    }

    if (started.started) {
      state.turnsSent = Number(state.turnsSent || 0) + 1;
      state.recoveryAttempt = 0;
      state.stopped = false;
      saveState(state, `GPT response started; logical cycle ${state.turnsSent}`);
      console.log(`[DAVID] GPT response started. Logical cycle ${state.turnsSent}/${MAX_TURNS}`);
      return { ok: true, page };
    }

    console.log("[DAVID] GPT did not start. Watchdog will retry.");
  }

  state.stopped = true;
  state.stopReason = "GPT did not start after watchdog recovery attempts";
  state.watchdog = "recovery-exhausted";
  saveState(state, "Recovery exhausted");
  console.log("[DAVID] Recovery exhausted. Stopping to avoid an infinite spam loop.");
  return { ok: false, page };
}

async function waitForCompletedAnswerOrStall(context, page, state) {
  let lastText = await latestAssistantText(page);
  let lastHash = hashText(lastText);
  let lastActivityAt = Date.now();

  while (true) {
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      const handled = await handlePlatformBlock(context, page, state, blocker);
      page = handled.page;
      if (handled.stop) return { status: "stop", page, text: "" };
      lastActivityAt = Date.now();
      continue;
    }

    const text = await latestAssistantText(page);
    const currentHash = hashText(text);
    const generating = await isGenerating(page);

    if (text && currentHash !== lastHash) {
      lastText = text;
      lastHash = currentHash;
      lastActivityAt = Date.now();
      state.watchdog = generating ? "gpt-thinking" : "gpt-writing";
      saveState(state, generating ? "GPT is thinking/generating" : "GPT is writing");
    } else if (generating) {
      lastActivityAt = Date.now();
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT is thinking/generating");
    }

    if (text && text.includes(STOP_MARKER)) {
      return { status: "stop-marker", page, text };
    }

    if (text && await responseComplete(page)) {
      return { status: "complete", page, text };
    }

    const turn = await latestTurnInfo(page);
    if (!generating && Date.now() - lastActivityAt >= STALL_TIMEOUT_MS) {
      state.watchdog = "stalled";
      saveState(state, `GPT stalled with latest role=${turn.role || "none"}`);
      console.log("[DAVID] GPT appears stalled/blank. Starting recovery.");
      return { status: "stalled", page, text: lastText };
    }

    await sleep(POLL_MS);
  }
}

async function main() {
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");

  let page = await waitForSession(context, await ensureTargetPage(context));
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  const state = loadState();
  state.stopped = false;
  state.watchdog = "monitoring";
  saveState(state, "DAVID connected to fixed ChatGPT session");

  console.log(`[DAVID] max cycles: ${MAX_TURNS}. Final-buttons relay mode: ON. Watchdog recovery: ON.`);
  console.log(`[DAVID] start timeout=${RESPONSE_START_TIMEOUT_MS}ms stall timeout=${STALL_TIMEOUT_MS}ms recovery attempts=${MAX_RECOVERY_ATTEMPTS}`);
  console.log("[DAVID] Ctrl+C stops the worker.");

  while (state.turnsSent < MAX_TURNS) {
    page = await waitForSession(context, page);

    const current = await latestAssistantText(page);
    if (current && current.includes(STOP_MARKER)) {
      if (!consumeResumeOnce()) {
        state.stopped = true;
        state.stopReason = current.slice(-1200);
        state.lastAssistantHash = hashText(current);
        state.watchdog = "waiting-human";
        saveState(state, "DAVID_STOP detected; waiting for intentional resume");
        console.log("[DAVID] DAVID_STOP detected. No automatic relay will be sent.");
        return;
      }
      console.log("[DAVID] Intentional resume requested from control panel.");
      state.stopped = false;
      delete state.stopReason;
      state.lastAssistantHash = hashText(current);
      saveState(state, "Intentional resume accepted");
    }

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      const handled = await handlePlatformBlock(context, page, state, blocker);
      page = handled.page;
      if (handled.stop) return;
      continue;
    }

    const assistantText = await latestAssistantText(page);
    const assistantHash = assistantText ? hashText(assistantText) : null;
    const complete = assistantText ? await responseComplete(page) : false;

    if (complete && assistantHash && assistantHash !== state.lastAssistantHash) {
      state.lastAssistantHash = assistantHash;
      state.watchdog = "completed";
      saveState(state, "Completed answer detected; preparing next relay");
      console.log(`[DAVID] Completed answer detected. Relay in ${COOLDOWN_MS} ms...`);
      await sleep(COOLDOWN_MS);

      const sent = await sendRelayWithRecovery(context, page, state);
      page = sent.page;
      if (!sent.ok) return;
    } else {
      const turn = await latestTurnInfo(page);
      if (turn.role === "user" && turn.text.includes(RELAY_MARKER) && !await isGenerating(page)) {
        state.watchdog = "relay-visible-no-response";
        saveState(state, "Relay visible but GPT has not started; watchdog recovery");
        console.log("[DAVID] Relay is visible but GPT did not start. Starting recovery.");
        const sent = await sendRelayWithRecovery(context, page, state);
        page = sent.page;
        if (!sent.ok) return;
      }
    }

    const activeTurn = await latestTurnInfo(page);
    if (activeTurn.role === "assistant" || await isGenerating(page)) {
      const result = await waitForCompletedAnswerOrStall(context, page, state);
      page = result.page;

      if (result.status === "stop-marker") {
        if (!consumeResumeOnce()) {
          state.stopped = true;
          state.stopReason = result.text.slice(-1200);
          state.lastAssistantHash = hashText(result.text);
          state.watchdog = "waiting-human";
          saveState(state, "DAVID_STOP detected; waiting for intentional resume");
          console.log("[DAVID] DAVID_STOP detected. No automatic relay will be sent.");
          return;
        }
        state.lastAssistantHash = hashText(result.text);
        saveState(state, "Intentional resume accepted after DAVID_STOP");
      }

      if (result.status === "stalled") {
        page = await refreshChat(context, page, state, 1);
        const sent = await sendRelayWithRecovery(context, page, state);
        page = sent.page;
        if (!sent.ok) return;
      }

      if (result.status === "complete" && result.text) {
        const h = hashText(result.text);
        if (h !== state.lastAssistantHash) {
          state.lastAssistantHash = h;
          state.watchdog = "completed";
          saveState(state, "Completed answer detected; preparing next relay");
          console.log(`[DAVID] Completed answer detected. Relay in ${COOLDOWN_MS} ms...`);
          await sleep(COOLDOWN_MS);
          const sent = await sendRelayWithRecovery(context, page, state);
          page = sent.page;
          if (!sent.ok) return;
        }
      }
    }

    await sleep(POLL_MS);
  }

  state.watchdog = "cycle-limit";
  saveState(state, `Reached cycle limit ${MAX_TURNS}`);
  console.log(`[DAVID] Reached cycle limit ${MAX_TURNS}.`);
}

main().catch((error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
