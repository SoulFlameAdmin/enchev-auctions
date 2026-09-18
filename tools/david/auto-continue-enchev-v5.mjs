import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const INITIAL_CHAT_URL = process.env.DAVID_CHAT_URL || "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71";
let activeChatUrl = INITIAL_CHAT_URL;
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const MAX_TURNS = Number(process.env.DAVID_MAX_TURNS || 2147483647);
const POLL_MS = Number(process.env.DAVID_POLL_MS || 800);
const COOLDOWN_MS = Number(process.env.DAVID_COOLDOWN_MS || 1000);
const RESPONSE_START_TIMEOUT_MS = Number(process.env.DAVID_RESPONSE_START_TIMEOUT_MS || 12000);
const STALL_TIMEOUT_MS = Number(process.env.DAVID_STALL_TIMEOUT_MS || 60000);
const REFRESH_SETTLE_MS = Number(process.env.DAVID_REFRESH_SETTLE_MS || 3000);
const MAX_RECOVERY_ATTEMPTS = Number(process.env.DAVID_MAX_RECOVERY_ATTEMPTS || 4);
const PROBLEM_BACKOFF_MS = Number(process.env.DAVID_PROBLEM_BACKOFF_MS || 30000);
const PLATFORM_BACKOFF_MS = Number(process.env.DAVID_PLATFORM_BACKOFF_MS || 180000);
const STATE_FILE = process.env.DAVID_STATE_FILE || path.join(process.cwd(), ".david-enchev-state.json");
const RELAY_MARKER = "[DAVID_RELAY_ENCHEV_V5]";
const PROBLEM_PREFIX = "PROBLEM IN:";

