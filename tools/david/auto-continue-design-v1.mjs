import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { waitForGlobalSendPermit, reportProbeSuccess, markProbeSendStarted } from "./chatgpt-rate-limit-coordinator.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const DESIGN_EVIDENCE_FILE = path.join(REPO_ROOT, "app", "design-process-2-evidence.json");
const INITIAL_CHAT_URL = process.env.DAVID_DESIGN_CHAT_URL || "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7";
let activeChatUrl = INITIAL_CHAT_URL;
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_DESIGN_STATE_FILE || path.join(process.cwd(), ".david-enchev-design-state.json");
const POLL_MS = Number(process.env.DAVID_DESIGN_POLL_MS || 900);
const START_TIMEOUT_MS = 15000;
const READY_TIMEOUT_MS = Number(process.env.DAVID_DESIGN_READY_TIMEOUT_MS || 120000);
const READY_REFRESH_LIMIT = Number(process.env.DAVID_DESIGN_READY_REFRESH_LIMIT || 2);
const READY_BACKOFF_MS = Number(process.env.DAVID_DESIGN_READY_BACKOFF_MS || 15000);
const IDLE_MONITOR_MS = Number(process.env.DAVID_DESIGN_IDLE_MONITOR_MS || 15000);
const STALL_MS = Number(process.env.DAVID_DESIGN_STALL_MS || 600000);
const COOLDOWN_MS = 1200;
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_STABLE_SAMPLES = Number(process.env.DAVID_COMPLETE_STABLE_SAMPLES || 5);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const PROBLEM_PREFIX = "PROBLEM IN:";
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
  select public.david_claim_vercel_deploy('ENCHEV_DESIGN','enchev-auctions',<commit_sha_or_null>,900);
- granted=false => DO NOT deploy; continue design/code/tests.
- granted=true => mark deploying, perform exactly one intended deployment, then release with public.david_release_vercel_deploy('ENCHEV_DESIGN',<success>,<detail_json>).
- Record quota/rate-limit backoff only when Vercel gives a real retry time. Never invent one.
`;
const MARKER = "[DAVID_RELAY_ENCHEV_DESIGN_PROCESS_2]";
const COMPLETE_HANDOFF_MARKER = "[DAVID_DESIGN_PROCESS_2_COMPLETE_HANDOFF]";
const TAB_NAME = "DAVID_DESIGN_MANAGED_V1";
const PENDING_TAB_NAME = "DAVID_DESIGN_PENDING_V1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (x) => createHash("sha256").update(String(x || "")).digest("hex");
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}
function matchesActiveChat(url) {
  const u = String(url || "");
  if (activeChatUrl === "https://chatgpt.com/") return u === "https://chatgpt.com/" || u === "https://chatgpt.com";
  return u.startsWith(activeChatUrl);
}

const DESIGN_PROMPT = `@GitHub @Vercel @Supabase

Продължи СЕГА следващата незавършена задача от docs/DESIGN_PROCESS_2.md за Enchev Auctions.

DESIGN PROCESS 2 е новият world-class redesign процес за телефон и PC. Design Plan V1 (D01-D36) е frozen/complete и НЕ трябва да се променя или рестартира.

Работи последователно по DP2-01 → DP2-30 според app/design-process-2-evidence.json. Провери реалния GitHub и приложимите CI/preview доказателства. Направи реалната UI/UX промяна в отделен branch/PR, тествай responsive/interaction/visual state и чак тогава обнови app/design-process-2-evidence.json:
- green = implementation + test + конкретно evidence;
- yellow = partial / pending visual proof / failing test / external blocker;
- red = not implemented.
Никога не маркирай GREEN само защото кодът компилира.

Основна цел: ENCHEV да изглежда и да се усеща като сериозна международна auction platform с premium, оригинален продукт-дизайн, а не template.
Приоритетът е: foundation/app shell → homepage → inventory/search/filters → vehicle detail → LIVE auction → buyer workspace → mobile/tablet/desktop → accessibility/performance → Chrome/Edge visual regression → final production acceptance.

Mobile acceptance минимум: 360px, 390px, 430px. Desktop acceptance: 1366px, 1440px и wide 1920-class, когато е приложимо.
Не копирай чуждо logo, proprietary text, images, source code или точна визуална идентичност.
Не добавяй pricing/payment/finance scope.
Не променяй frozen D01-D36 evidence.

