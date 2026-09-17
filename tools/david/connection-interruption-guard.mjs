import { chromium } from "playwright-core";
import process from "node:process";

const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const POLL_MS = Number(process.env.DAVID_INTERRUPT_POLL_MS || 500);
const RETRY_COOLDOWN_MS = Number(process.env.DAVID_INTERRUPT_RETRY_COOLDOWN_MS || 8000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const recoveredAt = new Map();

function isChat(page) {
  try { return !page.isClosed() && /^https:\/\/chatgpt\.com\/c\//i.test(page.url()); }
  catch { return false; }
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

async function stopResponse(page) {
  const selectors = [
    '[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button[aria-label*="Спри"]',
    'button[title*="Stop"]',
    'button[title*="Спри"]',
    'button:has-text("Stop generating")',
    'button:has-text("Stop response")',
    'button:has-text("Спри отговора")',
    'button:has-text("Спри генерирането")'
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).last();
      if (await button.count() && await button.isVisible().catch(() => false) && await button.isEnabled().catch(() => false)) {
        await button.click({ timeout: 3000 }).catch(() => {});
        return true;
      }
    } catch {}
  }
  return false;
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
  try { await composer.fill(text); return; } catch {}
  await composer.click().catch(() => {});
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
        await button.click({ timeout: 3000 });
        return "button";
      }
    } catch {}
  }
  await composer.press("Enter");
  return "enter";
}

async function recover(page) {
  const url = page.url();
  const key = url;
  const now = Date.now();
  if (now - Number(recoveredAt.get(key) || 0) < RETRY_COOLDOWN_MS) return;
  recoveredAt.set(key, now);

  const prompt = await latestUserText(page);
  if (!prompt) {
    console.log(`[INTERRUPT] Detected on ${url}, but no previous user prompt was found. Retrying scan.`);
    recoveredAt.set(key, 0);
    return;
  }

  console.log(`[INTERRUPT] Connection interruption detected on ${url}`);
  const stopped = await stopResponse(page);
  console.log(`[INTERRUPT] Stop response: ${stopped ? "clicked" : "button not visible"}`);

  await sleep(stopped ? 900 : 500);
  let composer = await getComposer(page);
  for (let i = 0; !composer && i < 8; i++) {
    await sleep(500);
    composer = await getComposer(page);
  }
  if (!composer) {
    console.log("[INTERRUPT] Composer unavailable after stop; will retry when UI recovers.");
    recoveredAt.set(key, 0);
    return;
  }

  await fillComposer(composer, prompt);
  await sleep(250);
  const via = await sendComposer(page, composer);
  console.log(`[INTERRUPT] Previous prompt pasted and resent via ${via}.`);
}

async function main() {
  console.log(`[INTERRUPT] Connecting to shared Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");
  console.log("[INTERRUPT] Global ChatGPT connection guard ON. Watches every ChatGPT conversation tab in DAVID Edge.");

  while (true) {
    const pages = context.pages().filter(isChat);
    for (const page of pages) {
      try {
        if (await interruptionVisible(page)) await recover(page);
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