const CONTINUE_PROMPT = `@GitHub @Vercel @Supabase

Продължи СЕГА следващата незавършена зависима задача по Enchev Auctions и MASTER SYSTEM PLAN v1.0 FROZEN.
Работи директно с GitHub, Vercel и Supabase, когато са приложими. Направи реалната промяна, тествай я и маркирай GREEN само с evidence. Не прескачай dependencies и не добавяй pricing/payment/finance в tracker.
Работи по една логически завършена задача или свързан блок. Не спирай само защото първият подход не работи — опитай безопасна алтернатива, поправи грешката и продължи.

ВАЖЕН ПРОТОКОЛ ЗА DAVID:
- Никога не пиши DAVID_STOP.
- Ако задачата е успешно завършена и доказана, завърши последния ред само с: OK
- Ако има нерешен проблем/blocker, завърши с: ${PROBLEM_PREFIX} <кратко и точно какво пречи>
- Преди PROBLEM IN опитай сам разумните безопасни варианти.
- Не заобикаляй CAPTCHA/MFA/login/permissions, не измисляй secrets и не прави destructive действие без разрешение. Ако такова е неизбежно, опиши го като PROBLEM IN, но не спирай останалата безопасна работа, която може да се свърши.

${RELAY_MARKER}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hashText = (text) => createHash("sha256").update(String(text || "")).digest("hex");
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[^/?#]+/i);
  return m ? m[0] : null;
}
function matchesActiveChat(url) {
  const u = String(url || "");
  if (activeChatUrl === "https://chatgpt.com/") return u === "https://chatgpt.com/" || u === "https://chatgpt.com";
  return u.startsWith(activeChatUrl);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      turnsSent: 0,
      relayAttempts: 0,
      recoveryAttempt: 0,
      problemAttempts: 0,
      problem: null,
      lastAssistantHash: null,
      stopped: false,
      watchdog: "boot"
    };
  }
}

function saveState(state, action = null) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  state.stopped = false;
  delete state.stopReason;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function usable(page) { return Boolean(page && !page.isClosed()); }
async function safeUrl(page) { try { return usable(page) ? page.url() : ""; } catch { return ""; } }

async function ensureTargetPage(context, current = null) {
  if (usable(current) && (await safeUrl(current)).startsWith("https://chatgpt.com/")) return current;
  const pages = context.pages().filter((p) => !p.isClosed());
  let page = pages.find((p) => matchesActiveChat(p.url()))
    || pages.find((p) => p.url().startsWith(INITIAL_CHAT_URL))
    || await context.newPage();
  const url = await safeUrl(page);
  if (!matchesActiveChat(url) && !url.includes("/auth/") && !url.includes("/login")) {
    await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  return page;
}

async function conversationLimitReached(page) {
  if (!usable(page)) return false;
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
      };
      const re = /(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i;
      for (const el of document.querySelectorAll("div,section,p,span")) {
        if (!visible(el)) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && t.length < 500 && re.test(t)) return true;
      }
      return false;
    });
  } catch { return false; }
}

function syncActiveChatUrl(page, state) {
  const u = cleanConversationUrl(page?.url?.());
  if (!u || u === activeChatUrl) return;
  activeChatUrl = u;
  state.chatUrl = u;
  state.pendingNewChat = false;
  state.lastConversationUrl = u;
  saveState(state, `Conversation URL synced: ${u}`);
  console.log(`[DAVID] Active conversation: ${u}`);
}

async function closeOldConversationTabs(context, oldUrl, keepPage) {
  const oldConversationUrl = cleanConversationUrl(oldUrl);
  if (!oldConversationUrl) return 0;
  let closed = 0;
  for (const candidate of context.pages()) {
    if (!candidate || candidate === keepPage || candidate.isClosed()) continue;
    try {
      if (cleanConversationUrl(candidate.url()) !== oldConversationUrl) continue;
      await candidate.close({ runBeforeUnload: false }).catch(() => {});
      closed += 1;
    } catch {}
  }
  if (closed) console.log(`[DAVID] Closed ${closed} stale old conversation tab(s): ${oldConversationUrl}`);
  return closed;
}

async function rolloverConversation(context, page, state) {
  const oldUrl = cleanConversationUrl(await safeUrl(page)) || await safeUrl(page) || activeChatUrl;
  state.previousChatUrl = oldUrl;
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = "conversation-rollover";
  activeChatUrl = "https://chatgpt.com/";
  state.chatUrl = activeChatUrl;
  saveState(state, `Conversation max length -> rollover #${state.rolloverCount}`);
  console.log(`[DAVID] Conversation reached max length. Opening NEW CHAT in SAME tab (#${state.rolloverCount})...`);
  if (!usable(page)) page = await ensureTargetPage(context, null);
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await closeOldConversationTabs(context, oldUrl, page);
  await sleep(1200);
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
  } catch { return { role: null, text: "" }; }
}