Ако DP2-01-DP2-30 вече са 30/30 GREEN, НЕ създавай DP2-31. Докладвай DESIGN PROCESS 2 COMPLETE / IDLE и последният ред да е само: OK

Ако задачата е завършена, последният ред да е само: OK
Външен blocker като Redis/Valkey/Vercel Marketplace/provider credential/permissions НЕ спира DP2: запиши blocker/evidence и продължи към следващата независима DP2 задача.
Използвай ${PROBLEM_PREFIX} само ако нов вътрешен технически дефект реално спира всяка безопасна DP2 работа. Преди това опитай безопасна техническа алтернатива.

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}

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
function designPlanStatus() {
  try {
    const raw = JSON.parse(fs.readFileSync(DESIGN_EVIDENCE_FILE, "utf8"));
    const tasks = Array.isArray(raw?.tasks) ? raw.tasks.filter((t) => /^DP2-\d{2}$/i.test(String(t?.id || ""))) : [];
    const green = tasks.filter((t) => String(t?.status || "").toLowerCase() === "green");
    return {
      total: tasks.length,
      green: green.length,
      complete: tasks.length === 30 && green.length === 30,
      nonGreen: tasks.filter((t) => String(t?.status || "").toLowerCase() !== "green").map((t) => String(t.id))
    };
  } catch (error) {
    return { total: 0, green: 0, complete: false, nonGreen: [], error: String(error?.message || error) };
  }
}

