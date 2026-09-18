import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const INITIAL_CHAT_URL = process.env.DAVID_APP2_CHAT_URL || "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4";
let activeChatUrl = INITIAL_CHAT_URL;
const CDP_URL = process.env.DAVID_APP2_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_APP2_STATE_FILE || path.join(process.cwd(), ".david-app2-state.json");
const POLL_MS = Number(process.env.DAVID_APP2_POLL_MS || 800);
const START_TIMEOUT_MS = Number(process.env.DAVID_APP2_START_TIMEOUT_MS || 15000);
const STALL_MS = Number(process.env.DAVID_APP2_STALL_MS || 90000);
const COOLDOWN_MS = Number(process.env.DAVID_APP2_COOLDOWN_MS || 1200);
const MAX_RETRIES = Number(process.env.DAVID_APP2_MAX_RETRIES || 5);
const PROBLEM_PREFIX = "PROBLEM IN:";
const DONE_MARKER = "PROJECT_100_PERCENT_COMPLETE";
const RELAY_MARKER = "[DAVID_APP2_AUTOPILOT_V2]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (x) => createHash("sha256").update(String(x || "")).digest("hex");
function responseProgressed(previousHash, currentHash) {
  return Boolean(currentHash && currentHash !== previousHash);
}
function stallExpired(lastProgressAt, now = Date.now(), stallMs = STALL_MS) {
  return now - lastProgressAt > stallMs;
}
function conversationLimitText(text) {
  return /(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i.test(String(text || ""));
}
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}
function matchesActiveChat(url) {
  const u = String(url || "");
  if (activeChatUrl === "https://chatgpt.com/") return u === "https://chatgpt.com/" || u === "https://chatgpt.com";
  return u.startsWith(activeChatUrl);
}

