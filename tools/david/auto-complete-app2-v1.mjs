import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { waitForGlobalSendPermit, reportRateLimit, reportProbeSuccess, markGlobalSendStarted } from "./chatgpt-rate-limit-coordinator.mjs";
import { CHATGPT_ROOT, rotateOwnedChatPage } from "./chatgpt-session-rotation.mjs";
import { ensureChatGptEffortMode } from "./chatgpt-effort-mode.mjs";
import { sendPromptVerified } from "./chatgpt-send-ack.mjs";

const EFFORT_MODE = String(process.env.DAVID_PROJECT_EFFORT_MODE || "medium").toLowerCase();

const INITIAL_CHAT_URL = process.env.DAVID_APP2_CHAT_URL || "https://chatgpt.com/c/6aac2dbb-3ff4-83eb-aaac-ab791d3f87b4";
const FRESH_SESSION_ON_START = process.env.DAVID_FRESH_SESSIONS_ON_START === "1";
let activeChatUrl = FRESH_SESSION_ON_START ? CHATGPT_ROOT : INITIAL_CHAT_URL;
const CDP_URL = process.env.DAVID_APP2_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_APP2_STATE_FILE || path.join(process.cwd(), ".david-app2-state.json");
const POLL_MS = Number(process.env.DAVID_APP2_POLL_MS || 800);
const START_TIMEOUT_MS = Number(process.env.DAVID_APP2_START_TIMEOUT_MS || 60000);
const STALL_MS = Number(process.env.DAVID_APP2_STALL_MS || 600000);
const COOLDOWN_MS = Number(process.env.DAVID_APP2_COOLDOWN_MS || 1200);
const MAX_RETRIES = Number(process.env.DAVID_APP2_MAX_RETRIES || 5);
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_STABLE_SAMPLES = Number(process.env.DAVID_COMPLETE_STABLE_SAMPLES || 5);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const SEMANTIC_TERMINAL_QUIET_MS = Number(process.env.DAVID_SEMANTIC_TERMINAL_QUIET_MS || 15000);
const PROBLEM_PREFIX = "PROBLEM IN:";
const DONE_MARKER = "PROJECT_100_PERCENT_COMPLETE";
const RELAY_MARKER = "[DAVID_APP2_AUTOPILOT_V2]";
const TAB_NAME = "DAVID_APP2_MANAGED_V1";
const PENDING_TAB_NAME = "DAVID_APP2_PENDING_V1";
const ORCHESTRATOR_LAW = `
DAVID ORCHESTRATOR IMMUTABILITY LAW:
- During normal SYSTEM/DESIGN/DPP/APK project work, NEVER modify the DAVID infrastructure files in SoulFlameAdmin/enchev-auctions:
  tools/david/*, START_DAVID_ALL.ps1, STOP_DAVID_ALL_CLEAN.ps1, RESTART_DAVID_ALL_CLEAN.ps1, RESTART_DAVID_ALL.cmd.
- Those files may be changed only when the current user task explicitly requests DAVID infrastructure/worker/supervisor maintenance.
- Do not revert, rewrite, format, regenerate or "clean up" those protected files incidentally.
`;
const DEPLOY_LAW = `
DAVID VERCEL DEPLOY LAW:
- Before ANY Vercel create/update/redeploy, claim the global Supabase lease:
  select public.david_claim_vercel_deploy('DPP_APP2','dpp-autopilot',<commit_sha_or_null>,900);
- granted=false => DO NOT deploy; continue dependency-safe non-deploy work.
- granted=true => mark deploying, perform exactly one intended deployment, then release with public.david_release_vercel_deploy('DPP_APP2',<success>,<detail_json>).
- Record quota/rate-limit backoff only when Vercel gives a real retry time. Never invent one.
`;
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

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}

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
function endsOk(text) { return /^OK$/i.test(lastLine(text)); }
function humanTerminalGate(text) {
  return /(captcha|verify you are human|mfa|two-factor|2fa|log in|login required|sign in|permission required|authorization required|approve access|manual approval|потвърдете, че сте човек|влезте|вход.*необходим|двуфактор|разрешение.*необходимо|ръчно одобрение)/i.test(String(text || ""));
}
function semanticTerminalCandidate(text) {
  const value = String(text || "").trim();
  if (value.length < 40 || humanTerminalGate(value)) return false;
  if (/(still running|in progress|queued|pending|waiting for|please wait|will continue|i['’]ll continue|not complete|not finished|still working|още се изпълнява|в процес|изчаквам|чакам|ще продължа|не е завършен|не е готов)/i.test(value)) return false;
  if (/(tests?\s+(?:are\s+)?fail(?:ed|ing)|build\s+fail(?:ed|ure)|workflow\s+fail(?:ed|ure)|ci\s+fail(?:ed|ure)|тест(?:ът|овете)?\s+.*неуспеш|билд.*неуспеш)/i.test(value)) return false;
  return /(\bPASS\b|\bSUCCESS\b|\bGREEN\b|completed|complete|done|finished|implemented|merged|commit|pull request|artifact|evidence|tests?|готов|завърш|успеш|реализир|обединен|комит|доказател)/i.test(value);
}
async function waitForTerminalMarker(page, state) {
  let semanticText = "";
  let semanticSince = 0;
  while (true) {
    const text = await latestAssistant(page);
    const problem = extractProblem(text);
    if (problem) {
      state.lastTerminalMode = "problem";
      return { type: "problem", text, problem };
    }
    if (isDone(text)) { state.lastTerminalMode = "done"; return { type: "done", text }; }
    if (endsOk(text)) {
      state.lastTerminalMode = "ok";
      return { type: "ok", text };
    }

    const humanGate = humanTerminalGate(text);
    const semanticReady = semanticTerminalCandidate(text) && !await generating(page);
    if (semanticReady) {
      if (text !== semanticText) {
        semanticText = text;
        semanticSince = Date.now();
      } else if (Date.now() - semanticSince >= SEMANTIC_TERMINAL_QUIET_MS) {
        state.lastTerminalMode = "semantic";
        state.lastResult = "SEMANTIC_COMPLETE";
        save(state, "Stable response accepted by semantic terminal fallback; no exact OK required");
        console.log("[APP2] Stable semantic completion accepted. NO duplicate prompt.");
        return { type: "ok", text, semantic: true };
      }
    } else {
      semanticText = "";
      semanticSince = 0;
    }

    state.watchdog = humanGate ? "human-terminal-gate" : "awaiting-terminal-evidence";
    state.lastResult = humanGate ? "human-action-required" : "waiting-for-terminal-evidence";
    save(state, humanGate
      ? "Human gate detected in assistant response; autonomy paused safely"
      : "Waiting for exact OK/PROBLEM IN or conservative stable semantic completion");
    console.log("[APP2] Waiting for terminal evidence. NO NEW PROMPT.");
    await sleep(3000);
  }
}
function isDone(text) { return lastLine(text) === DONE_MARKER; }
function isExternalBlocker(problem) {
  return /(vercel|build-rate-limit|quota|hobby|billing|plan limit|netlify|github pages|vendor credential|credential|permission|legal sign-off|customer data|external access|production url|deployment capacity)/i.test(String(problem || ""));
}
function blockerKey(problem) {
  return String(problem || "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-zа-я0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/опит\s*\d+|attempt\s*\d+/g, "")
    .trim();
}
function sameBlocker(a, b) {
  const x = blockerKey(a), y = blockerKey(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nВътрешен технически проблем за поправка:\n${problem}\n\nОпит ${attempt}. Опитай сам безопасен fix, провери кода/логовете/config, тествай пак и запиши evidence. Не заобикаляй permissions/login/MFA/CAPTCHA.\n\nАко е оправено: OK\nАко същият вътрешен дефект реално още блокира всяка безопасна работа: ${PROBLEM_PREFIX} <точният проблем>\nАко целият план е доказано завършен: ${DONE_MARKER}\n\n${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}\n\n${RELAY_MARKER}`;
}
function deferPrompt(problem, repeat = 1) {
  return `@GitHub @Vercel @Supabase\n\nВъншният blocker е записан и се ОТЛАГА, не го опитвай отново сега:\n${problem}\n\nТова НЕ е причина да спираш DPP Autopilot. F08 може да остане BLOCKED. Веднага отвори source of truth и изпълни най-ранната независима dependency-safe задача. За текущото състояние приоритетът е D01 -> D14. Ако D01 е RED, реализирай D01 сега, пусни приложимите тестове, запиши evidence/status и продължи. Това е defer опит ${repeat}.\n\nНе завършвай с PROBLEM IN само заради същия външен blocker. Ако завършиш реален блок работа: OK. PROBLEM IN е позволено само за нов вътрешен технически дефект, който спира всяка безопасна независима работа.\n\n${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}\n\n${RELAY_MARKER}`;
}

async function pageTag(page) {
  try { return await page.evaluate(() => window.name || ""); }
  catch { return ""; }
}

async function setPageTag(page, value) {
  try { await page.evaluate((v) => { window.name = v; }, value); }
  catch {}
}

async function findTaggedPage(context, names = [TAB_NAME, PENDING_TAB_NAME]) {
  for (const page of [...context.pages()].reverse()) {
    if (!page || page.isClosed()) continue;
    const tag = await pageTag(page);
    if (names.includes(tag)) return page;
  }
  return null;
}

async function ensurePage(context, current) {
  if (current && !current.isClosed()) {
    const currentUrl = current.url();
    if (matchesActiveChat(currentUrl) || (activeChatUrl === "https://chatgpt.com/" && currentUrl.startsWith("https://chatgpt.com/"))) {
      await setPageTag(current, TAB_NAME);
      return current;
    }
  }

  const tagged = await findTaggedPage(context);
  if (tagged) {
    await setPageTag(tagged, TAB_NAME);
    return tagged;
  }

  let page = activeChatUrl === "https://chatgpt.com/"
    ? null
    : context.pages().find((p) => !p.isClosed() && matchesActiveChat(p.url()));

  if (!page) {
    page = await context.newPage();
    await setPageTag(page, activeChatUrl === "https://chatgpt.com/" ? PENDING_TAB_NAME : TAB_NAME);
  }

  if (!matchesActiveChat(page.url())) {
    await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  await setPageTag(page, TAB_NAME);
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
  void setPageTag(page, TAB_NAME);
  state.lastConversationUrl = u;
  const history = Array.isArray(state.rolloverHistory) ? state.rolloverHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i]?.newUrl) {
      history[i].newUrl = u;
      history[i].newChatConfirmedAt = new Date().toISOString();
      break;
    }
  }
  state.rolloverHistory = history.slice(-50);
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

async function rolloverConversation(context, page, state, reason = "conversation-limit") {
  const oldUrl = cleanConversationUrl(page?.url?.()) || page?.url?.() || activeChatUrl;
  if (!page || page.isClosed()) page = await ensurePage(context, null);
  if (!page || page.isClosed()) throw new Error("APP2 rollover requires one owned ChatGPT tab");

  state.previousChatUrl = oldUrl;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), oldUrl])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = reason === "final-ok" ? "session-rotate-after-ok" : "conversation-rollover";

  const event = {
    number: state.rolloverCount,
    reason,
    oldUrl: cleanConversationUrl(oldUrl) || oldUrl,
    newUrl: null,
    startedAt: new Date().toISOString(),
    oldTabReusedAt: null
  };
  state.rolloverHistory = [...(Array.isArray(state.rolloverHistory) ? state.rolloverHistory : []), event].slice(-50);

  activeChatUrl = CHATGPT_ROOT;
  state.chatUrl = activeChatUrl;
  save(state, `APP2 session rotation #${state.rolloverCount} (${reason}); reusing owned tab only`);

  const rotated = await rotateOwnedChatPage({
    page,
    getComposer: composer,
    setPageTag,
    pendingTag: PENDING_TAB_NAME,
    managedTag: TAB_NAME,
    onWait: async ({ phase, attempt, url }) => {
      state.watchdog = phase === "auth-wait" ? "session-rotate-auth-wait" : "session-rotate-wait";
      save(state, `APP2 session rotation waiting phase=${phase} attempt=${attempt} url=${url || "unknown"}; NO NEW TAB`);
    }
  });
  if (!rotated.ok) throw new Error(`APP2 same-tab session rotation failed: ${rotated.reason}`);

  event.oldTabReusedAt = new Date().toISOString();
  await closeOldConversationTabs(context, oldUrl, page);
  save(state, `APP2 fresh ChatGPT session ready in SAME TAB #${state.rolloverCount}; reason=${reason}`);
  console.log(`[APP2] Fresh ChatGPT session ready in SAME TAB #${state.rolloverCount}; reason=${reason}. NO EXTRA TAB.`);
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
  for (const s of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]','button[aria-label*="stop"]','button[aria-label*="Спри"]','button:has-text("Stop generating")','button:has-text("Stop thinking")','button:has-text("Stop response")','button:has-text("Спри отговора")','button:has-text("Спри генерирането")','button:has-text("Спри да мисли")']) {
    try {
      const x = page.locator(s).last();
      if (await x.count() && await x.isVisible().catch(() => false) && await x.isEnabled().catch(() => false)) return x;
    } catch {}
  }
  return null;
}
async function generating(page) {
  if (await stopButton(page)) return true;
  try {
    return await page.evaluate(() => {
      const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
      const last = turns.at(-1);
      if (!last || !last.querySelector('[data-message-author-role="assistant"]')) return false;
      const finalAction = last.querySelector('button[aria-label*="Copy" i],button[aria-label*="Share" i],button[aria-label*="Regenerate" i],button[data-testid*="copy" i],button[data-testid*="thumb" i]');
      if (finalAction) return false;
      const text = (last.textContent || "").replace(/\s+/g, " ").trim();
      return /(thinking|мислене|мисли|working|работи|calling tool|called tool|tool call|извикан инструмент|извиква инструмент|searching|търсене|browsing|преглежда|analyzing|анализира)/i.test(text);
    });
  } catch { return false; }
}
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
        if (/изпращането на съобщението изтече по време|message sending timed out|sending the message timed out|message send timed out/.test(t)) return "send timeout";
        if (/network error|something went wrong|нещо се обърка/.test(t)) return "network error";
      }
      return null;
    });
  } catch { return null; }
}
async function waitSendTimeoutRecovery(context, page, state) {
  state.problem = null;
  state.watchdog = "send-timeout-wait-guard";
  save(state, "Message send timeout detected; central guard owns bounded Retry. APP2 will not duplicate-send.");
  console.log("[APP2] SEND TIMEOUT: waiting for central guard. NO DUPLICATE RESEND.");
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    await sleep(1000);
    page = await ensurePage(context, page);
    if (await generating(page)) {
      state.watchdog = "gpt-thinking";
      save(state, "Send-timeout retry accepted; GPT active");
      return page;
    }
    const pb = await platformBlock(page);
    if (pb !== "send timeout") {
      state.watchdog = "send-timeout-recovered";
      save(state, "Message send timeout cleared by central guard");
      return page;
    }
  }
  console.log("[APP2] SEND TIMEOUT still visible after 60s. Refreshing view only; no worker resend.");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(2500);
  return page;
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
    if (await composer(page) || await latestAssistant(page)) {
      const effort = await ensureChatGptEffortMode(page, EFFORT_MODE).catch(() => ({ ok: false }));
      if (effort?.changed) console.log("[APP2] ChatGPT effort forced to "+EFFORT_MODE+".");
      return page;
    }
    await sleep(POLL_MS);
  }
}
async function fillAndSend(page, text, state) {
  state.lastPromptPreview = String(text || "").replace(/\s+/g, " ").trim().slice(0, 220);
  state.lastSendAck = false;
  state.lastSendStatus = "PREPARING";
  state.lastSendError = null;
  save(state);

  return sendPromptVerified(page, text, {
    worker: "APP2",
    ackTimeoutMs: 5000,
    onEvent: (stage, info) => {
      state.lastSendStatus = stage;
      state.lastSendUpdatedAt = info.at || new Date().toISOString();
      state.lastSendAttempt = Number(info.attempt || 0);
      if (info.method) state.lastSendMethod = info.method;
      if (info.signal) state.lastSendSignal = info.signal;
      if (info.error) state.lastSendError = info.error;
      if (stage === "ACK") {
        state.lastSendAck = true;
        state.lastSendAt = info.at || new Date().toISOString();
      } else if (stage === "FAILED") {
        state.lastSendAck = false;
      }
      save(state);
    }
  });
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
  if (reason === "connection-interrupted" && await generating(page)) {
    state.watchdog = "interruption-transient-active";
    save(state, "Interruption-like UI while GPT still active; recovery cancelled");
    console.log("[APP2] Interruption-like UI while GPT is active. NO STOP / NO RESEND.");
    return waitReady(context, page, state);
  }
  console.log(`[APP2] Recovery ${reason}: clean retry.`);
  if (reason !== "connection-interrupted") await forceStop(page).catch(() => {});
  if (reason === "stalled-or-blank") {
    state.watchdog = "stalled-resend";
    save(state, "LAW: GPT stopped thinking/writing -> resend before refresh");
    console.log("[APP2] LAW: stopped thinking/writing -> RESEND.");
    await sleep(700);
  }
  return waitReady(context, page, state);
}
async function waitStart(context, page, baseHash, state) {
  const end = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < end) {
    page = await waitReady(context, page, state);
    if (await interruptionVisible(page) && !await generating(page)) {
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
  let stableHash = null;
  let stableSince = 0;
  let stableSamples = 0;

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
      stableHash = h;
      stableSince = Date.now();
      stableSamples = 1;
      state.watchdog = "gpt-writing";
      save(state, "GPT text progressed");
    }

    if (isGenerating) {
      stableHash = null;
      stableSince = 0;
      stableSamples = 0;
      state.watchdog = t && h !== baseHash ? "gpt-writing" : "gpt-thinking";
      save(state, state.watchdog === "gpt-writing" ? "GPT writing" : "GPT thinking");
      if (stallExpired(lastProgressAt)) return { page, retry: true, reason: "stalled-or-blank" };
      await sleep(POLL_MS);
      continue;
    }

    if (role === "assistant" && h && h !== baseHash) {
      if (h !== stableHash) {
        stableHash = h;
        stableSince = Date.now();
        stableSamples = 1;
      } else {
        stableSamples += 1;
      }

      state.watchdog = "gpt-settling";
      save(state, `GPT quiet completion check ${stableSamples}/${COMPLETE_STABLE_SAMPLES}`);

      if (
        stableSamples >= COMPLETE_STABLE_SAMPLES &&
        Date.now() - stableSince >= COMPLETE_QUIET_MS &&
        !await generating(page) &&
        await latestRole(page) === "assistant"
      ) {
        const finalText = await latestAssistant(page);
        const finalHash = finalText ? hash(finalText) : null;
        if (finalHash && finalHash === stableHash) {
          return { page, retry: false, text: finalText, hash: finalHash };
        }
      }
    } else {
      stableHash = null;
      stableSince = 0;
      stableSamples = 0;
    }

    if (stallExpired(lastProgressAt)) return { page, retry: true, reason: "stalled-or-blank" };
    await sleep(COMPLETE_SAMPLE_MS);
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
      ? state.freshStartPending
        ? `AUTOMATIC FRESH RESTART HANDOFF: DAVID restarted cleanly into a new APP2/DPP ChatGPT conversation. Reconstruct the exact current project state from GitHub/source-of-truth/evidence and continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
        : `AUTOMATIC CHAT ROLLOVER: The previous ChatGPT conversation reached its maximum length. Reconstruct the exact current project state from GitHub/source-of-truth/evidence and continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
      : prompt;
    const permit = await waitForGlobalSendPermit("APP2", async (decision) => {
      state.watchdog = "global-rate-limit-wait";
      state.problem = null;
      state.problemRetryAt = decision.state?.blockedUntil || decision.state?.probeLeaseUntil || null;
      save(state, `GLOBAL RATE LIMIT WAIT mode=${decision.mode}; owner=${decision.state?.probeOwner || "none"}`);
    });
    if (/ChatGPT platform: (?:global )?rate limit/i.test(String(state.problem || ""))) {
      state.problem = null;
      delete state.problemRetryAt;
      state.watchdog = "app2-send-permit";
      save(state, "ChatGPT platform rate-limit wait cleared by global coordinator; no project defer relay");
    }
    if (permit.mode === "probe") {
      state.watchdog = "global-rate-limit-probe";
      save(state, "APP2 owns the single post-cooldown probe send; no refresh required");
    }
    await fillAndSend(page, outgoingPrompt, state);
    await markGlobalSendStarted("APP2");
    const start = await waitStart(context, page, baseHash, state);
    page = start.page;
    syncActiveChatUrl(page, state);
    if (start.blocker) {
      if (start.blocker === "send timeout") {
        page = await waitSendTimeoutRecovery(context, page, state);
        const recoveredStart = await waitStart(context, page, baseHash, state);
        page = recoveredStart.page;
        if (recoveredStart.started) {
          state.turnsSent = Number(state.turnsSent || 0) + 1;
          state.recoveryAttempt = 0;
          save(state, `GPT started cycle ${state.turnsSent} after send-timeout recovery`);
          const doneAfterTimeout = await waitComplete(context, page, baseHash, state);
          page = doneAfterTimeout.page;
          if (!doneAfterTimeout.retry) {
            state.lastAssistantHash = doneAfterTimeout.hash;
            if (state.justRolledOver) state.justRolledOver = false;
            if (state.freshStartPending) state.freshStartPending = false;
            await reportProbeSuccess("APP2");
            delete state.problemRetryAt;
            return { page, text: doneAfterTimeout.text };
          }
        }
        continue;
      }
      if (start.blocker === "rate limit") {
        const rl = await reportRateLimit("APP2", "ChatGPT UI/start: rate limit");
        state.problem = null;
        state.problemRetryAt = rl.blockedUntil;
        state.watchdog = "global-rate-limit-wait";
        save(state, `GLOBAL RATE LIMIT from APP2 start; stage=${rl.stage} until=${rl.blockedUntil}`);
        await sleep(1000);
        continue;
      }
      state.problem = `ChatGPT platform: ${start.blocker}`;
      state.watchdog = "platform-block";
      save(state, `Platform block ${start.blocker}`);
      await sleep(start.blocker === "human verification" ? 30000 : 15000);
      continue;
    }
    if (!start.started) {
      state.watchdog = "no-thinking-grace";
      save(state, "GPT did not start yet; WAIT 30s and verify same turn before any refresh");
      console.log("[APP2] No start yet -> WAIT 30s, verify same turn. NO REFRESH.");
      await sleep(30000);
      const graceStart = await waitStart(context, page, baseHash, state);
      page = graceStart.page;
      if (graceStart.blocker) {
        if (graceStart.blocker === "rate limit") {
          const rl = await reportRateLimit("APP2", "ChatGPT UI/grace: rate limit");
          state.problem = null;
          state.problemRetryAt = rl.blockedUntil;
          state.watchdog = "global-rate-limit-wait";
          save(state, `GLOBAL RATE LIMIT from APP2 grace; stage=${rl.stage} until=${rl.blockedUntil}`);
          await sleep(1000);
          continue;
        }
        state.problem = `ChatGPT platform: ${graceStart.blocker}`;
        state.watchdog = "platform-block";
        save(state, `Platform block during APP2 grace: ${graceStart.blocker}`);
        await sleep(graceStart.blocker === "human verification" ? 30000 : 15000);
        continue;
      }
      if (!graceStart.started) {
        state.watchdog = "no-thinking-bounded-refresh";
        save(state, "GPT still inactive after extended grace -> one bounded refresh");
        console.log("[APP2] Still inactive after grace -> one bounded REFRESH.");
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await sleep(1800);
        continue;
      }
    }
    state.turnsSent = Number(state.turnsSent || 0) + 1;
    state.recoveryAttempt = 0;
    save(state, `GPT started cycle ${state.turnsSent}`);
    const done = await waitComplete(context, page, baseHash, state);
    page = done.page;
    if (done.retry) {
      if (done.reason === "send timeout") {
        page = await waitSendTimeoutRecovery(context, page, state);
      } else if (done.reason === "connection-interrupted" || done.reason === "stalled-or-blank") {
        page = await recoverActive(context, page, state, done.reason);
      } else if (done.reason === "rate limit") {
        const rl = await reportRateLimit("APP2", "ChatGPT UI/completion: rate limit");
        state.problem = null;
        state.problemRetryAt = rl.blockedUntil;
        state.watchdog = "global-rate-limit-wait";
        save(state, `GLOBAL RATE LIMIT during APP2 completion; stage=${rl.stage} until=${rl.blockedUntil}; NO REFRESH`);
        await sleep(1000);
      } else if (done.reason === "human verification") {
        state.problem = "ChatGPT platform: human verification";
        state.watchdog = "human-blocked";
        save(state, "APP2 waiting for human verification; NO REFRESH / NO BYPASS");
        await sleep(30000);
      } else {
        await sleep(10000);
      }
      continue;
    }
    state.lastAssistantHash = done.hash;
    if (state.justRolledOver) state.justRolledOver = false;
    if (state.freshStartPending) state.freshStartPending = false;
    syncActiveChatUrl(page, state);
    await reportProbeSuccess("APP2");
    delete state.problemRetryAt;
    save(state, "Assistant response complete");
    return { page, text: done.text };
  }
}

