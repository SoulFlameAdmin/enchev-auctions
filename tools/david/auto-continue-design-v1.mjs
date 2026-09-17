import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CHAT_URL = process.env.DAVID_DESIGN_CHAT_URL || "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7";
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_DESIGN_STATE_FILE || path.join(process.cwd(), ".david-enchev-design-state.json");
const POLL_MS = Number(process.env.DAVID_DESIGN_POLL_MS || 900);
const START_TIMEOUT_MS = 15000;
const STALL_MS = 70000;
const COOLDOWN_MS = 1200;
const PROBLEM_PREFIX = "PROBLEM IN:";
const MARKER = "[DAVID_RELAY_ENCHEV_DESIGN_V1]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (x) => createHash("sha256").update(String(x || "")).digest("hex");

const DESIGN_PROMPT = `@GitHub @Vercel @Supabase

Продължи СЕГА следващата незавършена задача от docs/DESIGN_PLAN_V1.md за Enchev Auctions.
Реалната design session цел е сайтът да следва доказаните UX и information-architecture модели на https://www.autobidmaster.com/ като референция, НО със собствен ENCHEV дизайн, бранд, код, copy и assets. Не копирай чуждо logo, proprietary text, images, source code или точна визуална идентичност.

Работи последователно по D01 → D36. Провери реалния GitHub и production във Vercel. Направи реалната промяна, тествай responsive/interaction/visual state и чак тогава обнови app/design-plan-evidence.json: status=green + конкретно evidence. Ако е частично/чака тест, status=yellow. Не маркирай green без доказателство.

Приоритет: homepage → inventory/search/filters → vehicle detail → live auction → profile → mobile/accessibility/cross-browser/visual regression.
Не променяй MASTER SYSTEM PLAN IDs и не добавяй pricing/payment/finance scope.

Ако задачата е завършена, последният ред да е само: OK
Ако има реален нерешен blocker, последният ред да е: ${PROBLEM_PREFIX} <точният проблем>. Преди това опитай безопасна техническа алтернатива.

${MARKER}`;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { turnsSent: 0, relayAttempts: 0, problemAttempts: 0, problem: null, watchdog: "boot" }; }
}
function save(state, action) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
function extractProblem(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const p = rows[i].toUpperCase().indexOf(PROBLEM_PREFIX);
    if (p >= 0) return rows[i].slice(p + PROBLEM_PREFIX.length).trim() || "Unknown design blocker";
  }
  return null;
}
function endsOk(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return Boolean(rows.length && /^OK[.!]?$/i.test(rows.at(-1)));
}
function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nDESIGN PROBLEM:\n${problem}\n\nTRY TO MAKE THIS FIX YOURSELF NOW. Опит ${attempt}. Провери repo/deployment и приложи безопасен fix или алтернатива. Не измисляй evidence. Не заобикаляй CAPTCHA/MFA/login/permissions и не прави destructive действие без разрешение.\n\nАко fix-ът е доказан: OK\nАко още е блокирано: ${PROBLEM_PREFIX} <точният оставащ проблем>\n\nСлед успешен fix продължи следващата D-задача от docs/DESIGN_PLAN_V1.md.\n${MARKER}`;
}

async function ensurePage(context, current) {
  if (current && !current.isClosed() && current.url().startsWith(CHAT_URL)) return current;
  const exact = context.pages().find((p) => !p.isClosed() && p.url().startsWith(CHAT_URL));
  if (exact) return exact;
  const page = await context.newPage();
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  return page;
}
async function composer(page) {
  for (const s of ["#prompt-textarea", '[data-testid="prompt-textarea"]', 'div[contenteditable="true"][role="textbox"]']) {
    const x = page.locator(s).last();
    if (await x.count() && await x.isVisible().catch(() => false)) return x;
  }
  return null;
}
async function latestAssistant(page) {
  const x = page.locator('[data-message-author-role="assistant"]');
  if (!await x.count()) return "";
  return (await x.last().innerText().catch(() => "")).trim();
}
async function latestRole(page) {
  const x = page.locator('[data-message-author-role="assistant"],[data-message-author-role="user"]');
  if (!await x.count()) return null;
  return x.last().getAttribute("data-message-author-role").catch(() => null);
}
async function generating(page) {
  for (const s of ['[data-testid="stop-button"]','button[aria-label*="Stop"]','button:has-text("Stop generating")','button:has-text("Спри генерирането")']) {
    const x = page.locator(s).last();
    if (await x.count() && await x.isVisible().catch(() => false)) return true;
  }
  return false;
}
async function complete(page) {
  if (await generating(page) || await latestRole(page) !== "assistant") return false;
  const text = await latestAssistant(page);
  if (!text) return false;
  const turn = page.locator('article[data-testid^="conversation-turn-"]').filter({ has: page.locator('[data-message-author-role="assistant"]') }).last();
  try {
    const buttons = turn.locator("button");
    let visible = 0;
    for (let i = 0; i < await buttons.count(); i++) if (await buttons.nth(i).isVisible().catch(() => false)) visible++;
    if (visible >= 4) return true;
  } catch {}
  const before = text;
  await sleep(1200);
  return !await generating(page) && await latestRole(page) === "assistant" && (await latestAssistant(page)) === before;
}
async function platformBlock(page) {
  try {
    return await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="toast" i],[data-testid*="error" i]'));
      for (const el of list) {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        if (!r.width || !r.height || s.display === "none" || s.visibility === "hidden") continue;
        if (el.closest('[data-message-author-role]')) continue;
        const t = (el.textContent || "").toLowerCase();
        if (/verify you are human|потвърдете, че сте човек/.test(t)) return "human verification";
        if (/rate limit|too many requests|достигнахте лимита/.test(t)) return "rate limit";
        if (/network error|something went wrong|нещо се обърка/.test(t)) return "network error";
      }
      return null;
    });
  } catch { return null; }
}
async function waitReady(context, page) {
  while (true) {
    page = await ensurePage(context, page);
    if (page.url().includes("/login") || page.url().includes("/auth/")) { await sleep(1500); continue; }
    if (await composer(page) || await latestAssistant(page)) return page;
    await sleep(1000);
  }
}
async function fillAndSend(page, text) {
  const c = await composer(page);
  if (!c) throw new Error("Design ChatGPT composer not found");
  try { await c.fill(text); } catch {
    await c.click();
    await c.evaluate((el, value) => { el.textContent = value; el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value })); }, text);
  }
  await sleep(250);
  for (const s of ['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']) {
    const b = page.locator(s).last();
    if (await b.count() && await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click(); return; }
  }
  await c.press("Enter");
}
async function waitStart(context, page, base, state) {
  const end = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < end) {
    page = await waitReady(context, page);
    const pb = await platformBlock(page);
    if (pb) return { page, blocker: pb, started: false };
    if (await generating(page)) return { page, blocker: null, started: true };
    const text = await latestAssistant(page);
    if (text && hash(text) !== base) return { page, blocker: null, started: true };
    await sleep(POLL_MS);
  }
  return { page, blocker: null, started: false };
}
async function waitCompletion(context, page, base, state) {
  let lastActivity = Date.now(), last = base;
  while (true) {
    page = await waitReady(context, page);
    const pb = await platformBlock(page);
    if (pb) return { page, blocker: pb, stalled: false, text: "" };
    const text = await latestAssistant(page), h = hash(text);
    if (await generating(page)) { lastActivity = Date.now(); state.watchdog = "design-thinking"; save(state, "Design GPT thinking"); await sleep(POLL_MS); continue; }
    if (text && h !== base) {
      if (h !== last) { last = h; lastActivity = Date.now(); state.watchdog = "design-writing"; save(state, "Design GPT writing"); }
      if (await complete(page)) return { page, blocker: null, stalled: false, text };
    }
    if (Date.now() - lastActivity > STALL_MS) return { page, blocker: null, stalled: true, text };
    await sleep(POLL_MS);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  for (;;) {
    page = await waitReady(context, page);
    const base = hash(await latestAssistant(page));
    state.watchdog = kind === "fix" ? "design-fixing-problem" : "design-sending-relay";
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    save(state, kind === "fix" ? "Design: sending fix instruction" : "Design: sending next D-task");
    await fillAndSend(page, prompt);
    let started = await waitStart(context, page, base, state); page = started.page;
    if (started.blocker) {
      state.problem = `ChatGPT platform: ${started.blocker}`; state.watchdog = "design-platform-backoff"; save(state, `Design platform blocker: ${started.blocker}`);
      await sleep(started.blocker === "human verification" ? 30000 : 15000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      continue;
    }
    if (!started.started) { state.watchdog = "design-refreshing"; save(state, "Design GPT did not start; refresh/retry"); await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}); await sleep(2500); continue; }
    state.turnsSent = Number(state.turnsSent || 0) + 1; save(state, `Design GPT started cycle ${state.turnsSent}`);
    const done = await waitCompletion(context, page, base, state); page = done.page;
    if (done.blocker || done.stalled) { state.watchdog = "design-refreshing"; save(state, done.blocker ? `Design blocker ${done.blocker}` : "Design GPT stalled"); await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}); await sleep(2500); continue; }
    state.lastAssistantHash = hash(done.text); save(state, "Design response complete");
    return { page, text: done.text };
  }
}

async function main() {
  console.log(`[DESIGN] Connecting to shared Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No shared Edge context");
  let page = await waitReady(context, await ensurePage(context, null));
  console.log(`[DESIGN] Session ready: ${page.url()}`);
  const state = loadState();
  state.watchdog = "design-monitoring";
  save(state, "Design worker connected in shared Edge tab");

  while (true) {
    if (state.problem && !String(state.problem).startsWith("ChatGPT platform:")) {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      const result = await runPrompt(context, page, state, fixPrompt(state.problem, state.problemAttempts), "fix");
      page = result.page;
      const problem = extractProblem(result.text);
      if (problem) { state.problem = problem; state.watchdog = "design-problem"; save(state, `Design problem remains: ${problem}`); await sleep(state.problemAttempts % 4 === 0 ? 30000 : COOLDOWN_MS); continue; }
      state.problem = null; state.problemAttempts = 0; state.lastResult = endsOk(result.text) ? "OK" : "completed"; state.watchdog = "design-problem-fixed"; save(state, "Design problem fixed; continuing plan"); await sleep(COOLDOWN_MS); continue;
    }

    state.problem = null;
    const result = await runPrompt(context, page, state, DESIGN_PROMPT, "work");
    page = result.page;
    const problem = extractProblem(result.text);
    if (problem) { state.problem = problem; state.problemAttempts = 0; state.watchdog = "design-problem"; save(state, `Design GPT reported: ${problem}`); await sleep(COOLDOWN_MS); continue; }
    state.lastResult = endsOk(result.text) ? "OK" : "completed";
    state.watchdog = "design-complete";
    save(state, "Design task/block complete; continuing automatically");
    await sleep(COOLDOWN_MS);
  }
}

main().catch((e) => { console.error("[DESIGN] FATAL", e?.stack || e); process.exit(1); });
