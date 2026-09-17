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

async function findTargetPage(context) {
  let page = context.pages().find((p) => p.url().startsWith(CHAT_URL));
  if (!page) {
    page = context.pages().find((p) => p.url().includes("chatgpt.com/c/"));
  }
  if (!page) page = await context.newPage();
  if (!page.url().startsWith(CHAT_URL)) {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  return page;
}

async function getComposer(page) {
  const selectors = [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).last();
    if ((await loc.count()) > 0 && await loc.isVisible().catch(() => false)) return loc;
  }
  return null;
}

async function latestAssistantText(page) {
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
  return "";
}

async function latestUserText(page) {
  const user = page.locator('[data-message-author-role="user"]');
  if (await user.count()) return (await user.last().innerText().catch(() => "")).trim();
  return "";
}

async function isGenerating(page) {
  const selectors = [
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button:has-text("Stop generating")',
    'button:has-text("Спри генерирането")',
    '[data-testid="stop-button"]'
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).last();
    if ((await loc.count()) > 0 && await loc.isVisible().catch(() => false)) return true;
  }
  return false;
}

async function responseIsStable(page) {
  if (await isGenerating(page)) return false;
  const a = await latestAssistantText(page);
  if (!a) return false;
  await sleep(1800);
  if (await isGenerating(page)) return false;
  const b = await latestAssistantText(page);
  return a === b && b.length > 0;
}

async function hasPlatformBlock(page) {
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
  const composer = await getComposer(page);
  if (!composer) throw new Error("Не намирам ChatGPT полето за писане. Провери дали си логнат и дали сесията е отворена.");

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

async function main() {
  console.log(`[DAVID] Свързване към Edge CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts[0];
  if (!context) throw new Error("Няма активен Edge/Chromium context на CDP порта.");

  const page = await findTargetPage(context);
  console.log(`[DAVID] Сесия: ${page.url()}`);

  if (page.url().includes("/auth/") || page.url().includes("/login")) {
    console.log("[DAVID] ChatGPT не е логнат. Влез ръчно в този Edge профил, после стартирай скрипта отново.");
    process.exit(2);
  }

  let state = loadState();
  const firstRun = !fs.existsSync(STATE_FILE) || !state.lastAssistantHash;

  console.log(`[DAVID] max цикли: ${MAX_TURNS}. Stop marker: ${STOP_MARKER}`);
  console.log("[DAVID] Ctrl+C спира worker-а.");

  if (firstRun) {
    while (!(await responseIsStable(page))) await sleep(POLL_MS);
    const current = await latestAssistantText(page);
    if (current.includes(STOP_MARKER)) {
      console.log("[DAVID] Последният отговор вече съдържа DAVID_STOP. Няма да изпращам автоматично.");
      return;
    }
    const block = await hasPlatformBlock(page);
    if (block) {
      console.log(`[DAVID] Спирам: открит platform blocker: ${block}`);
      return;
    }
    state.lastAssistantHash = hashText(current);
    saveState(state);
    console.log("[DAVID] Първи цикъл → изпращам инструкцията за продължаване.");
    await sendContinue(page);
    state.turnsSent += 1;
    saveState(state);
  }

  while (state.turnsSent < MAX_TURNS) {
    await sleep(POLL_MS);

    if (!page.url().startsWith(CHAT_URL)) {
      console.log("[DAVID] Върщам се към фиксираната Enchev ChatGPT сесия.");
      await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(1500);
    }

    const block = await hasPlatformBlock(page);
    if (block) {
      console.log(`[DAVID] Спирам: открит platform blocker: ${block}`);
      break;
    }

    if (!(await responseIsStable(page))) continue;

    const answer = await latestAssistantText(page);
    if (!answer) continue;

    if (answer.includes(STOP_MARKER)) {
      console.log("[DAVID] ChatGPT поиска човешко действие. STOP marker е открит.");
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

    console.log(`[DAVID] Завършен нов отговор. Изчаквам ${COOLDOWN_MS} ms и продължавам.`);
    await sleep(COOLDOWN_MS);

    const blockAfterWait = await hasPlatformBlock(page);
    if (blockAfterWait) {
      console.log(`[DAVID] Спирам: открит platform blocker: ${blockAfterWait}`);
      break;
    }

    await sendContinue(page);
    state.turnsSent += 1;
    state.stopped = false;
    saveState(state);
    console.log(`[DAVID] Изпратен цикъл ${state.turnsSent}/${MAX_TURNS}`);
  }

  if (state.turnsSent >= MAX_TURNS) {
    console.log(`[DAVID] Достигнат безопасният лимит ${MAX_TURNS}. Стартирай отново след преглед, ако искаш още.`);
  }
}

main().catch((error) => {
  console.error("[DAVID] FATAL:", error?.stack || error);
  process.exit(1);
});