function completeHandoffPrompt(status) {
  return `AUTOMATIC DESIGN PROCESS 2 COMPLETION HANDOFF

Source of truth:
- docs/DESIGN_PROCESS_2.md
- app/design-process-2-evidence.json
- current GitHub main and applicable CI/visual evidence

Current local evidence summary: DP2-01-DP2-30 = ${status.green}/${status.total} GREEN.

If all DP2-01-DP2-30 are GREEN:
- do NOT invent DP2-31 or new design scope;
- do NOT redo completed DP2 tasks;
- report DESIGN PROCESS 2 COMPLETE / IDLE;
- preserve external deployment lag/blockers as evidence only;
- wait for a regression, a non-green DP2 task, or an explicit new user design request.

If any DP2 task is no longer GREEN, identify only those task IDs and resume from the earliest affected task.

Design Plan V1 D01-D36 remains frozen and must not be changed.
Do not modify protected DAVID orchestrator files during normal design work.
Final non-empty line must be exactly:
OK

${COMPLETE_HANDOFF_MARKER}
${MARKER}`;
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
  return Boolean(rows.length && /^OK$/i.test(rows.at(-1)));
}
async function waitForTerminalMarker(page, state) {
  while (true) {
    const text = await latestAssistant(page);
    const problem = extractProblem(text);
    if (problem) return { type: "problem", text, problem };
    if (endsOk(text)) return { type: "ok", text };
    state.watchdog = "design-awaiting-final-ok";
    state.lastResult = "waiting-for-final-ok";
    save(state, "LAW: no new DESIGN prompt until final line is exactly OK or PROBLEM IN appears");
    console.log("[DESIGN] LAW: waiting for final OK. NO NEW PROMPT.");
    await sleep(3000);
  }
}
function isExternalBlocker(problem) {
  return /(redis|valkey|upstash|vercel|marketplace|environment-secret|environment secret|provider credential|credential|permission|authorization|rate limit|quota|billing|plan limit|external access|legal sign-off|customer data|deployment.*queued|deployment.*initializing)/i.test(String(problem || ""));
}
function blockerKey(problem) {
  return String(problem || "").toLowerCase().replace(/\s+/g, " ").replace(/опит\s*\d+|attempt\s*\d+/g, "").trim();
}
function sameBlocker(a, b) {
  const x = blockerKey(a), y = blockerKey(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}
function deferPrompt(problem, repeat = 1) {
  return `@GitHub @Vercel @Supabase

DESIGN EXTERNAL BLOCKER DEFERRED:
${problem}

Не го опитвай отново сега. Запиши blocker/evidence за текущата D-задача, ако е приложимо, и продължи веднага към най-ранната независима DP2-задача от docs/DESIGN_PROCESS_2.md. Направи реалната UI промяна, responsive/interaction проверка, тест и evidence. Това е defer cycle ${repeat}.

Не завършвай с PROBLEM IN само заради същия външен blocker. PROBLEM IN е само за нов вътрешен технически дефект, който спира всяка безопасна design работа.

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}
${MARKER}`;
}
function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nDESIGN PROBLEM:\n${problem}\n\nTRY TO MAKE THIS FIX YOURSELF NOW. Опит ${attempt}. Провери repo/deployment и приложи безопасен fix или алтернатива. Не измисляй evidence. Не заобикаляй CAPTCHA/MFA/login/permissions и не прави destructive действие без разрешение.\n\nАко fix-ът е доказан: OK\nАко още е блокирано: ${PROBLEM_PREFIX} <точният оставащ проблем>\n\nСлед успешен fix продължи следващата DP2-задача от docs/DESIGN_PROCESS_2.md.\n\n${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}\n${MARKER}`;
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
    const taggedUrl = tagged.url();
    if (
      matchesActiveChat(taggedUrl) ||
      activeChatUrl === "https://chatgpt.com/" ||
      taggedUrl.startsWith("https://chatgpt.com/")
    ) {
      await setPageTag(tagged, TAB_NAME);
      return tagged;
    }
  }

  const exact = activeChatUrl === "https://chatgpt.com/"
    ? null
    : context.pages().find((p) => !p.isClosed() && matchesActiveChat(p.url()));
  if (exact) {
    await setPageTag(exact, TAB_NAME);
    return exact;
  }

  const page = await context.newPage();
  await setPageTag(page, activeChatUrl === "https://chatgpt.com/" ? PENDING_TAB_NAME : TAB_NAME);
  await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
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
  console.log(`[DESIGN] Active conversation: ${u}`);
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
  
  const oldPage = page;
  state.previousChatUrl = oldUrl;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), oldUrl])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = "design-conversation-rollover";

  const event = {
    number: state.rolloverCount,
    oldUrl: cleanConversationUrl(oldUrl) || oldUrl,
    newUrl: null,
    startedAt: new Date().toISOString(),
    oldTabClosedAt: null
  };
  state.rolloverHistory = [...(Array.isArray(state.rolloverHistory) ? state.rolloverHistory : []), event].slice(-50);

  activeChatUrl = "https://chatgpt.com/";
  state.chatUrl = activeChatUrl;
  save(state, `Design rollover #${state.rolloverCount} reserved; adopting/creating one pending tab`);

  let newPage = await findTaggedPage(context, [PENDING_TAB_NAME]);
  if (!newPage || newPage === oldPage || newPage.isClosed()) {
    newPage = await context.newPage();
    await setPageTag(newPage, PENDING_TAB_NAME);
    await newPage.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  await setPageTag(newPage, TAB_NAME);

  if (oldPage && !oldPage.isClosed() && oldPage !== newPage) {
    await setPageTag(oldPage, "");
    await oldPage.close({ runBeforeUnload: false }).catch(() => {});
    event.oldTabClosedAt = new Date().toISOString();
  }
  await closeOldConversationTabs(context, oldUrl, newPage);
  save(state, `Design conversation max length -> adopted/created single new tab #${state.rolloverCount}; old tab closed`);
  console.log(`[DESIGN] Conversation max length -> SINGLE NEW TAB #${state.rolloverCount}; OLD TAB CLOSED.`);
  await sleep(1200);
  return newPage;
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
  for (const s of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]','button[aria-label*="stop"]','button[aria-label*="Спри"]','button:has-text("Stop generating")','button:has-text("Stop thinking")','button:has-text("Stop response")','button:has-text("Спри генерирането")','button:has-text("Спри да мисли")','button:has-text("Спри отговора")']) {
    const x = page.locator(s).last();
    if (await x.count() && await x.isVisible().catch(() => false)) return true;
  }
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
async function complete(page, baseHash = null) {
  let stableHash = null;
  let stableSince = 0;
  let stableSamples = 0;
  const deadline = Date.now() + COMPLETE_QUIET_MS + 12000;
  while (Date.now() < deadline) {
    if (await generating(page) || await latestRole(page) !== "assistant") return false;
    const text = await latestAssistant(page);
    if (!text) return false;
    const h = hash(text);
    if (baseHash && h === baseHash) return false;
    if (h !== stableHash) {
      stableHash = h;
      stableSince = Date.now();
      stableSamples = 1;
    } else {
      stableSamples += 1;
    }
    if (stableSamples >= COMPLETE_STABLE_SAMPLES && Date.now() - stableSince >= COMPLETE_QUIET_MS && !await generating(page)) return true;
    await sleep(COMPLETE_SAMPLE_MS);
  }
  return false;
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
        if (/изпращането на съобщението изтече по време|message sending timed out|sending the message timed out|message send timed out/.test(t)) return "send timeout";
        if (/network error|something went wrong|нещо се обърка/.test(t)) return "network error";
      }
      return null;
    });
  } catch { return null; }
}
async function waitSendTimeoutRecovery(context, page, state) {
  state.problem = null;
  state.watchdog = "design-send-timeout-wait-guard";
  save(state, "Message send timeout detected; central guard owns bounded Retry. DESIGN will not duplicate-send.");
  console.log("[DESIGN] SEND TIMEOUT: waiting for central guard. NO DUPLICATE RESEND.");
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    await sleep(1000);
    page = await ensurePage(context, page);
    if (await generating(page)) {
      state.watchdog = "design-thinking";
      save(state, "Send-timeout retry accepted; GPT active");
      return page;
    }
    const pb = await platformBlock(page);
    if (pb !== "send timeout") {
      state.watchdog = "design-send-timeout-recovered";
      save(state, "Message send timeout cleared by central guard");
      return page;
    }
  }
  console.log("[DESIGN] SEND TIMEOUT still visible after 60s. Refreshing view only; no worker resend.");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(2500);
  return page;
}

