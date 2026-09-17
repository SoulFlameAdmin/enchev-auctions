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
const RESPONSE_START_TIMEOUT_MS = Number(process.env.DAVID_RESPONSE_START_TIMEOUT_MS || 18000);
const STALL_TIMEOUT_MS = Number(process.env.DAVID_STALL_TIMEOUT_MS || 45000);
const REFRESH_SETTLE_MS = Number(process.env.DAVID_REFRESH_SETTLE_MS || 5000);
const MAX_RECOVERY_ATTEMPTS = Number(process.env.DAVID_MAX_RECOVERY_ATTEMPTS || 6);
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
const hashText = (text) => createHash("sha256").update(text || "").digest("hex");

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      turnsSent: 0,
      relayAttempts: 0,
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
    const role = await node.getAttribute("data-message-author-role");
    const text = (await node.innerText().catch(() => "")).trim();
    return { role, text };
  } catch {
    return { role: null, text: "" };
  }
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

async function latestAssistantText(page) {
  if (!usable(page)) return "";
  try {
    const primary = page.locator('[data-message-author-role="assistant"]');
    if (await primary.count()) return (await primary.last().innerText().catch(() => "")).trim();
  } catch {}
  return "";
}

function isRelayText(text) {
  const t = String(text || "");
  return t.includes(RELAY_MARKER)
    || (t.includes("@GitHub") && t.includes("@Vercel") && t.includes("Продължи следващата незавършена"));
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

  let matched = 0;
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

  for (const selector of selectors) {
    try {
      const items = turn.locator(selector);
      for (let i = 0; i < await items.count(); i++) {
        if (await items.nth(i).isVisible().catch(() => false)) { matched++; break; }
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
      visible++;
    }
    return visible >= 4;
  } catch { return false; }
}

async function responseComplete(page) {
  if (!usable(page) || await isGenerating(page)) return false;
  const text = await latestAssistantText(page);
  if (!text) return false;

  if (await hasFinalActionBar(page)) {
    console.log("[DAVID] Final action buttons detected -> response complete.");
    return true;
  }

  const a = text;
  await sleep(1700);
  if (!usable(page) || await isGenerating(page)) return false;
  const b = await latestAssistantText(page);
  return a === b && b.length > 0;
}

async function visiblePlatformBlock(page) {
  if (!usable(page)) return null;
  const checks = [
    ["limit", /you(?:'ve| have) reached your limit|достигнахте лимита/i],
    ["rate limit", /too many requests|rate limit|твърде много заявки/i],
    ["network error", /network error|нещо се обърка/i],
    ["human verification", /verify you are human|потвърдете, че сте човек/i]
  ];

  for (const [name, regex] of checks) {
    try {
      const loc = page.getByText(regex).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return name;
    } catch {}
  }

  for (const selector of ['iframe[src*="captcha" i]', 'iframe[src*="challenge" i]', '[data-sitekey]']) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return "captcha";
    } catch {}
  }
  return null;
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
  await sleep(450);

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

async function waitForSession(context, page) {
  while (true) {
    page = await ensureTargetPage(context, page);
    const url = await safeUrl(page);
    if (url.includes("/auth/") || url.includes("/login")) {
      console.log("[DAVID] Waiting for ChatGPT login...");
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

async function waitForResponseStart(context, page, baselineHash, timeoutMs, state) {
  const until = Date.now() + timeoutMs;
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

async function refreshChat(context, page, state, attempt) {
  state.watchdog = "refreshing-chat";
  state.recoveryAttempt = attempt;
  saveState(state, `No GPT response -> refreshing ChatGPT (recovery ${attempt})`);
  console.log(`[DAVID] No response after retry -> refreshing ChatGPT (recovery ${attempt}).`);

  page = await waitForSession(context, page);
  if (usable(page)) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  await sleep(REFRESH_SETTLE_MS);
  return waitForSession(context, page);
}

async function relayWithRecovery(context, page, baselineHash, state, alreadySent = false) {
  let attempt = 0;
  const refreshFromAttempt = alreadySent ? 2 : 3;

  while (attempt < MAX_RECOVERY_ATTEMPTS) {
    attempt += 1;
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      state.stopped = true;
      state.stopReason = `platform blocker: ${blocker}`;
      state.watchdog = "blocked";
      saveState(state, `Stopped: ${blocker}`);
      console.log(`[DAVID] Stop: visible platform blocker detected: ${blocker}`);
      return { ok: false, page };
    }

    if (attempt >= refreshFromAttempt) {
      page = await refreshChat(context, page, state, attempt);
    }

    state.watchdog = attempt === 1 && !alreadySent ? "sending-relay" : "recovering-relay";
    state.recoveryAttempt = attempt;
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    if (!state.pendingSince) state.pendingSince = new Date().toISOString();
    saveState(state, attempt === 1 && !alreadySent
      ? "Sending relay to GPT"
      : `GPT did not start -> relay retry ${attempt}/${MAX_RECOVERY_ATTEMPTS}`);

    console.log(`[DAVID] Sending relay attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}${alreadySent ? " (watchdog recovery)" : ""}.`);
    await sendRelay(page);

    const result = await waitForResponseStart(context, page, baselineHash, RESPONSE_START_TIMEOUT_MS, state);
    page = result.page;

    if (result.blocker) {
      state.stopped = true;
      state.stopReason = `platform blocker: ${result.blocker}`;
      state.watchdog = "blocked";
      saveState(state, `Stopped: ${result.blocker}`);
      return { ok: false, page };
    }

    if (result.started) {
      state.turnsSent = Number(state.turnsSent || 0) + 1;
      state.stopped = false;
      state.watchdog = "response-started";
      state.recoveryAttempt = 0;
      delete state.stopReason;
      saveState(state, `GPT response started · cycle ${state.turnsSent}`);
      console.log(`[DAVID] GPT response started. Logical cycle ${state.turnsSent}/${MAX_TURNS}`);
      return { ok: true, page };
    }

    console.log(`[DAVID] GPT did not start within ${RESPONSE_START_TIMEOUT_MS} ms.`);
    alreadySent = true;
  }

  state.stopped = true;
  state.watchdog = "recovery-exhausted";
  state.stopReason = `GPT did not start after ${MAX_RECOVERY_ATTEMPTS} recovery attempts`;
  saveState(state, state.stopReason);
  console.log(`[DAVID] Stop: ${state.stopReason}`);
  return { ok: false, page };
}

async function main() {
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");

  let page = await waitForSession(context, await ensureTargetPage(context));
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  let state = loadState();
  state.stopped = false;
  state.watchdog = "monitoring";
  delete state.stopReason;
  saveState(state, "DAVID worker connected to the real ChatGPT session");

  console.log(`[DAVID] max cycles: ${MAX_TURNS}. Final-buttons relay mode: ON. Watchdog recovery: ON.`);
  console.log(`[DAVID] start timeout=${RESPONSE_START_TIMEOUT_MS}ms stall timeout=${STALL_TIMEOUT_MS}ms recovery attempts=${MAX_RECOVERY_ATTEMPTS}`);
  console.log("[DAVID] Ctrl+C stops the worker.");

  while (Number(state.turnsSent || 0) < MAX_TURNS) {
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      state.stopped = true;
      state.stopReason = `platform blocker: ${blocker}`;
      state.watchdog = "blocked";
      saveState(state, `Stopped: ${blocker}`);
      console.log(`[DAVID] Stop: visible platform blocker detected: ${blocker}`);
      return;
    }

    if (await isGenerating(page)) {
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT is thinking/generating");
      await sleep(POLL_MS);
      continue;
    }

    const turn = await latestTurnInfo(page);
    const assistantText = await latestAssistantText(page);
    const assistantHash = assistantText ? hashText(assistantText) : (state.lastAssistantHash || "");

    if (turn.role === "user" && isRelayText(turn.text)) {
      const pendingSince = state.pendingSince ? Date.parse(state.pendingSince) : Date.now();
      if (!state.pendingSince) {
        state.pendingSince = new Date(pendingSince).toISOString();
        state.watchdog = "waiting-for-gpt";
        saveState(state, "Relay is in chat; waiting for GPT to start");
      }

      const age = Date.now() - pendingSince;
      if (age < STALL_TIMEOUT_MS) {
        state.watchdog = "waiting-for-gpt";
        saveState(state, `Waiting for GPT response · ${Math.round(age / 1000)}s`);
        await sleep(POLL_MS);
        continue;
      }

      console.log("[DAVID] Watchdog: relay is visible but GPT did not produce thinking/text. Starting recovery.");
      const recovered = await relayWithRecovery(context, page, state.lastAssistantHash || assistantHash, state, true);
      page = recovered.page;
      if (!recovered.ok) return;
      state = loadState();
      await sleep(POLL_MS);
      continue;
    }

    if (turn.role === "assistant") {
      if (!assistantText) {
        const pendingSince = state.pendingSince ? Date.parse(state.pendingSince) : Date.now();
        if (Date.now() - pendingSince >= STALL_TIMEOUT_MS) {
          console.log("[DAVID] Watchdog: assistant turn is blank/stalled. Recovering relay.");
          const recovered = await relayWithRecovery(context, page, state.lastAssistantHash || "", state, true);
          page = recovered.page;
          if (!recovered.ok) return;
          state = loadState();
        } else {
          state.watchdog = "blank-response-wait";
          saveState(state, "GPT response is blank; waiting before recovery");
          await sleep(POLL_MS);
        }
        continue;
      }

      if (!await responseComplete(page)) {
        state.watchdog = "waiting-for-complete-answer";
        saveState(state, "GPT response exists; waiting for final action buttons / completion");
        await sleep(POLL_MS);
        continue;
      }

      const answerHash = hashText(assistantText);
      if (assistantText.includes(STOP_MARKER) && !consumeResumeOnce()) {
        state.stopped = true;
        state.stopReason = assistantText.slice(-1200);
        state.lastAssistantHash = answerHash;
        state.watchdog = "human-action";
        delete state.pendingSince;
        saveState(state, "Waiting for human action");
        console.log("[DAVID] DAVID_STOP detected. Waiting for intentional resume.");
        return;
      }

      state.lastAssistantHash = answerHash;
      state.stopped = false;
      state.watchdog = "answer-complete";
      state.recoveryAttempt = 0;
      delete state.stopReason;
      delete state.pendingSince;
      saveState(state, "Completed GPT answer detected; preparing next stage relay");

      console.log(`[DAVID] Completed answer detected. Relay in ${COOLDOWN_MS} ms...`);
      await sleep(COOLDOWN_MS);
      page = await waitForSession(context, page);

      const relayed = await relayWithRecovery(context, page, answerHash, state, false);
      page = relayed.page;
      if (!relayed.ok) return;
      state = loadState();
      await sleep(POLL_MS);
      continue;
    }

    // Unknown/empty UI state: wait briefly, then force a clean refresh rather than hanging forever.
    const unknownSince = state.unknownSince ? Date.parse(state.unknownSince) : Date.now();
    if (!state.unknownSince) {
      state.unknownSince = new Date(unknownSince).toISOString();
      state.watchdog = "unknown-ui";
      saveState(state, "ChatGPT UI state is empty/unknown; watching before refresh");
    }

    if (Date.now() - unknownSince >= STALL_TIMEOUT_MS) {
      page = await refreshChat(context, page, state, 1);
      delete state.unknownSince;
      saveState(state, "ChatGPT UI refreshed after empty/unknown state");
    } else {
      await sleep(POLL_MS);
    }
  }
}

main().catch((error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
