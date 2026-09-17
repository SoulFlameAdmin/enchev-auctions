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
const STATE_FILE = process.env.DAVID_STATE_FILE || path.join(process.cwd(), ".david-enchev-state.json");
const RESUME_ONCE_FILE = process.env.DAVID_RESUME_ONCE_FILE || path.join(process.cwd(), ".david-resume-once");
const STOP_MARKER = "[[DAVID_STOP]]";

const CONTINUE_PROMPT = `@GitHub @Vercel @Supabase

Продължи следващата незавършена зависима задача по Enchev Auctions и MASTER SYSTEM PLAN v1.0 FROZEN.
Провери реалното състояние чрез GitHub, Vercel и Supabase, когато са приложими. Направи реалната промяна, тествай я и маркирай GREEN само с evidence. Не прескачай blocker и не добавяй pricing/payment/finance в tracker.
Работи по една логически завършена задача или свързан блок, след което кажи какво е доказано и коя е следващата задача.
Ако е нужно човешко решение, платен ресурс, secret/API key, MFA/CAPTCHA/login, destructive/необратимо действие, правен sign-off, security exception или липсващ достъп, завърши с точния маркер ${STOP_MARKER}.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hashText = (text) => createHash("sha256").update(text || "").digest("hex");

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { turnsSent: 0, lastAssistantHash: null, stopped: false }; }
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

  // Fallback for UI variants where icon buttons have no stable labels.
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

  // CAPTCHA only blocks when an actual visible challenge frame/widget exists.
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

async function main() {
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");

  let page = await waitForSession(context, await ensureTargetPage(context));
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  let state = loadState();
  console.log(`[DAVID] max cycles: ${MAX_TURNS}. Final-buttons relay mode: ON`);
  console.log("[DAVID] Ctrl+C stops the worker.");

  while (state.turnsSent < MAX_TURNS) {
    page = await waitForSession(context, page);

    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      state.stopped = true;
      state.stopReason = `platform blocker: ${blocker}`;
      saveState(state, `Stopped: ${blocker}`);
      console.log(`[DAVID] Stop: visible platform blocker detected: ${blocker}`);
      return;
    }

    if (!await responseComplete(page)) {
      await sleep(POLL_MS);
      continue;
    }

    const answer = await latestAssistantText(page);
    if (!answer) { await sleep(POLL_MS); continue; }
    const answerHash = hashText(answer);

    if (answer.includes(STOP_MARKER) && !consumeResumeOnce()) {
      state.stopped = true;
      state.stopReason = answer.slice(-1200);
      state.lastAssistantHash = answerHash;
      saveState(state, "Waiting for human action");
      console.log("[DAVID] DAVID_STOP detected. Waiting for intentional resume.");
      return;
    }

    if (answerHash === state.lastAssistantHash) {
      await sleep(POLL_MS);
      continue;
    }

    state.lastAssistantHash = answerHash;
    state.stopped = false;
    delete state.stopReason;
    saveState(state, "Completed response detected; preparing relay");

    console.log(`[DAVID] Completed answer detected. Relay in ${COOLDOWN_MS} ms...`);
    await sleep(COOLDOWN_MS);
    page = await waitForSession(context, page);

    const blocker2 = await visiblePlatformBlock(page);
    if (blocker2) {
      state.stopped = true;
      state.stopReason = `platform blocker: ${blocker2}`;
      saveState(state, `Stopped: ${blocker2}`);
      console.log(`[DAVID] Stop: visible platform blocker detected: ${blocker2}`);
      return;
    }

    await sendRelay(page);
    state.turnsSent = Number(state.turnsSent || 0) + 1;
    state.stopped = false;
    saveState(state, `Relay sent cycle ${state.turnsSent}`);
    console.log(`[DAVID] Sent cycle ${state.turnsSent}/${MAX_TURNS}`);
    await sleep(POLL_MS);
  }
}

main().catch((error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