async function waitReady(context, page, state) {
  let windowStartedAt = Date.now();
  let refreshes = 0;
  let nextHeartbeatAt = 0;

  while (true) {
    page = await ensurePage(context, page);
    if (page.url().includes("/login") || page.url().includes("/auth/")) {
      state.watchdog = "design-login-wait";
      save(state, "Design waiting for ChatGPT login/auth; no bypass");
      await sleep(1500);
      continue;
    }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      windowStartedAt = Date.now();
      refreshes = 0;
      continue;
    }
    syncActiveChatUrl(page, state);
    if (await composer(page) || await latestAssistant(page)) return page;

    if (Date.now() >= nextHeartbeatAt) {
      state.watchdog = "design-slow-load-wait";
      save(state, `Design ChatGPT still loading; refreshes=${refreshes}/${READY_REFRESH_LIMIT}; WAIT`);
      nextHeartbeatAt = Date.now() + 5000;
    }

    if (Date.now() - windowStartedAt >= READY_TIMEOUT_MS) {
      if (refreshes < READY_REFRESH_LIMIT) {
        refreshes += 1;
        state.watchdog = "design-slow-load-refresh";
        save(state, `Design slow-load timeout -> bounded refresh ${refreshes}/${READY_REFRESH_LIMIT}`);
        console.log(`[DESIGN] Slow load -> bounded REFRESH ${refreshes}/${READY_REFRESH_LIMIT}.`);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await sleep(5000);
        windowStartedAt = Date.now();
        continue;
      }

      state.watchdog = "design-slow-load-backoff";
      save(state, "Design still not interactive after bounded refreshes; backoff, no restart loop");
      console.log("[DESIGN] Slow load persists -> BACKOFF. No restart loop.");
      await sleep(READY_BACKOFF_MS);
      windowStartedAt = Date.now();
    }

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
    page = await waitReady(context, page, state);
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
    page = await waitReady(context, page, state);
    const pb = await platformBlock(page);
    if (pb) return { page, blocker: pb, stalled: false, text: "" };
    const text = await latestAssistant(page), h = hash(text);
    if (await generating(page)) { lastActivity = Date.now(); state.watchdog = "design-thinking"; save(state, "Design GPT thinking"); await sleep(POLL_MS); continue; }
    if (text && h !== base) {
      if (h !== last) { last = h; lastActivity = Date.now(); state.watchdog = "design-writing"; save(state, "Design GPT writing"); }
      if (await complete(page, base)) return { page, blocker: null, stalled: false, text: await latestAssistant(page) };
    }
    if (Date.now() - lastActivity > STALL_MS) return { page, blocker: null, stalled: true, text };
    await sleep(POLL_MS);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  for (;;) {
    page = await waitReady(context, page, state);
    const base = hash(await latestAssistant(page));
    state.watchdog = kind === "fix" ? "design-fixing-problem" : "design-sending-relay";
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    save(state, kind === "fix" ? "Design: sending fix instruction" : "Design: sending next D-task");
    const outgoingPrompt = state.justRolledOver
      ? kind === "handoff"
        ? prompt
        : `AUTOMATIC CHAT ROLLOVER: The previous Enchev Design conversation reached its maximum length. Reconstruct the exact design state from GitHub, docs/DESIGN_PROCESS_2.md and evidence, then continue from the next unfinished D-task. Do NOT restart completed work.\n\n${prompt}`
      : prompt;
    const permit = await waitForGlobalSendPermit("DESIGN", async (decision) => {
      state.watchdog = "global-rate-limit-wait";
      state.problem = "ChatGPT platform: global rate limit";
      state.problemRetryAt = decision.state?.blockedUntil || decision.state?.probeLeaseUntil || null;
      save(state, `GLOBAL RATE LIMIT WAIT mode=${decision.mode}; owner=${decision.state?.probeOwner || "none"}`);
    });
    if (permit.mode === "probe") {
      state.watchdog = "global-rate-limit-probe";
      save(state, "DESIGN owns the single post-cooldown probe send");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(2500);
    }
    await fillAndSend(page, outgoingPrompt);
    if (permit.mode === "probe") await markProbeSendStarted("DESIGN");
    let started = await waitStart(context, page, base, state); page = started.page;
    syncActiveChatUrl(page, state);
    if (started.blocker) {
      if (started.blocker === "send timeout") {
        page = await waitSendTimeoutRecovery(context, page, state);
        started = await waitStart(context, page, base, state);
        page = started.page;
        if (started.started) {
          state.turnsSent = Number(state.turnsSent || 0) + 1;
          save(state, `Design GPT started cycle ${state.turnsSent} after send-timeout recovery`);
          const doneAfterTimeout = await waitCompletion(context, page, base, state);
          page = doneAfterTimeout.page;
          if (!doneAfterTimeout.blocker && !doneAfterTimeout.stalled) {
            state.lastAssistantHash = hash(doneAfterTimeout.text);
            if (state.justRolledOver) state.justRolledOver = false;
            syncActiveChatUrl(page, state);
            await reportProbeSuccess("DESIGN");
            delete state.problemRetryAt;
            save(state, "Design response complete after send-timeout recovery");
            return { page, text: doneAfterTimeout.text };
          }
        }
        continue;
      }
      state.problem = `ChatGPT platform: ${started.blocker}`; state.watchdog = "design-platform-backoff"; save(state, `Design platform blocker: ${started.blocker}`);
      await sleep(started.blocker === "human verification" ? 30000 : 15000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      continue;
    }
    if (!started.started) { state.watchdog = "design-refreshing"; save(state, "LAW: Design GPT did not start -> refresh -> resend"); console.log("[DESIGN] LAW: no thinking -> REFRESH -> RESEND."); await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}); await sleep(2500); continue; }
    state.turnsSent = Number(state.turnsSent || 0) + 1; save(state, `Design GPT started cycle ${state.turnsSent}`);
    const done = await waitCompletion(context, page, base, state); page = done.page;
    if (done.blocker) {
      if (done.blocker === "send timeout") {
        page = await waitSendTimeoutRecovery(context, page, state);
        continue;
      }
      state.watchdog = "design-refreshing"; save(state, `Design blocker ${done.blocker}`); await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {}); await sleep(2500); continue;
    }
    if (done.stalled) { state.watchdog = "design-stalled-resend"; save(state, "LAW: Design GPT stopped thinking/writing -> resend"); console.log("[DESIGN] LAW: stopped thinking/writing -> RESEND."); await sleep(800); continue; }
    state.lastAssistantHash = hash(done.text);
    if (state.justRolledOver) state.justRolledOver = false;
    syncActiveChatUrl(page, state);
    await reportProbeSuccess("DESIGN");
    delete state.problemRetryAt;
    save(state, "Design response complete");
    return { page, text: done.text };
  }
}

