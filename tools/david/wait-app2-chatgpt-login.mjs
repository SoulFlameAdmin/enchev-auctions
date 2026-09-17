import { chromium } from "playwright-core";
import process from "node:process";

const CDP_URL = process.env.DAVID_APP2_CDP_URL || "http://127.0.0.1:9555";
const CHAT_URL = process.env.DAVID_APP2_CHAT_URL || "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4";
const HOME_URL = "https://chatgpt.com/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function visible(locator) {
  try { return Boolean(await locator.count()) && await locator.first().isVisible(); }
  catch { return false; }
}

async function isLoggedOut(page) {
  if (!page || page.isClosed()) return true;
  const url = page.url();
  if (/\/auth\/|\/login(?:[/?#]|$)/i.test(url)) return true;
  const selectors = [
    'button:has-text("Влизане")',
    'a:has-text("Влизане")',
    'button:has-text("Log in")',
    'a:has-text("Log in")',
    'button:has-text("Регистрирайте се безплатно")',
    'button:has-text("Sign up")'
  ];
  for (const selector of selectors) {
    if (await visible(page.locator(selector))) return true;
  }
  return false;
}

async function chatReady(page) {
  if (!page || page.isClosed()) return false;
  for (const selector of [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    '[data-message-author-role="assistant"]',
    '[data-message-author-role="user"]'
  ]) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return true;
    } catch {}
  }
  return false;
}

async function main() {
  console.log(`[APP2-AUTH] Connecting to ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 120000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error("No Chromium context on APP2 port");

  let home = context.pages().find((p) => !p.isClosed() && /^https:\/\/chatgpt\.com\/?(?:[?#].*)?$/i.test(p.url()));
  if (!home) {
    home = context.pages().find((p) => !p.isClosed() && p.url().startsWith("https://chatgpt.com"));
  }
  if (!home) home = await context.newPage();

  if (!home.url().startsWith("https://chatgpt.com")) {
    await home.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }

  let announced = false;
  while (await isLoggedOut(home)) {
    if (!announced) {
      console.log("[APP2-AUTH] WAITING FOR CHATGPT LOGIN. In the APP2 browser click the BLACK ChatGPT 'Влизане / Log in' button and sign in. DAVID will continue automatically after login.");
      announced = true;
    }
    if (home.isClosed()) {
      home = context.pages().find((p) => !p.isClosed() && p.url().startsWith("https://chatgpt.com")) || await context.newPage();
    }
    await sleep(1500);
  }

  console.log("[APP2-AUTH] ChatGPT login detected. Opening target conversation...");

  let target = context.pages().find((p) => !p.isClosed() && p.url().startsWith(CHAT_URL));
  if (!target) target = home;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await target.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch {}

    const until = Date.now() + 20000;
    while (Date.now() < until) {
      if (await chatReady(target)) {
        console.log(`[APP2-AUTH] Target conversation ready: ${target.url()}`);
        return;
      }
      await sleep(1000);
    }

    console.log(`[APP2-AUTH] Target conversation not ready yet; reload ${attempt}/4...`);
    await target.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(1500);
  }

  throw new Error("ChatGPT target conversation stayed blank after login and 4 reload attempts.");
}

main().catch((error) => {
  console.error("[APP2-AUTH] FATAL", error?.stack || error);
  process.exit(1);
});
