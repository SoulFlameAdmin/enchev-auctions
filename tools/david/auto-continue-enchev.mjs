import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CHAT_URL = process.env.DAVID_CHAT_URL || "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71";
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const MAX_TURNS = Number(process.env.DAVID_MAX_TURNS || 30);
const POLL_MS = Number(process.env.DAVID_POLL_MS || 1800);
const COOLDOWN_MS = Number(process.env.DAVID_COOLDOWN_MS || 3500);
const STATE_FILE = process.env.DAVID_STATE_FILE || path.join(process.cwd(), ".david-enchev-state.json");
const STOP_MARKER = "[[DAVID_STOP]]";

const CONTINUE_PROMPT = `@GitHub @Vercel @Supabase

Продължи реалната разработка на Enchev Auctions: https://enchev-auctions.vercel.app/

Работи по MASTER SYSTEM PLAN v1.0 FROZEN и append-only GAP точките в SoulFlameAdmin/enchev-auctions. Не създавай нов план и не преномерирай съществуващи точки. Избери следващата незавършена задача според WAVE/dependencies, а не само по цифров номер.

Преди промяна провери реалното състояние директно чрез свързаните GitHub, Vercel и Supabase инструменти, когато са приложими. Не ми давай само план: когато е безопасно и имаш нужните права, направи реалната промяна директно.

След всяка реална промяна: тествай build/typecheck/runtime/данни според задачата; GREEN само с конкретно evidence; при грешка остави YELLOW, поправи и тествай отново. Не прескачай blocker. Не добавяй pricing/payment/finance обратно в tracker без изрично човешко решение.

Работи по една логически завършена задача или свързан блок на цикъл. Накрая напиши какво е доказано и коя е следващата зависима задача.

Ако е нужно човешко решение, нов платен ресурс или потвърждение за разход, secret/password/API key, MFA/CAPTCHA/login, destructive action, необратимо действие, правен sign-off, security exception или липсващ достъп: НЕ продължавай автоматично. Завърши отговора си с точния маркер ${STOP_MARKER} и обясни какво трябва да направи човекът.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(text) {
  return createHash("sha256").update(text || "").digest("hex");
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { turnsSent: 0, lastAssistantHash: null, stopped: false };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function pageUsable(page) {
  return Boolean(page && !page.isClosed());
}

async function safeUrl(page) {
  try {
    return pageUsable(page) ? page.url() : "";
  } catch {
    return "";
  }
}

async function ensureTargetPage(context, currentPage = null) {
  if (pageUsable(currentPage)) {
    const url = await safeUrl(currentPage);
    if (url.startsWith(CHAT_URL)) return currentPage;
  }

  const pages = context.pages().filter((p) => !p.isClosed());
  let page = pages.find((p) => p.url().startsWith(CHAT_URL));

  if (!page) {
    page = pages.find((p) => p.url().includes("chatgpt.com/c/"));
  }

  if (!page) {
    page = pages.find((p) => p.url().includes("chatgpt.com"));
  }

  if (!page) {
    page = await context.newPage();
  }

  const url = await safeUrl(page);
  if (!url.startsWith(CHAT_URL) && !url.includes("/auth/") && !url.includes("/login")) {
    try {
      await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (error) {
      if (!pageUsable(page)) return ensureTargetPage(context, null);
      throw error;
    }
  }

  return page;
}

async function getComposer(page) {
  if (!pageUsable(page)) return null;
  const selectors = [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).last();
      if ((await loc.count()) > 0 && await loc.isVisible().catch(() => false)) return loc;
    } catch {
      return null;
    }
  }
  return null;
}

async function latestAssistantText(page) {
  if (!pageUsable(page)) return "";
  try {
    const primary = page.locator('[data-message-author-role="assistant"]');
    if (await primary.count()) {
      return (await primary.last().innerText().catch(() => "")).trim();
    }

    const turns = page.locator('article[data-testid^="conversation-turn-"]');
    const count = await turns.count();
    for (let i = count - 1; i >= 0; i--) {
      const turn = turns.nth(i);
      const role = await turn.locator('[data-message-author-role="assistant"]').count();
      if (role) return (await turn.innerText().catch(() => "")).trim();
    }
  } catch {}
  return "";
}

async function latestUserText(page) {
  if (!pageUsable(page)) return "";
  try {
    const user = page.locator('[data-message-author-role="user"]');
    if (await user.count()) return (await user.last().innerText().catch(() => "")).trim();
  } catch {}
  return "";
}

async function isGenerating(page) {
  if (!pageUsable(page)) return false;
  const selectors = [
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button:has-text("Stop generating")',
    'button:has-text("Спри генерирането")',
    '[data-testid="stop-button"]'
  ];
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).last();
      if ((await loc.count()) > 0 && await loc.isVisible().catch(() => false)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function responseIsStable(page) {
  if (!pageUsable(page)) return false;
  if (await isGenerating(page)) return false;
  const a = await latestAssistantText(page);
  if (!a) return false;
  await sleep(1800);
  if (!pageUsable(page)) return false;
  if (await isGenerating(page)) return false;
  const b = await latestAssistantText(page);
  return a === b && b.length > 0;
}

async function hasPlatformBlock(page) {
  if (!pageUsable(page)) return null;
  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  const patterns = [
    "you've reached your limit",
    "you have reached your limit",
    "rate limit",
    "too many requests",
    "something went wrong",
    "network error",
    "verify you are human",
    "captcha",
    "достигнахте лимита",
    "твърде много заявки",
    "нещо се обърка"
  ];
  return patterns.find((p) => body.includes(p)) || null;
}

async function fillComposer(composer, text) {
  try {
    await composer.fill(text);
    return;
  } catch {}

  await composer.click();
  await composer.evaluate((el, value) => {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = value;
    } else {
      el.textContent = value;
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, text);
}

async function sendContinue(page) {
  if (!pageUsable(page)) throw new Error("Target ChatGPT page is not available.");
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer was not found. Make sure the fixed session is open and logged in.");

  await fillComposer(composer, CONTINUE_PROMPT);
  await sleep(500);

  const sendSelectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Изпрати"]'
  ];
  for (const selector of sendSelectors) {
    const btn = page.locator(selector).last();
    if ((await btn.count()) > 0 && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await btn.click();
      return;
    }
  }

  await composer.press("Enter");
}

async function waitForLoggedInTarget(context, currentPage) {
  let page = currentPage;
  let announcedLogin = false;

  while (true) {
    page = await ensureTargetPage(context, page);
    const url = await safeUrl(page);

    if (url.includes("/auth/") || url.includes("/login")) {
      if (!announcedLogin) {
        console.log("[DAVID] Waiting for ChatGPT login to finish. Do not close the dedicated browser window.");
        announcedLogin = true;
      }
      await sleep(POLL_MS);
      continue;
    }

    if (!url.startsWith(CHAT_URL)) {
      if (pageUsable(page)) {
        await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      }
      await sleep(POLL_MS);
      continue;
    }

    const composer = await getComposer(page);
    const assistant = await latestAssistantText(page);
    if (composer || assistant) return page;

    await sleep(POLL_MS);
  }
}

async function main() {
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts[0];
  if (!context) throw new Error("No active Chromium context exists on the CDP port.");

  let page = await ensureTargetPage(context, null);
  page = await waitForLoggedInTarget(context, page);
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  let state = loadState();
  const firstRun = !fs.existsSync(STATE_FILE) || !state.lastAssistantHash;

  console.log(`[DAVID] max cycles: ${MAX_TURNS}. Stop marker: ${STOP_MARKER}`);
  console.log("[DAVID] Ctrl+C stops the worker.");

  if (firstRun) {
    while (true) {
      page = await ensureTargetPage(context, page);
      page = await waitForLoggedInTarget(context, page);
      if (await responseIsStable(page)) break;
      await sleep(POLL_MS);
    }

    const current = await latestAssistantText(page);
    if (current.includes(STOP_MARKER)) {
      console.log("[DAVID] Existing last answer contains DAVID_STOP. No automatic send.");
      return;
    }

    const block = await hasPlatformBlock(page);
    if (block) {
      console.log(`[DAVID] Stop: platform blocker detected: ${block}`);
      return;
    }

    state.lastAssistantHash = hashText(current);
    saveState(state);
    console.log("[DAVID] First cycle -> sending continue instruction.");
    await sendContinue(page);
    state.turnsSent += 1;
    saveState(state);
  }

  while (state.turnsSent < MAX_TURNS) {
    await sleep(POLL_MS);

    page = await ensureTargetPage(context, page);
    page = await waitForLoggedInTarget(context, page);

    const block = await hasPlatformBlock(page);
    if (block) {
      console.log(`[DAVID] Stop: platform blocker detected: ${block}`);
      break;
    }

    if (!(await responseIsStable(page))) continue;

    const answer = await latestAssistantText(page);
    if (!answer) continue;

    if (answer.includes(STOP_MARKER)) {
      console.log("[DAVID] ChatGPT requested human action. DAVID_STOP detected.");
      state.stopped = true;
      state.stopReason = answer.slice(-1200);
      saveState(state);
      break;
    }

    const answerHash = hashText(answer);
    if (answerHash === state.lastAssistantHash) continue;

    const userText = await latestUserText(page);
    if (!userText) continue;

    state.lastAssistantHash = answerHash;
    saveState(state);

    console.log(`[DAVID] New completed answer. Waiting ${COOLDOWN_MS} ms before next cycle.`);
    await sleep(COOLDOWN_MS);

    page = await ensureTargetPage(context, page);
    page = await waitForLoggedInTarget(context, page);

    const blockAfterWait = await hasPlatformBlock(page);
    if (blockAfterWait) {
      console.log(`[DAVID] Stop: platform blocker detected: ${blockAfterWait}`);
      break;
    }

    await sendContinue(page);
    state.turnsSent += 1;
    state.stopped = false;
    saveState(state);
    console.log(`[DAVID] Sent cycle ${state.turnsSent}/${MAX_TURNS}`);
  }

  if (state.turnsSent >= MAX_TURNS) {
    console.log(`[DAVID] Reached cycle limit ${MAX_TURNS}.`);
  }
}

main().catch((error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