async function main() {
  console.log(`[DESIGN] Connecting to shared Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No shared Edge context");
  const state = loadState();
  activeChatUrl = state.chatUrl || INITIAL_CHAT_URL;
  let page = await waitReady(context, await ensurePage(context, null), state);
  syncActiveChatUrl(page, state);
  if (state.previousChatUrl) await closeOldConversationTabs(context, state.previousChatUrl, page);
  console.log(`[DESIGN] Session ready: ${page.url()}`);
  state.watchdog = "design-monitoring";
  save(state, "Design worker connected in shared Edge tab");

  while (true) {
    const planStatus = designPlanStatus();

    if (planStatus.complete) {
      const rolloverNumber = Number(state.rolloverCount || 0);
      const needsHandoff = Boolean(state.justRolledOver) && Number(state.completeHandoffRollover || -1) !== rolloverNumber;

      if (needsHandoff) {
        state.problem = null;
        state.watchdog = "design-complete-handoff";
        save(state, `Design 36/36 GREEN -> sending completion handoff for rollover #${rolloverNumber}`);
        console.log(`[DESIGN] 36/36 GREEN. Sending ONE completion handoff for rollover #${rolloverNumber}.`);

        const result = await runPrompt(context, page, state, completeHandoffPrompt(planStatus), "handoff");
        page = result.page;
        const handoffProblem = extractProblem(result.text);
        if (handoffProblem) {
          state.problem = handoffProblem;
          state.watchdog = "design-problem";
          save(state, `Completion handoff reported PROBLEM IN: ${handoffProblem}`);
          continue;
        }
        if (!endsOk(result.text)) {
          const terminal = await waitForTerminalMarker(page, state);
          if (terminal.type === "problem") {
            state.problem = terminal.problem;
            state.watchdog = "design-problem";
            save(state, `Completion handoff terminal marker became PROBLEM IN: ${terminal.problem}`);
            continue;
          }
        }
        state.completeHandoffRollover = rolloverNumber;
        state.justRolledOver = false;
        state.lastResult = "OK";
        save(state, `Design completion handoff acknowledged for rollover #${rolloverNumber}`);
      }

      state.problem = null;
      state.lastResult = "OK";
      state.watchdog = "design-idle-complete";
      save(state, "DESIGN PLAN V1 COMPLETE 36/36 GREEN -> IDLE / MONITOR");
      await sleep(IDLE_MONITOR_MS);

      page = await waitReady(context, page, state);
      const recheck = designPlanStatus();
      if (!recheck.complete) {
        state.watchdog = "design-regression-detected";
        save(state, `Design left idle: ${recheck.green}/${recheck.total} GREEN; non-green=${recheck.nonGreen.join(",") || "unknown"}`);
        console.log(`[DESIGN] Regression/non-green detected: ${recheck.green}/${recheck.total}. Resuming plan.`);
      }
      continue;
    }

    if (state.problem && isExternalBlocker(state.problem)) {
      const deferred = state.problem;
      const alreadyDeferred = Boolean(state.deferredBlockerAcknowledged) && sameBlocker(state.deferredBlocker, deferred);

      state.problem = null;
      state.problemAttempts = 0;

      if (alreadyDeferred) {
        state.watchdog = "design-external-blocker-already-deferred";
        save(state, `Design external blocker already deferred; skipping relay and continuing independent work: ${deferred}`);
        console.log(`[DESIGN] BLOCKER ALREADY DEFERRED -> CONTINUE WORK: ${deferred}`);
      } else {
        state.deferredBlocker = deferred;
        state.deferredBlockerAcknowledged = false;
        state.deferredBlockerCount = Number(state.deferredBlockerCount || 0) + 1;
        state.watchdog = "design-external-blocker-deferred";
        save(state, `Design external blocker deferred once: ${deferred}`);
        console.log(`[DESIGN] NEW EXTERNAL BLOCKER -> ONE DEFER RELAY: ${deferred}`);

        const result = await runPrompt(context, page, state, deferPrompt(deferred, state.deferredBlockerCount), "work");
        page = result.page;
        const nextProblem = extractProblem(result.text);

        if (nextProblem) {
          if (isExternalBlocker(nextProblem)) {
            if (sameBlocker(deferred, nextProblem)) {
              state.deferredBlocker = deferred;
              state.deferredBlockerAcknowledged = true;
              state.problem = null;
              state.watchdog = "design-external-blocker-already-deferred";
              save(state, `Same DESIGN blocker repeated after one defer; forcing independent work: ${nextProblem}`);
            } else {
              state.deferredBlocker = nextProblem;
              state.deferredBlockerAcknowledged = false;
              state.problem = nextProblem;
              save(state, `Different DESIGN external blocker discovered: ${nextProblem}`);
            }
            await sleep(COOLDOWN_MS);
            continue;
          }

          state.problem = nextProblem;
          save(state, `Design new internal problem: ${nextProblem}`);
          await sleep(COOLDOWN_MS);
          continue;
        }

        if (!endsOk(result.text)) {
          const terminal = await waitForTerminalMarker(page, state);
          if (terminal.type === "problem") {
            if (isExternalBlocker(terminal.problem) && sameBlocker(deferred, terminal.problem)) {
              state.deferredBlockerAcknowledged = true;
              state.problem = null;
              state.watchdog = "design-external-blocker-already-deferred";
              save(state, `Same DESIGN terminal blocker repeated after one defer; forcing independent work: ${terminal.problem}`);
            } else {
              state.problem = terminal.problem;
              save(state, `Design terminal marker became PROBLEM IN: ${terminal.problem}`);
            }
            continue;
          }
        }

        state.deferredBlockerAcknowledged = true;
        state.lastResult = "OK";
        save(state, "One DESIGN defer relay completed; same blocker will not receive another relay");
      }
      save(state, "Design independent task completed with final OK");
      await sleep(COOLDOWN_MS);
      continue;
    }

    if (state.problem && !String(state.problem).startsWith("ChatGPT platform:")) {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      const result = await runPrompt(context, page, state, fixPrompt(state.problem, state.problemAttempts), "fix");
      page = result.page;
      const problem = extractProblem(result.text);
      if (problem) { state.problem = problem; state.watchdog = "design-problem"; save(state, `Design problem remains: ${problem}`); await sleep(state.problemAttempts % 4 === 0 ? 30000 : COOLDOWN_MS); continue; }
      if (!endsOk(result.text)) {
        const terminal = await waitForTerminalMarker(page, state);
        if (terminal.type === "problem") {
          state.problem = terminal.problem;
          state.watchdog = "design-problem";
          save(state, `Design fix terminal marker became PROBLEM IN: ${terminal.problem}`);
          continue;
        }
      }
      state.problem = null; state.problemAttempts = 0; state.lastResult = "OK"; state.watchdog = "design-problem-fixed"; save(state, "Design problem fixed with final OK; continuing plan"); await sleep(COOLDOWN_MS); continue;
    }

    state.problem = null;
    const result = await runPrompt(context, page, state, DESIGN_PROMPT, "work");
    page = result.page;
    const problem = extractProblem(result.text);
    if (problem) { state.problem = problem; state.problemAttempts = 0; state.watchdog = "design-problem"; save(state, `Design GPT reported: ${problem}`); await sleep(COOLDOWN_MS); continue; }
    if (!endsOk(result.text)) {
      const terminal = await waitForTerminalMarker(page, state);
      if (terminal.type === "problem") {
        state.problem = terminal.problem;
        state.problemAttempts = 0;
        state.watchdog = "design-problem";
        save(state, `Design terminal marker became PROBLEM IN: ${terminal.problem}`);
        continue;
      }
    }
    state.lastResult = "OK";
    state.watchdog = "design-complete";
    save(state, "Final OK received; next DESIGN prompt allowed");
    console.log("[DESIGN] Final OK received. NEXT prompt allowed.");
    await sleep(COOLDOWN_MS);
  }
}

main().catch((e) => { console.error("[DESIGN] FATAL", e?.stack || e); process.exit(1); });
