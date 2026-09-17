import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CHAT_URL = process.env.DAVID_APP2_CHAT_URL || "https://chatgpt.com/c/6aac1739-4ac0-83ed-92b9-4995d81fe124";
const CDP_URL = process.env.DAVID_APP2_CDP_URL || "http://127.0.0.1:9555";
const STATE_FILE = process.env.DAVID_APP2_STATE_FILE || path.join(process.cwd(), ".david-app2-state.json");
const POLL_MS = Number(process.env.DAVID_APP2_POLL_MS || 800);
const START_TIMEOUT_MS = Number(process.env.DAVID_APP2_START_TIMEOUT_MS || 15000);
const STALL_MS = Number(process.env.DAVID_APP2_STALL_MS || 90000);
const COOLDOWN_MS = Number(process.env.DAVID_APP2_COOLDOWN_MS || 1200);
const MAX_RETRIES = Number(process.env.DAVID_APP2_MAX_RETRIES || 5);
const PROBLEM_PREFIX = "PROBLEM IN:";
const DONE_MARKER = "PROJECT_100_PERCENT_COMPLETE";
const RELAY_MARKER = "[DAVID_APP2_AUTOPILOT_V1]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (x) => createHash("sha256").update(String(x || "")).digest("hex");

const MASTER_PROMPT = `@GitHub @Vercel @Supabase

Работи като автономен главен технически ръководител за ТОЧНО приложението/проекта, обсъждан в тази ChatGPT сесия. Целта е да го доведеш от реалното му текущо състояние до доказано 100% завършен production-ready продукт.

ПЪРВА ЗАДАЧА, ако още няма замразен master plan:
1. Установи кой е реалният GitHub repo, Vercel project/deployment и Supabase project от контекста на тази сесия и наличните конектори. Не гадай.
2. Одитирай реалното състояние на кода, deployment-а, базата, env/config, flows и тестовете.
3. Създай в repo-то docs/MASTER_AUTOPILOT_PLAN.md като source of truth от 0 -> 100%, с постоянни IDs, dependencies, acceptance criteria и evidence за всяка точка.
4. Планът трябва да включва поне: product scope, architecture, data model, auth/RBAC, core flows, APIs/integrations, frontend/UX, mobile/responsive, accessibility, validation/error states, security, privacy, observability, backups/recovery, migrations, performance, unit tests, integration tests, E2E tests, visual/responsive tests, cross-browser tests, load/reliability tests, CI/CD, staging/production verification и final acceptance.
5. Не маркирай нищо GREEN/готово само по предположение. GREEN = реална implementation + приложим тест + конкретно evidence.

СЛЕД ТОВА ИЗПЪЛНЯВАЙ ПЛАНА, НЕ САМО ГО ОПИСВАЙ:
- Във всеки цикъл вземи следващата незавършена зависима задача или логически свързан малък блок.
- Направи реалните промени чрез @GitHub, @Vercel и @Supabase, когато са приложими.
- Тествай. При fail поправи и пусни теста отново.
- Провери production/preview реално, когато задачата го изисква.
- Обнови master plan evidence/status само след доказателство.
- Не прескачай blocker, dependency или failed test.
- Не прави destructive/irreversible промени без необходимото разрешение; не заобикаляй CAPTCHA/MFA/login/permissions и не измисляй secrets/evidence.
- Ако първият подход не работи, опитай разумна безопасна алтернатива сам.
- Работи максимално стегнато и продължавай към следващото, без да чакаш излишно потвърждение.

ПРОТОКОЛ ЗА DAVID:
- Никога не пиши DAVID_STOP.
- Ако текущият блок е успешно реализиран и доказан, последният ред да е само: OK
- Ако остава реален нерешен blocker, последният ред да е: ${PROBLEM_PREFIX} <точно какво пречи>
- Преди PROBLEM IN опитай сам безопасните варианти за fix.
- Когато ВСИЧКИ точки от master plan са GREEN, всички задължителни тестове са PASS и production acceptance е доказан, последният ред да е само: ${DONE_MARKER}

${RELAY_MARKER}`;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { turnsSent: 0, relayAttempts: 0, recoveryAttempt: 0, problemAttempts: 0, problem: null, watchdog: "boot", complete: false }; }
}
function save(state, action) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
function lastLine(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return rows.at(-1) || "";
}
function extractProblem(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const idx = rows[i].toUpperCase().indexOf(PROBLEM_PREFIX);
    if (idx >= 0) return rows[i].slice(idx + PROBLEM_PREFIX.length).trim() || "Unknown blocker";
  }
  return null;
}
function endsOk(text) { return /^OK[.!]?$/i.test(lastLine(text)); }
function isDone(text) { return lastLine(text) === DONE_MARKER; }
function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nDAVID APP2 засече нерешен blocker:\n${problem}\n\nTRY TO MAKE THIS FIX YOURSELF NOW. Опит ${attempt}. Провери реалното състояние, логове, код, deployment и data/config и приложи безопасен fix или валидна алтернатива. Пусни приложимите тестове отново. Не измисляй evidence/secrets и не заобикаляй CAPTCHA/MFA/login/permissions.\n\nАко е оправено и доказано, последният ред: OK\nАко още е блокирано: ${PROBLEM_PREFIX} <точният оставащ проблем>\nАко след fix целият master plan вече е доказано 100%: ${DONE_MARKER}\n\n${RELAY_MARKER}`;
}

async function ensurePage(context, current) {
  if (current && !current.isClosed() && current.url().startsWith(CHAT_URL)) return current;
  let page = context.pages().find((p) => !p.isClosed() && p.url().startsWith(CHAT_URL));
  if (!page) page = await context.newPage();
  if (!page.url().startsWith(CHAT_URL)) await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  return page;
}
async function composer(page) {
  for (const s of ["#prompt-textarea", '[data-testid="prompt-textarea"]', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]']) {
    try {
      const x = page.locator(s).last();
      if (await x.count() && await x.isVisible().catch(() => false)) return x;
    } catch {}
  }
  return null;
}
async function latestAssistant(page) {
  try {
    const x = page.locator('[data-message-author-role="assistant"]');
    if (!await x.count()) return "";
    return (await x.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
}
async function latestRole(page) {
  try {
    const x = page.locator('[data-message-author-role="assistant"],[data-message-author-role="user"]');
    if (!await x.count()) return null;
    return await x.last().getAttribute("data-message-author-role");
  } catch { return null; }
}
async function stopButton(page) {
  for (const s of ['[data-testid="stop-button"]','button[aria-label*="Stop"]','button[aria-label*="stop"]','button[aria-label*="Спри"]','button:has-text("Stop generating")','button:has-text("Stop response")','button:has-text("Спри отговора")','button:has-text("Спри генерирането")']) {
    try {
      const x = page.locator(s).last();
      if (await x.count() && await x.isVisible().catch(() => false) && await x.isEnabled().catch(() => false)) return x;
    } catch {}
  }
  return null;
}
async function generating(page) { return Boolean(await stopButton(page)); }
async function interruptionVisible(page) {
  try {
    return await page.evaluate(() => {
      const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
      const re = /(връзката беше прекъсната|изчакване на пълния отговор|connection (?:was )?interrupted|waiting for (?:the )?full response)/i;
      for (const el of document.querySelectorAll("div,span,p")) {
        if (!visible(el) || el.closest('[data-message-author-role]')) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && t.length < 280 && re.test(t)) return true;
      }
      return false;
    });
  } catch { return false; }
}
async function platformBlock(page) {
  try {
    return await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="toast" i],[data-testid*="error" i]')) {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        if (!r.width || !r.height || s.display === "none" || s.visibility === "hidden" || el.closest('[data-message-author-role]')) continue;
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
    const u = page.url();
    if (u.includes("/login") || u.includes("/auth/")) { await sleep(1200); continue; }
    if (await composer(page) || await latestAssistant(page)) return page;
    await sleep(POLL_MS);
  }
}
async function fillAndSend(page, text) {
  const c = await composer(page);
  if (!c) throw new Error("ChatGPT composer not found");
  try { await c.fill(text); } catch {
    await c.click();
    await c.evaluate((el, value) => { el.focus(); if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.value = value; else el.textContent = value; el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value })); }, text);
  }
  await sleep(250);
  for (const s of ['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']) {
    try {
      const b = page.locator(s).last();
      if (await b.count() && await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click(); return "button"; }
    } catch {}
  }
  await c.press("Enter");
  return "enter";
}
async function forceStop(page) {
  const b = await stopButton(page);
  if (!b) return false;
  await b.click({ timeout: 3000 }).catch(() => {});
  await sleep(700);
  return true;
}
async function resendActive(context, page, state, activePrompt, reason) {
  state.watchdog = `recover-${reason}`;
  state.recoveryAttempt = Number(state.recoveryAttempt || 0) + 1;
  save(state, `Recovery: ${reason}; stop and resend active prompt`);
  console.log(`[APP2] Recovery ${reason}: STOP -> resend active prompt.`);
  await forceStop(page).catch(() => {});
  page = await waitReady(context, page);
  await fillAndSend(page, activePrompt);
  return page;
}
async function waitStart(context, page, baseHash, state, activePrompt) {
  const end = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < end) {
    page = await waitReady(context, page);
    if (await interruptionVisible(page)) { page = await resendActive(context, page, state, activePrompt, "connection-interrupted"); return { page, started: false, resent: true }; }
    const pb = await platformBlock(page);
    if (pb) return { page, started: false, blocker: pb };
    if (await generating(page)) return { page, started: true };
    const t = await latestAssistant(page);
    if (t && hash(t) !== baseHash) return { page, started: true };
    await sleep(POLL_MS);
  }
  return { page, started: false };
}
async function waitComplete(context, page, baseHash, state, activePrompt) {
  let lastHash = baseHash, lastActivity = Date.now();
  while (true) {
    page = await waitReady(context, page);
    if (await interruptionVisible(page)) return { page, retry: true, reason: "connection-interrupted" };
    const pb = await platformBlock(page);
    if (pb) return { page, retry: true, reason: pb };
    const t = await latestAssistant(page), h = t ? hash(t) : null;
    if (await generating(page)) { lastActivity = Date.now(); state.watchdog = "gpt-working"; save(state, "GPT thinking/generating"); await sleep(POLL_MS); continue; }
    if (await latestRole(page) === "assistant" && h && h !== baseHash) {
      if (h !== lastHash) { lastHash = h; lastActivity = Date.now(); state.watchdog = "gpt-writing"; save(state, "GPT writing"); }
      const before = t;
      await sleep(1200);
      if (!await generating(page) && await latestRole(page) === "assistant" && (await latestAssistant(page)) === before) return { page, retry: false, text: before, hash: h };
    }
    if (Date.now() - lastActivity > STALL_MS) return { page, retry: true, reason: "stalled-or-blank" };
    await sleep(POLL_MS);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  for (let attempt = 1; ; attempt++) {
    page = await waitReady(context, page);
    const baseHash = hash(await latestAssistant(page));
    state.watchdog = kind === "fix" ? "fixing-problem" : "sending-work";
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    save(state, `${kind} attempt ${attempt}`);
    console.log(`[APP2] Sending ${kind} attempt ${attempt}.`);
    await fillAndSend(page, prompt);
    const start = await waitStart(context, page, baseHash, state, prompt); page = start.page;
    if (start.blocker) {
      state.problem = `ChatGPT platform: ${start.blocker}`; state.watchdog = "platform-block"; save(state, `Platform block ${start.blocker}`);
      console.log(`[APP2] Platform block: ${start.blocker}`);
      await sleep(start.blocker === "human verification" ? 30000 : 15000);
      continue;
    }
    if (!start.started) {
      if (attempt % MAX_RETRIES === 0) { await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}); await sleep(2500); }
      continue;
    }
    state.turnsSent = Number(state.turnsSent || 0) + 1; state.recoveryAttempt = 0; save(state, `GPT started cycle ${state.turnsSent}`);
    const done = await waitComplete(context, page, baseHash, state, prompt); page = done.page;
    if (done.retry) {
      if (done.reason === "connection-interrupted" || done.reason === "stalled-or-blank") page = await resendActive(context, page, state, prompt, done.reason);
      else await sleep(10000);
      continue;
    }
    state.lastAssistantHash = done.hash; save(state, "Assistant response complete");
    return { page, text: done.text };
  }
}

async function main() {
  console.log(`[APP2] Connecting to dedicated Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No Chromium context on APP2 port");
  let page = await waitReady(context, await ensurePage(context, null));
  console.log(`[APP2] Session ready: ${page.url()}`);
  const state = loadState();
  if (state.complete) { console.log(`[APP2] Already marked ${DONE_MARKER}. Nothing to do.`); return; }
  state.watchdog = "autopilot-online"; save(state, "APP2 autonomous master-plan worker online");
  console.log(`[APP2] AUTOPILOT ON. Plan -> build -> test -> fix -> verify -> 100%.`);

  let mode = state.problem && !String(state.problem).startsWith("ChatGPT platform:") ? "fix" : "work";
  while (!state.complete) {
    const prompt = mode === "fix" ? fixPrompt(state.problem, Number(state.problemAttempts || 0) + 1) : MASTER_PROMPT;
    if (mode === "fix") state.problemAttempts = Number(state.problemAttempts || 0) + 1;
    const result = await runPrompt(context, page, state, prompt, mode); page = result.page;

    if (isDone(result.text)) {
      state.complete = true; state.problem = null; state.lastResult = DONE_MARKER; state.watchdog = "100-percent-complete"; save(state, "Project master plan completed and final acceptance reported");
      console.log(`[APP2] ${DONE_MARKER}`);
      break;
    }

    const problem = extractProblem(result.text);
    if (problem) {
      state.problem = problem; state.watchdog = "problem-detected"; save(state, `PROBLEM IN: ${problem}`);
      console.log(`[APP2] PROBLEM IN: ${problem}`);
      mode = "fix";
      await sleep(COOLDOWN_MS);
      continue;
    }

    if (endsOk(result.text)) console.log("[APP2] Block OK -> next dependency/task.");
    else console.log("[APP2] Response complete -> continue master plan.");
    state.problem = null; state.problemAttempts = 0; state.lastResult = endsOk(result.text) ? "OK" : "completed"; state.watchdog = "block-complete"; save(state, "Continuing master plan automatically");
    mode = "work";
    await sleep(COOLDOWN_MS);
  }
}

main().catch((e) => { console.error("[APP2] FATAL", e?.stack || e); process.exit(1); });