async function latestAssistantText(page) {
  if (!usable(page)) return "";
  try {
    const nodes = page.locator('[data-message-author-role="assistant"]');
    if (!await nodes.count()) return "";
    return (await nodes.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
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
        if (await items.nth(i).isVisible().catch(() => false)) { matched += 1; break; }
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
  const turn = await latestTurnInfo(page);
  if (turn.role !== "assistant") return false;
  const text = await latestAssistantText(page);
  if (!text) return false;
  if (await hasFinalActionBar(page)) return true;
  const before = text;
  await sleep(1200);
  if (!usable(page) || await isGenerating(page)) return false;
  const afterTurn = await latestTurnInfo(page);
  if (afterTurn.role !== "assistant") return false;
  const after = await latestAssistantText(page);
  return Boolean(after && after === before);
}

function extractProblem(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const idx = rows[i].toUpperCase().indexOf(PROBLEM_PREFIX);
    if (idx >= 0) return rows[i].slice(idx + PROBLEM_PREFIX.length).trim() || "Нерешен проблем";
  }
  return null;
}

function endsOk(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return rows.length > 0 && /^OK[.!]?$/i.test(rows.at(-1));
}

function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nDAVID засече проблем в текущия етап:\n${problem}\n\nTRY TO MAKE THIS FIX YOURSELF NOW. Това е опит ${attempt}. Провери реалното състояние и опитай безопасен технически fix или валиден алтернативен подход. Не измисляй evidence, secrets или резултати. Не заобикаляй CAPTCHA/MFA/login/permissions и не прави destructive действие без разрешение.\n\nАко го оправиш и го докажеш, завърши последния ред само с: OK\nАко още не е решено, завърши с: ${PROBLEM_PREFIX} <точният оставащ проблем>\nСлед успешен fix продължи към следващата зависима задача от MASTER SYSTEM PLAN.\n\n${RELAY_MARKER}`;
}

async function visiblePlatformBlock(page) {
  if (!usable(page)) return null;
  try {
    const result = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="toast" i],[data-testid*="error" i],[data-testid*="banner" i]'));
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      for (const el of candidates) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || '').trim().toLowerCase();
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

async function waitForSession(context, page, state) {
  while (true) {
    page = await ensureTargetPage(context, page);
    const url = await safeUrl(page);
    if (url.includes("/auth/") || url.includes("/login")) {
      await sleep(POLL_MS);
      continue;
    }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      continue;
    }
    syncActiveChatUrl(page, state);
    if (!matchesActiveChat(url) && activeChatUrl !== "https://chatgpt.com/") {
      await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
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

async function sendText(page, text) {
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found.");
  await fillComposer(composer, text);
  await sleep(300);
  for (const selector of ['button[data-testid="send-button"]', 'button[aria-label*="Send"]', 'button[aria-label*="Изпрати"]']) {
    try {
      const btn = page.locator(selector).last();
      if (await btn.count() && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
        await btn.click();
        console.log("[DAVID] Message sent via send button.");
        return;
      }
    } catch {}
  }
  await composer.press("Enter");
  console.log("[DAVID] Message sent via Enter.");
}

async function refreshChat(context, page, state, attempt) {
  state.watchdog = "refreshing-chat";
  state.recoveryAttempt = attempt;
  saveState(state, `Refreshing ChatGPT recovery ${attempt}`);
  console.log(`[DAVID] Refreshing ChatGPT (recovery ${attempt}/${MAX_RECOVERY_ATTEMPTS}).`);
  page = await waitForSession(context, page, state);
  if (usable(page)) await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(REFRESH_SETTLE_MS);
  return waitForSession(context, page, state);
}

async function waitPlatform(context, page, state, blocker) {
  const human = blocker === "captcha" || blocker === "human verification";
  const waitMs = human ? 30000 : blocker === "network error" ? 10000 : PLATFORM_BACKOFF_MS;
  state.problem = `ChatGPT platform: ${blocker}`;
  state.problemRetryAt = new Date(Date.now() + waitMs).toISOString();
  state.watchdog = human ? "human-blocked" : "platform-backoff";
  saveState(state, `Platform problem ${blocker}; retry scheduled`);
  console.log(`[DAVID] Platform problem: ${blocker}. Retry in ${Math.round(waitMs / 1000)}s.`);
  await sleep(waitMs);
  page = await refreshChat(context, page, state, 0);
  delete state.problemRetryAt;
  if (!human) state.problem = null;
  saveState(state, "Platform retry window ended");
  return page;
}

async function waitForResponseStart(context, page, baselineHash, state) {
  const until = Date.now() + RESPONSE_START_TIMEOUT_MS;
  while (Date.now() < until) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) return { started: false, blocker, page };
    if (await isGenerating(page)) {
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT started thinking/generating");
      return { started: true, page };
    }
    const turn = await latestTurnInfo(page);
    const text = await latestAssistantText(page);
    if (turn.role === "assistant" && text && hashText(text) !== baselineHash) {
      state.watchdog = "gpt-writing";
      saveState(state, "GPT started a new response");
      return { started: true, page };
    }
    await sleep(POLL_MS);
  }
  return { started: false, blocker: null, page };
}

async function sendWithRecovery(context, page, state, text, kind) {
  const baselineHash = hashText(await latestAssistantText(page));
  for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      page = await waitPlatform(context, page, state, blocker);
      attempt -= 1;
      continue;
    }
    if (attempt >= 3) page = await refreshChat(context, page, state, attempt);
    state.watchdog = kind === "fix" ? "fixing-problem" : attempt === 1 ? "sending-relay" : "recovering-relay";
    state.recoveryAttempt = attempt - 1;
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    saveState(state, kind === "fix" ? "Sending problem-fix instruction" : `Sending development relay attempt ${attempt}`);
    console.log(`[DAVID] Sending ${kind} attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}.`);
    const outgoingText = state.justRolledOver
      ? `AUTOMATIC CHAT ROLLOVER: The previous Enchev conversation reached its maximum length. Reconstruct the exact current state from GitHub, MASTER SYSTEM PLAN and evidence, then continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${text}`
      : text;
    await sendText(page, outgoingText);
    const started = await waitForResponseStart(context, page, baselineHash, state);
    page = started.page;
    syncActiveChatUrl(page, state);
    if (started.blocker) {
      page = await waitPlatform(context, page, state, started.blocker);
      continue;
    }
    if (started.started) {
      state.turnsSent = Number(state.turnsSent || 0) + 1;
      state.recoveryAttempt = 0;
      saveState(state, `GPT response started; logical cycle ${state.turnsSent}`);
      return { ok: true, page, baselineHash };
    }
    console.log("[DAVID] GPT did not start. Retrying.");
  }
  state.watchdog = "refreshing-chat";
  state.problem = "GPT did not start after recovery attempts";
  saveState(state, "Response start recovery exhausted; refreshing instead of stopping");
  page = await refreshChat(context, page, state, MAX_RECOVERY_ATTEMPTS);
  return { ok: false, page, baselineHash };
}

async function waitForCompletion(context, page, state, baselineHash) {
  let lastHash = baselineHash;
  let lastActivityAt = Date.now();
  while (true) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      page = await waitPlatform(context, page, state, blocker);
      lastActivityAt = Date.now();
      continue;
    }
    const generating = await isGenerating(page);
    const turn = await latestTurnInfo(page);
    const text = await latestAssistantText(page);
    const currentHash = text ? hashText(text) : null;
    if (generating) {
      lastActivityAt = Date.now();
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT is thinking/generating");
      await sleep(POLL_MS);
      continue;
    }
    if (turn.role === "assistant" && currentHash && currentHash !== baselineHash) {
      if (currentHash !== lastHash) {
        lastHash = currentHash;
        lastActivityAt = Date.now();
        state.watchdog = "gpt-writing";
        saveState(state, "GPT is writing");
      }
      if (await responseComplete(page)) {
        const finalText = await latestAssistantText(page);
        return { status: "complete", page, text: finalText, hash: hashText(finalText) };
      }
    }
    if (Date.now() - lastActivityAt >= STALL_TIMEOUT_MS) {
      state.watchdog = "stalled";
      state.problem = "GPT response stalled or remained blank";
      saveState(state, "GPT stalled/blank; refresh recovery");
      return { status: "stalled", page, text, hash: currentHash };
    }
    await sleep(POLL_MS);
  }
}

async function runPrompt(context, page, state, prompt, kind) {
  while (true) {
    const sent = await sendWithRecovery(context, page, state, prompt, kind);
    page = sent.page;
    if (!sent.ok) {
      await sleep(1000);
      continue;
    }
    const result = await waitForCompletion(context, page, state, sent.baselineHash);
    page = result.page;
    if (result.status === "stalled") {
      page = await refreshChat(context, page, state, 1);
      continue;
    }
    state.lastAssistantHash = result.hash;
    if (state.justRolledOver) state.justRolledOver = false;
    syncActiveChatUrl(page, state);
    saveState(state, "Completed assistant response captured");
    return { page, text: result.text, hash: result.hash };
  }
}

async function main() {
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");
  const state = loadState();
  activeChatUrl = state.chatUrl || INITIAL_CHAT_URL;
  let page = await waitForSession(context, await ensureTargetPage(context), state);
  syncActiveChatUrl(page, state);
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  state.stopped = false;
  state.watchdog = "monitoring";
  delete state.stopReason;
  saveState(state, "DAVID V5 connected: continuous mode, no DAVID_STOP");
  console.log(`[DAVID] V5 continuous mode ON. No DAVID_STOP. max cycles=${MAX_TURNS}.`);
  console.log(`[DAVID] poll=${POLL_MS}ms cooldown=${COOLDOWN_MS}ms start=${RESPONSE_START_TIMEOUT_MS}ms stall=${STALL_TIMEOUT_MS}ms.`);
  console.log("[DAVID] Ctrl+C stops the local process manually.");

  // Ignore any historical DAVID_STOP text from older versions. V5 owns the flow now.
  const initialText = await latestAssistantText(page);
  if (initialText.includes("[[DAVID_STOP]]")) {
    state.legacyStopIgnored = true;
    state.lastAssistantHash = hashText(initialText);
    saveState(state, "Legacy DAVID_STOP ignored by V5");
    console.log("[DAVID] Legacy DAVID_STOP ignored. Continuing work.");
  }

  let mode = state.problem ? "fix" : "work";

  while (state.turnsSent < MAX_TURNS) {
    if (mode === "fix" && state.problem) {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      state.watchdog = "fixing-problem";
      saveState(state, `Trying to fix problem attempt ${state.problemAttempts}`);
      console.log(`[DAVID] PROBLEM: ${state.problem}`);
      const result = await runPrompt(context, page, state, fixPrompt(state.problem, state.problemAttempts), "fix");
      page = result.page;
      const nextProblem = extractProblem(result.text);
      if (nextProblem) {
        state.problem = nextProblem;
        state.watchdog = "problem-detected";
        saveState(state, `Problem remains after attempt ${state.problemAttempts}`);
        console.log(`[DAVID] Problem remains: ${nextProblem}`);
        if (state.problemAttempts % 4 === 0) {
          state.problemRetryAt = new Date(Date.now() + PROBLEM_BACKOFF_MS).toISOString();
          state.watchdog = "problem-backoff";
          saveState(state, "Repeated problem; short backoff before next fix attempt");
          await sleep(PROBLEM_BACKOFF_MS);
          delete state.problemRetryAt;
        } else {
          await sleep(COOLDOWN_MS);
        }
        continue;
      }

      if (endsOk(result.text)) console.log("[DAVID] Fix result: OK.");
      state.problem = null;
      state.problemAttempts = 0;
      delete state.problemRetryAt;
      state.watchdog = "problem-fixed";
      saveState(state, "Problem fixed; returning to stage execution");
      mode = "work";
      await sleep(COOLDOWN_MS);
      continue;
    }

    state.watchdog = "sending-relay";
    saveState(state, "Continuing MASTER SYSTEM PLAN stages");
    const result = await runPrompt(context, page, state, CONTINUE_PROMPT, "work");
    page = result.page;
    const problem = extractProblem(result.text);
    if (problem) {
      state.problem = problem;
      state.problemAttempts = 0;
      state.watchdog = "problem-detected";
      saveState(state, `GPT reported problem: ${problem}`);
      console.log(`[DAVID] GPT reported PROBLEM IN: ${problem}`);
      mode = "fix";
      await sleep(COOLDOWN_MS);
      continue;
    }

    if (endsOk(result.text)) {
      state.lastResult = "OK";
      console.log("[DAVID] Stage/block result: OK. Continuing to next stage.");
    } else {
      state.lastResult = "completed-without-marker";
      console.log("[DAVID] Completed response without PROBLEM IN. Continuing.");
    }
    state.problem = null;
    state.problemAttempts = 0;
    state.watchdog = "answer-complete";
    saveState(state, "Stage/block complete; continuing automatically");
    await sleep(COOLDOWN_MS);
  }
}

main().catch(async (error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