async function main() {
  const { chromium } = await import("playwright-core");
  console.log(`[APP2] Connecting to shared Edge CDP ${CDP_URL}`);
  let browser = null;
  let context = null;
  while (!context) {
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 120000 });
      context = browser.contexts()[0] || null;
      if (!context) throw new Error("No Chromium context on APP2 port");
    } catch (error) {
      console.log(`[APP2] CDP not ready: ${error?.message || error}. WAIT 5s -> reconnect. Worker stays alive.`);
      browser = null;
      context = null;
      await sleep(5000);
    }
  }
  const state = loadState();
  if (/ChatGPT platform: (?:global )?rate limit/i.test(String(state.problem || ""))) {
    state.problem = null;
    state.problemAttempts = 0;
    delete state.problemRetryAt;
    state.watchdog = "global-rate-limit-state-sanitized";
    save(state, "Cleared stale ChatGPT rate-limit problem from APP2 project state; coordinator owns cooldown");
  }
  if (FRESH_SESSION_ON_START) {
    state.previousChatUrl = cleanConversationUrl(state.chatUrl) || state.previousChatUrl || null;
    state.chatUrl = CHATGPT_ROOT;
    state.pendingNewChat = true;
    state.justRolledOver = true;
    state.freshStartPending = true;
    state.watchdog = "fresh-session-boot";
    activeChatUrl = CHATGPT_ROOT;
    save(state, "FRESH SESSION BOOT: APP2 old chat URL ignored; project state preserved");
  } else {
    activeChatUrl = state.chatUrl || INITIAL_CHAT_URL;
  }
  let page = await waitReady(context, await ensurePage(context, null), state);
  syncActiveChatUrl(page, state);
  if (state.previousChatUrl) await closeOldConversationTabs(context, state.previousChatUrl, page);
  console.log(`[APP2] Session ready: ${page.url()}`);


  if (state.complete) {
    console.log(`[APP2] Already marked ${DONE_MARKER}.`);
    return;
  }
  if (state.problem && isExternalBlocker(state.problem)) {
    const sameAsRecorded = sameBlocker(state.deferredBlocker, state.problem);
    if (!sameAsRecorded) state.deferredBlockerAcknowledged = false;
    state.deferredBlocker = state.problem;
    state.problem = null;
    state.problemAttempts = 0;
  }
  state.watchdog = "autopilot-online";
  save(state, "APP2 autonomous worker online");
  console.log("[APP2] AUTOPILOT ON. External blockers are deferred; independent work continues.");

  let mode = state.deferredBlocker && !state.deferredBlockerAcknowledged ? "defer" : (state.problem ? "fix" : "work");
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
        const repeatedCurrentDefer = mode === "defer" && sameBlocker(state.deferredBlocker, problem);
        const alreadyDeferred = Boolean(state.deferredBlockerAcknowledged) && sameBlocker(state.deferredBlocker, problem);

        if (repeatedCurrentDefer || alreadyDeferred) {
          state.deferredBlocker = state.deferredBlocker || problem;
          state.deferredBlockerAcknowledged = true;
          state.problem = null;
          state.problemAttempts = 0;
          state.watchdog = "external-blocker-already-deferred";
          save(state, `External blocker already deferred; forcing WORK mode: ${problem}`);
          console.log(`[APP2] BLOCKER ALREADY DEFERRED -> WORK MODE: ${problem}`);
          mode = "work";
          deferRepeats = 0;
        } else {
          state.deferredBlocker = problem;
          state.deferredBlockerAcknowledged = false;
          state.problem = null;
          state.problemAttempts = 0;
          state.watchdog = "external-blocker-deferred";
          save(state, `Deferred new external blocker once: ${problem}`);
          console.log(`[APP2] NEW EXTERNAL BLOCKER -> ONE DEFER RELAY: ${problem}`);
          mode = "defer";
        }
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

    if (!endsOk(result.text)) {
      const terminal = await waitForTerminalMarker(page, state);
      if (terminal.type === "done") {
        state.complete = true;
        state.problem = null;
        state.lastResult = DONE_MARKER;
        state.watchdog = "100-percent-complete";
        save(state, "Project complete after terminal marker wait");
        console.log(`[APP2] ${DONE_MARKER}`);
        break;
      }
      if (terminal.type === "problem") {
        const problem2 = terminal.problem;
        if (isExternalBlocker(problem2)) {
          const repeatedCurrentDefer = mode === "defer" && sameBlocker(state.deferredBlocker, problem2);
          const alreadyDeferred = Boolean(state.deferredBlockerAcknowledged) && sameBlocker(state.deferredBlocker, problem2);

          if (repeatedCurrentDefer || alreadyDeferred) {
            state.deferredBlocker = state.deferredBlocker || problem2;
            state.deferredBlockerAcknowledged = true;
            state.problem = null;
            state.problemAttempts = 0;
            state.watchdog = "external-blocker-already-deferred";
            mode = "work";
            deferRepeats = 0;
            save(state, `Terminal external blocker already deferred; forcing WORK mode: ${problem2}`);
          } else {
            state.deferredBlocker = problem2;
            state.deferredBlockerAcknowledged = false;
            state.problem = null;
            state.problemAttempts = 0;
            state.watchdog = "external-blocker-deferred";
            mode = "defer";
            save(state, `Terminal new external blocker deferred once: ${problem2}`);
          }
        } else {
          state.problem = problem2;
          state.watchdog = "internal-problem";
          mode = "fix";
        }
        save(state, `Terminal marker became PROBLEM IN: ${problem2}`);
        continue;
      }
    }

    console.log("[APP2] Final OK received. NEXT prompt allowed.");
    state.problem = null;
    state.problemAttempts = 0;
    state.lastResult = "OK";
    if (mode === "defer") {
      state.deferredBlockerAcknowledged = true;
      state.watchdog = "external-blocker-deferred-once";
      save(state, "One defer relay completed; forcing WORK mode from now on for the same blocker");
    } else {
      state.watchdog = "block-complete";
      save(state, "Final OK received; continuing master plan");
    }
    mode = "work";
    deferRepeats = 0;
    state.nextTaskAt = new Date().toISOString();
      state.watchdog = "next-task-ready";
      save(state, "Previous block complete; NEXT TASK will continue in SAME ChatGPT conversation. Rollover only on real conversation limit.");
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
  if (!sameBlocker("Vercel build-rate-limit blocked", "Vercel build rate limit blocked")) {
    throw new Error("APP2 defer self-test: equivalent external blocker should be recognized as the same blocker");
  }
  if (!semanticTerminalCandidate("DPP block completed. 132/132 tests PASS and evidence was recorded.")) throw new Error("APP2 self-test: proven stable completion should allow semantic fallback");
  if (semanticTerminalCandidate("Workflow is queued and still running; waiting for CI.")) throw new Error("APP2 self-test: queued work must not auto-continue");
  if (semanticTerminalCandidate("Login required. Please approve MFA.")) throw new Error("APP2 self-test: human gate must pause");
  console.log("APP2_RESPONSE_WATCHDOG_SELF_TEST PASS progress=2 stall=2 recovery_single_send=1 rollover=3 semantic_terminal=3");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  main().catch((e) => {
    console.error("[APP2] FATAL", e?.stack || e);
    process.exit(1);
  });
}