const MASTER_PROMPT = `@GitHub @Vercel @Supabase

Работи автономно по DPP Autopilot в тази сесия до доказано 100% завършен production-ready продукт.

Основни правила:
- Използвай реалния source of truth docs/MASTER_AUTOPILOT_PLAN.md и реалното състояние на SoulFlameAdmin/DPPautopilot.
- GREEN само при реална implementation + приложим PASS тест + конкретно evidence.
- Прави реални промени чрез наличните конектори, тествай, поправяй и обновявай evidence.
- Не нарушавай dependency и не заобикаляй login/MFA/CAPTCHA/permissions.
- Външен blocker НЕ спира целия проект. Ако задача е BLOCKED само от quota/rate-limit/plan/billing/vendor credentials/legal sign-off/customer data/permission, запиши я BLOCKED с evidence и премини към най-ранната независима задача с изпълнени зависимости.
- Конкретно: F08 Vercel build-rate-limit може да остане BLOCKED. Не го върти отново във всеки цикъл. Докато F08 е блокиран, работи реално по D01-D14 в dependency order, после по други независими задачи.
- Ако D01 е RED, започни от D01 сега. Не се връщай към F08 освен ако има ново evidence, че лимитът е отпаднал.

Протокол:
- Никога не пиши DAVID_STOP.
- Ако текущият реален блок работа е завършен и доказан: последен ред OK
- PROBLEM IN използвай само за вътрешен технически дефект, който реално спира безопасната независима работа, или когато няма никаква друга dependency-safe задача.
- Когато всички задължителни точки са GREEN, тестовете PASS и final production acceptance е доказан: последен ред ${DONE_MARKER}

${RELAY_MARKER}`;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { turnsSent: 0, relayAttempts: 0, recoveryAttempt: 0, problemAttempts: 0, problem: null, deferredBlocker: null, watchdog: "boot", complete: false }; }
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
function isExternalBlocker(problem) {
  return /(vercel|build-rate-limit|rate limit|quota|hobby|billing|plan limit|netlify|github pages|vendor credential|credential|permission|legal sign-off|customer data|external access|production url|deployment capacity)/i.test(String(problem || ""));
}
function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nВътрешен технически проблем за поправка:\n${problem}\n\nОпит ${attempt}. Опитай сам безопасен fix, провери кода/логовете/config, тествай пак и запиши evidence. Не заобикаляй permissions/login/MFA/CAPTCHA.\n\nАко е оправено: OK\nАко същият вътрешен дефект реално още блокира всяка безопасна работа: ${PROBLEM_PREFIX} <точният проблем>\nАко целият план е доказано завършен: ${DONE_MARKER}\n\n${RELAY_MARKER}`;
}
function deferPrompt(problem, repeat = 1) {
  return `@GitHub @Vercel @Supabase\n\nВъншният blocker е записан и се ОТЛАГА, не го опитвай отново сега:\n${problem}\n\nТова НЕ е причина да спираш DPP Autopilot. F08 може да остане BLOCKED. Веднага отвори source of truth и изпълни най-ранната независима dependency-safe задача. За текущото състояние приоритетът е D01 -> D14. Ако D01 е RED, реализирай D01 сега, пусни приложимите тестове, запиши evidence/status и продължи. Това е defer опит ${repeat}.\n\nНе завършвай с PROBLEM IN само заради същия външен blocker. Ако завършиш реален блок работа: OK. PROBLEM IN е позволено само за нов вътрешен технически дефект, който спира всяка безопасна независима работа.\n\n${RELAY_MARKER}`;
}

async function ensurePage(context, current) {
  if (current && !current.isClosed()) {
    const currentUrl = current.url();
    if (matchesActiveChat(currentUrl)) return current;
    if (activeChatUrl === "https://chatgpt.com/" && currentUrl.startsWith("https://chatgpt.com/")) return current;
  }
  let page = activeChatUrl === "https://chatgpt.com/"
    ? null
    : context.pages().find((p) => !p.isClosed() && matchesActiveChat(p.url()));
  if (!page) page = await context.newPage();
  if (!matchesActiveChat(page.url())) {
    await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  return page;
}
async function conversationLimitReached(page) {
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
  save(state, `Conversation URL synced: ${u}`);
  console.log(`[APP2] Active conversation: ${u}`);
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
  const oldUrl = cleanConversationUrl(page?.url?.()) || page?.url?.() || activeChatUrl;
  state.previousChatUrl = oldUrl;
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = "conversation-rollover";
  activeChatUrl = "https://chatgpt.com/";
  state.chatUrl = activeChatUrl;
  save(state, `Conversation max length -> rollover #${state.rolloverCount}`);
  console.log(`[APP2] Conversation max length reached. Rolling over in SAME tab (#${state.rolloverCount})...`);

  if (!page || page.isClosed()) page = await ensurePage(context, null);
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await closeOldConversationTabs(context, oldUrl, page);
  await sleep(1200);
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
async function waitReady(context, page, state) {
  while (true) {
    page = await ensurePage(context, page);
    const u = page.url();
    if (u.includes("/login") || u.includes("/auth/")) { await sleep(1200); continue; }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      continue;
    }
    syncActiveChatUrl(page, state);
    if (await composer(page) || await latestAssistant(page)) return page;
    await sleep(POLL_MS);
  }
}
async function fillAndSend(page, text) {
  const c = await composer(page);
  if (!c) throw new Error("ChatGPT composer not found");
  try { await c.fill(text); } catch {
    await c.click();
    await c.evaluate((el, value) => {
      el.focus();
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.value = value;
      else el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    }, text);
  }
  await sleep(250);
  for (const s of ['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']) {
    try {
      const b = page.locator(s).last();
      if (await b.count() && await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click(); return; }
    } catch {}
  }
  await c.press("Enter");
}
async function forceStop(page) {
  const b = await stopButton(page);
  if (!b) return false;
  await b.click({ timeout: 3000 }).catch(() => {});
  await sleep(700);
  return true;
}
async function recoverActive(context, page, state, reason) {
  state.watchdog = `recover-${reason}`;
  state.recoveryAttempt = Number(state.recoveryAttempt || 0) + 1;
  save(state, `Recovery: ${reason}; stop and prepare clean retry`);
  console.log(`[APP2] Recovery ${reason}: STOP -> clean retry.`);
  await forceStop(page).catch(() => {});
  if (reason === "stalled-or-blank") {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(1500);
  }
  return waitReady(context, page, state);
}
async function waitStart(context, page, baseHash, state) {
  const end = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < end) {
    page = await waitReady(context, page, state);
    if (await interruptionVisible(page)) {
      page = await recoverActive(context, page, state, "connection-interrupted");
      return { page, started: false, recovered: true };
    }
    const pb = await platformBlock(page);
    if (pb) return { page, started: false, blocker: pb };
    if (await generating(page)) return { page, started: true };
    const t = await latestAssistant(page);
    if (t && hash(t) !== baseHash) return { page, started: true };
    await sleep(POLL_MS);
  }
  return { page, started: false };
}
async function waitComplete(context, page, baseHash, state) {
  let lastHash = baseHash;
  let lastProgressAt = Date.now();
  while (true) {
    page = await waitReady(context, page, state);
    if (await interruptionVisible(page)) return { page, retry: true, reason: "connection-interrupted" };
    const pb = await platformBlock(page);
    if (pb) return { page, retry: true, reason: pb };

    const t = await latestAssistant(page);
    const h = t ? hash(t) : null;
    const role = await latestRole(page);
    const isGenerating = await generating(page);

    if (responseProgressed(lastHash, h)) {
      lastHash = h;
      lastProgressAt = Date.now();
      state.watchdog = "gpt-writing";
      save(state, "GPT text progressed");
    }

    if (isGenerating) {
      state.watchdog = t && h !== baseHash ? "gpt-writing" : "gpt-thinking";
      save(state, state.watchdog === "gpt-writing" ? "GPT writing" : "GPT thinking");
      if (stallExpired(lastProgressAt)) return { page, retry: true, reason: "stalled-or-blank" };
      await sleep(POLL_MS);
      continue;
    }

    if (role === "assistant" && h && h !== baseHash) {
      const before = t;
      await sleep(1200);
      if (!await generating(page) && await latestRole(page) === "assistant" && (await latestAssistant(page)) === before) {
        return { page, retry: false, text: before, hash: h };
      }
    }

    if (stallExpired(lastProgressAt)) return { page, retry: true, reason: "stalled-or-blank" };
    await sleep(POLL_MS);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  for (let attempt = 1; ; attempt++) {
    page = await waitReady(context, page, state);
    const baseHash = hash(await latestAssistant(page));
    state.watchdog = `sending-${kind}`;
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    save(state, `${kind} attempt ${attempt}`);
    console.log(`[APP2] Sending ${kind} attempt ${attempt}.`);
    const outgoingPrompt = state.justRolledOver
      ? `AUTOMATIC CHAT ROLLOVER: The previous ChatGPT conversation reached its maximum length. Reconstruct the exact current project state from GitHub/source-of-truth/evidence and continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
      : prompt;
    await fillAndSend(page, outgoingPrompt);
    const start = await waitStart(context, page, baseHash, state);
    page = start.page;
    syncActiveChatUrl(page, state);
    if (start.blocker) {
      state.problem = `ChatGPT platform: ${start.blocker}`;
      state.watchdog = "platform-block";
      save(state, `Platform block ${start.blocker}`);
      await sleep(start.blocker === "human verification" ? 30000 : 15000);
      continue;
    }
    if (!start.started) {
      if (attempt % MAX_RETRIES === 0) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await sleep(2500);
      }
      continue;
    }
    state.turnsSent = Number(state.turnsSent || 0) + 1;
    state.recoveryAttempt = 0;
    save(state, `GPT started cycle ${state.turnsSent}`);
    const done = await waitComplete(context, page, baseHash, state);
    page = done.page;
    if (done.retry) {
      if (done.reason === "connection-interrupted" || done.reason === "stalled-or-blank") {
        page = await recoverActive(context, page, state, done.reason);
      } else {
        await sleep(10000);
      }
      continue;
    }
    state.lastAssistantHash = done.hash;
    if (state.justRolledOver) state.justRolledOver = false;
    syncActiveChatUrl(page, state);
    save(state, "Assistant response complete");
    return { page, text: done.text };
  }
}

async function main() {
  const { chromium } = await import("playwright-core");
  console.log(`[APP2] Connecting to shared Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 120000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error("No Chromium context on APP2 port");
  const state = loadState();
  activeChatUrl = state.chatUrl || INITIAL_CHAT_URL;
  let page = await waitReady(context, await ensurePage(context, null), state);
  syncActiveChatUrl(page, state);
  if (state.previousChatUrl) await closeOldConversationTabs(context, state.previousChatUrl, page);
  console.log(`[APP2] Session ready: ${page.url()}`);


  if (state.complete) {
    console.log(`[APP2] Already marked ${DONE_MARKER}.`);
    return;
  }
  if (state.problem && isExternalBlocker(state.problem)) {
    state.deferredBlocker = state.problem;
    state.problem = null;
    state.problemAttempts = 0;
  }
  state.watchdog = "autopilot-online";
  save(state, "APP2 autonomous worker online");
  console.log("[APP2] AUTOPILOT ON. External blockers are deferred; independent work continues.");

  let mode = state.deferredBlocker ? "defer" : (state.problem ? "fix" : "work");
  let deferRepeats = 0;

  while (!state.complete) {
    let prompt;
    if (mode === "fix") {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      prompt = fixPrompt(state.problem, state.problemAttempts);
    } else if (mode === "defer") {
      deferRepeats += 1;
      prompt = deferPrompt(state.deferredBlocker, deferRepeats);
    } else {
      prompt = MASTER_PROMPT;
    }

    const result = await runPrompt(context, page, state, prompt, mode);
    page = result.page;

    if (isDone(result.text)) {
      state.complete = true;
      state.problem = null;
      state.lastResult = DONE_MARKER;
      state.watchdog = "100-percent-complete";
      save(state, "Project complete");
      console.log(`[APP2] ${DONE_MARKER}`);
      break;
    }

    const problem = extractProblem(result.text);
    if (problem) {
      if (isExternalBlocker(problem)) {
        state.deferredBlocker = problem;
        state.problem = null;
        state.problemAttempts = 0;
        state.watchdog = "external-blocker-deferred";
        save(state, `Deferred external blocker: ${problem}`);
        console.log(`[APP2] DEFERRED EXTERNAL BLOCKER: ${problem}`);
        mode = "defer";
      } else {
        state.problem = problem;
        state.watchdog = "internal-problem";
        save(state, `Internal problem: ${problem}`);
        console.log(`[APP2] PROBLEM IN: ${problem}`);
        mode = "fix";
      }
      await sleep(COOLDOWN_MS);
      continue;
    }

    if (endsOk(result.text)) console.log("[APP2] Block OK -> next task.");
    else console.log("[APP2] Response complete -> continue master plan.");

    state.problem = null;
    state.problemAttempts = 0;
    state.lastResult = endsOk(result.text) ? "OK" : "completed";
    state.watchdog = "block-complete";
    save(state, "Continuing master plan automatically");
    mode = "work";
    deferRepeats = 0;
    await sleep(COOLDOWN_MS);
  }
}

function runSelfTest() {
  const h1 = hash("partial");
  const h2 = hash("partial plus");
  if (responseProgressed(h1, h1)) throw new Error("APP2 watchdog self-test: unchanged text must not count as progress");
  if (!responseProgressed(h1, h2)) throw new Error("APP2 watchdog self-test: changed assistant text must count as progress");
  if (stallExpired(1000, 1000 + STALL_MS)) throw new Error("APP2 watchdog self-test: exact stall threshold must not expire early");
  if (!stallExpired(1000, 1001 + STALL_MS)) throw new Error("APP2 watchdog self-test: stalled response must expire after threshold");
  if (/fillAndSend\s*\(/.test(recoverActive.toString())) throw new Error("APP2 watchdog self-test: recovery must not resend; outer retry owns sending");
  if (!conversationLimitText("Достигнахте максималната продължителност на този разговор, но можете да продължите да говорите, като започнете нов чат.")) throw new Error("APP2 rollover self-test: BG limit text not detected");
  if (!conversationLimitText("You've reached the maximum length for this conversation, but you can keep talking by starting a new chat.")) throw new Error("APP2 rollover self-test: EN limit text not detected");
  if (conversationLimitText("Normal assistant response")) throw new Error("APP2 rollover self-test: false positive");
  console.log("APP2_RESPONSE_WATCHDOG_SELF_TEST PASS progress=2 stall=2 recovery_single_send=1 rollover=3");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  main().catch((e) => {
    console.error("[APP2] FATAL", e?.stack || e);
    process.exit(1);
  });
}
