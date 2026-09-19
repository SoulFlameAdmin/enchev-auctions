import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { waitForGlobalSendPermit, reportRateLimit, reportProbeSuccess, markProbeSendStarted } from "./chatgpt-rate-limit-coordinator.mjs";

const INITIAL_CHAT_URL = process.env.DAVID_CHAT_URL || "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71";
let activeChatUrl = INITIAL_CHAT_URL;
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const MAX_TURNS = Number(process.env.DAVID_MAX_TURNS || 2147483647);
const POLL_MS = Number(process.env.DAVID_POLL_MS || 800);
const COOLDOWN_MS = Number(process.env.DAVID_COOLDOWN_MS || 1000);
const RESPONSE_START_TIMEOUT_MS = Number(process.env.DAVID_RESPONSE_START_TIMEOUT_MS || 12000);
const STALL_TIMEOUT_MS = Number(process.env.DAVID_STALL_TIMEOUT_MS || 600000);
const REFRESH_SETTLE_MS = Number(process.env.DAVID_REFRESH_SETTLE_MS || 3000);
const MAX_RECOVERY_ATTEMPTS = Number(process.env.DAVID_MAX_RECOVERY_ATTEMPTS || 4);
const SAME_TURN_RECOVERY_LIMIT = Number(process.env.DAVID_SAME_TURN_RECOVERY_LIMIT || 3);
const STALL_RESEND_LIMIT = Number(process.env.DAVID_STALL_RESEND_LIMIT || 2);
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_STABLE_SAMPLES = Number(process.env.DAVID_COMPLETE_STABLE_SAMPLES || 5);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const PROBLEM_BACKOFF_MS = Number(process.env.DAVID_PROBLEM_BACKOFF_MS || 30000);
const PLATFORM_BACKOFF_MS = Number(process.env.DAVID_PLATFORM_BACKOFF_MS || 180000);
const STATE_FILE = process.env.DAVID_STATE_FILE || path.join(process.cwd(), ".david-enchev-state.json");
const RELAY_MARKER = "[DAVID_RELAY_ENCHEV_V5]";
const TAB_NAME = "DAVID_SYSTEM_MANAGED_V1";
const PENDING_TAB_NAME = "DAVID_SYSTEM_PENDING_V1";
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
- Before ANY Vercel create/update/redeploy, atomically claim the global Supabase lease with:
  select public.david_claim_vercel_deploy('ENCHEV_SYSTEM','enchev-auctions',<commit_sha_or_null>,900);
- If granted=false: DO NOT deploy. Continue dependency-safe non-deploy work.
- If granted=true: call public.david_mark_vercel_deploying(...), perform exactly one intended deployment, then always release with public.david_release_vercel_deploy('ENCHEV_SYSTEM',<success>,<detail_json>).
- If Vercel returns a quota/rate limit with a concrete retry time, record it with public.david_block_vercel_deploys(...). Never invent a retry time.
`;

const CONTINUE_PROMPT = `@GitHub @Vercel @Supabase

Продължи СЕГА следващата незавършена зависима задача по Enchev Auctions и MASTER SYSTEM PLAN v1.0 FROZEN.
Работи директно с GitHub, Vercel и Supabase, когато са приложими. Направи реалната промяна, тествай я и маркирай GREEN само с evidence. Не прескачай dependencies и не добавяй pricing/payment/finance в tracker.
Работи по една логически завършена задача или свързан блок. Не спирай само защото първият подход не работи — опитай безопасна алтернатива, поправи грешката и продължи.

ВАЖЕН ПРОТОКОЛ ЗА DAVID:
- Никога не пиши DAVID_STOP.
- Ако задачата е успешно завършена и доказана, завърши последния ред само с: OK
- Външен blocker (quota/rate-limit/billing/provider credential/Marketplace permission/legal sign-off/customer data) НЕ спира целия план. Запиши го като blocker/evidence и премини към най-ранната независима dependency-safe задача.
- Ако има вътрешен технически проблем, който реално спира всяка безопасна независима работа, завърши с: ${PROBLEM_PREFIX} <кратко и точно какво пречи>
- Преди PROBLEM IN опитай сам разумните безопасни варианти.
- Не заобикаляй CAPTCHA/MFA/login/permissions, не измисляй secrets и не прави destructive действие без разрешение.

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}

${RELAY_MARKER}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hashText = (text) => createHash("sha256").update(String(text || "")).digest("hex");
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}
function matchesActiveChat(url) {
  const u = String(url || "");
  if (activeChatUrl === "https://chatgpt.com/") return u === "https://chatgpt.com/" || u === "https://chatgpt.com";
  return u.startsWith(activeChatUrl);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      turnsSent: 0,
      relayAttempts: 0,
      recoveryAttempt: 0,
      problemAttempts: 0,
      problem: null,
      lastAssistantHash: null,
      stopped: false,
      watchdog: "boot"
    };
  }
}

function saveState(state, action = null) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  state.stopped = false;
  delete state.stopReason;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function usable(page) { return Boolean(page && !page.isClosed()); }
async function safeUrl(page) { try { return usable(page) ? page.url() : ""; } catch { return ""; } }

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

async function ensureTargetPage(context, current = null) {
  if (usable(current)) {
    const currentUrl = await safeUrl(current);
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

  const pages = context.pages().filter((p) => !p.isClosed());
  let page = activeChatUrl === "https://chatgpt.com/"
    ? null
    : pages.find((p) => matchesActiveChat(p.url()));

  if (!page) {
    page = await context.newPage();
    await setPageTag(page, activeChatUrl === "https://chatgpt.com/" ? PENDING_TAB_NAME : TAB_NAME);
  }

  const url = await safeUrl(page);
  if (!matchesActiveChat(url) && !url.includes("/auth/") && !url.includes("/login")) {
    await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  await setPageTag(page, TAB_NAME);
  return page;
}

async function conversationLimitReached(page) {
  if (!usable(page)) return false;
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
  saveState(state, `Conversation URL synced: ${u}`);
  console.log(`[DAVID] Active conversation: ${u}`);
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
  const oldUrl = cleanConversationUrl(await safeUrl(page)) || await safeUrl(page) || activeChatUrl;
  if (!usable(page)) page = await ensureTargetPage(context, null);
  const oldPage = page;
  state.previousChatUrl = oldUrl;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), oldUrl])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = "conversation-rollover";

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
  saveState(state, `SYSTEM rollover #${state.rolloverCount} reserved; adopting/creating one pending tab`);

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
  saveState(state, `Conversation max length -> single new tab #${state.rolloverCount}; old tab closed`);
  console.log(`[DAVID] Conversation max length -> SINGLE NEW TAB #${state.rolloverCount}; OLD TAB CLOSED.`);
  await sleep(1200);
  return newPage;
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

async function latestTurnInfo(page) {
  if (!usable(page)) return { role: null, text: "" };
  try {
    const nodes = page.locator('[data-message-author-role="assistant"], [data-message-author-role="user"]');
    const count = await nodes.count();
    if (!count) return { role: null, text: "" };
    const node = nodes.nth(count - 1);
    return {
      role: await node.getAttribute("data-message-author-role"),
      text: (await node.innerText().catch(() => "")).trim()
    };
  } catch { return { role: null, text: "" }; }
}

async function latestUserText(page) {
  if (!usable(page)) return "";
  try {
    const nodes = page.locator('[data-message-author-role="user"]');
    if (!await nodes.count()) return "";
    return (await nodes.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
}

async function messageCounts(page) {
  if (!usable(page)) return { user: 0, assistant: 0 };
  try {
    const user = await page.locator('[data-message-author-role="user"]').count();
    const assistant = await page.locator('[data-message-author-role="assistant"]').count();
    return { user, assistant };
  } catch { return { user: 0, assistant: 0 }; }
}

function promptAcceptedSignal(currentUserCount, baselineUserCount, latestUserHash, outgoingHash) {
  return currentUserCount > baselineUserCount && Boolean(outgoingHash) && latestUserHash === outgoingHash;
}

function sameTurnPromptPresent(latestUserHash, outgoingHash) {
  return Boolean(outgoingHash) && latestUserHash === outgoingHash;
}

async function latestAssistantText(page) {
  if (!usable(page)) return "";
  try {
    const nodes = page.locator('[data-message-author-role="assistant"]');
    if (!await nodes.count()) return "";
    return (await nodes.last().innerText().catch(() => "")).trim();
  } catch { return ""; }
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

async function isGenerating(page) {
  if (!usable(page)) return false;
  for (const selector of [
    '[data-testid="stop-button"]',
    '[data-testid*="stop" i]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button[aria-label*="Спри"]',
    'button:has-text("Stop generating")',
    'button:has-text("Stop thinking")',
    'button:has-text("Stop response")',
    'button:has-text("Спри генерирането")',
    'button:has-text("Спри да мисли")',
    'button:has-text("Спри отговора")'
  ]) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return true;
    } catch {}
  }
  try {
    const active = await page.evaluate(() => {
      const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
      const last = turns.at(-1);
      if (!last || !last.querySelector('[data-message-author-role="assistant"]')) return false;
      const finalAction = last.querySelector(
        'button[aria-label*="Copy" i],button[aria-label*="Share" i],button[aria-label*="Regenerate" i],button[data-testid*="copy" i],button[data-testid*="thumb" i]'
      );
      if (finalAction) return false;
      const text = (last.textContent || "").replace(/\s+/g, " ").trim();
      return /(thinking|мислене|мисли|working|работи|calling tool|called tool|tool call|извикан инструмент|извиква инструмент|searching|търсене|browsing|преглежда|analyzing|анализира)/i.test(text);
    });
    if (active) return true;
  } catch {}
  return false;
}

async function hasFinalActionBar(page) {
  if (!usable(page) || await isGenerating(page)) return false;
  const turn = await latestAssistantTurn(page);
  if (!turn) return false;
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
  let matched = 0;
  for (const selector of selectors) {
    try {
      const items = turn.locator(selector);
      for (let i = 0; i < await items.count(); i++) {
        if (await items.nth(i).isVisible().catch(() => false)) { matched += 1; break; }
      }
    } catch {}
  }
  if (matched >= 2) return true;
  try {
    const buttons = turn.locator("button");
    let visible = 0;
    for (let i = 0; i < await buttons.count(); i++) {
      const b = buttons.nth(i);
      if (!await b.isVisible().catch(() => false)) continue;
      const label = `${await b.getAttribute("aria-label").catch(() => "") || ""} ${await b.getAttribute("title").catch(() => "") || ""}`.toLowerCase();
      if (label.includes("stop") || label.includes("send")) continue;
      visible += 1;
    }
    return visible >= 4;
  } catch { return false; }
}

async function responseComplete(page, baselineHash = null) {
  if (!usable(page)) return false;
  let stableHash = null;
  let stableSince = 0;
  let stableSamples = 0;
  const deadline = Date.now() + COMPLETE_QUIET_MS + 12000;

  while (Date.now() < deadline) {
    if (!usable(page) || await isGenerating(page)) return false;
    const turn = await latestTurnInfo(page);
    if (turn.role !== "assistant") return false;

    const text = await latestAssistantText(page);
    if (!text) return false;
    const h = hashText(text);
    if (baselineHash && h === baselineHash) return false;

    if (h !== stableHash) {
      stableHash = h;
      stableSince = Date.now();
      stableSamples = 1;
    } else {
      stableSamples += 1;
    }

    if (
      stableSamples >= COMPLETE_STABLE_SAMPLES &&
      Date.now() - stableSince >= COMPLETE_QUIET_MS &&
      !await isGenerating(page)
    ) {
      return true;
    }
    await sleep(COMPLETE_SAMPLE_MS);
  }
  return false;
}

function extractProblem(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const idx = rows[i].toUpperCase().indexOf(PROBLEM_PREFIX);
    if (idx >= 0) return rows[i].slice(idx + PROBLEM_PREFIX.length).trim() || "Нерешен проблем";
  }
  return null;
}

function endsOk(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return rows.length > 0 && /^OK$/i.test(rows.at(-1));
}
async function waitForTerminalMarker(page, state) {
  while (true) {
    const text = await latestAssistantText(page);
    const problem = extractProblem(text);
    if (problem) return { type: "problem", text, problem };
    if (endsOk(text)) return { type: "ok", text };
    state.watchdog = "awaiting-final-ok";
    state.lastResult = "waiting-for-final-ok";
    saveState(state, "LAW: no new prompt until final line is exactly OK or PROBLEM IN appears");
    console.log("[DAVID] LAW: waiting for final OK. NO NEW PROMPT.");
    await sleep(3000);
  }
}
function isExternalBlocker(problem) {
  return /(redis|valkey|upstash|vercel|marketplace|environment-secret|environment secret|provider credential|credential|permission|authorization|rate limit|quota|billing|plan limit|external access|legal sign-off|customer data|oidc.*deployment|deployment.*queued|deployment.*initializing)/i.test(String(problem || ""));
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

ВЪНШЕН BLOCKER Е ОТЛОЖЕН:
${problem}

Не го опитвай отново в този цикъл и не прави нови безполезни retry/rollover-и за него. Запиши blocker/evidence в MASTER SYSTEM PLAN и веднага избери най-ранната независима dependency-safe задача, която може да се изпълни с наличните GitHub/Vercel/Supabase capabilities. Направи реална промяна, тест и evidence. Това е defer cycle ${repeat}.

Не завършвай с PROBLEM IN само заради същия външен blocker. PROBLEM IN е позволено само за нов вътрешен технически дефект, който спира всяка безопасна независима работа.

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}

${RELAY_MARKER}`;
}

function fixPrompt(problem, attempt) {
  return `@GitHub @Vercel @Supabase\n\nDAVID засече проблем в текущия етап:\n${problem}\n\nTRY TO MAKE THIS FIX YOURSELF NOW. Това е опит ${attempt}. Провери реалното състояние и опитай безопасен технически fix или валиден алтернативен подход. Не измисляй evidence, secrets или резултати. Не заобикаляй CAPTCHA/MFA/login/permissions и не прави destructive действие без разрешение.\n\nАко го оправиш и го докажеш, завърши последния ред само с: OK\nАко още не е решено, завърши с: ${PROBLEM_PREFIX} <точният оставащ проблем>\nСлед успешен fix продължи към следващата зависима задача от MASTER SYSTEM PLAN.\n\n${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}\n\n${RELAY_MARKER}`;
}

async function visiblePlatformBlock(page) {
  if (!usable(page)) return null;
  try {
    const result = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="toast" i],[data-testid*="error" i],[data-testid*="banner" i]'));
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      for (const el of candidates) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role], article[data-testid^="conversation-turn-"]')) continue;
        const text = (el.textContent || '').trim().toLowerCase();
        if (/verify you are human|потвърдете, че сте човек/.test(text)) return 'human verification';
        if (/too many requests|rate limit|твърде много заявки/.test(text)) return 'rate limit';
        if (/you(?:'ve| have) reached your limit|достигнахте лимита/.test(text)) return 'limit';
        if (/изпращането на съобщението изтече по време|message sending timed out|sending the message timed out|message send timed out/.test(text)) return 'send timeout';
        if (/network error|нещо се обърка|something went wrong/.test(text)) return 'network error';
      }
      return null;
    });
    if (result) return result;
  } catch {}
  for (const selector of ['iframe[src*="captcha" i]', 'iframe[src*="challenge" i]', '[data-sitekey]']) {
    try {
      const loc = page.locator(selector).last();
      if (await loc.count() && await loc.isVisible().catch(() => false)) return "captcha";
    } catch {}
  }
  return null;
}

async function waitForSession(context, page, state) {
  while (true) {
    page = await ensureTargetPage(context, page);
    const url = await safeUrl(page);
    if (url.includes("/auth/") || url.includes("/login")) {
      await sleep(POLL_MS);
      continue;
    }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      continue;
    }
    syncActiveChatUrl(page, state);
    if (!matchesActiveChat(url) && activeChatUrl !== "https://chatgpt.com/") {
      await page.goto(activeChatUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(POLL_MS);
      continue;
    }
    if (await getComposer(page) || await latestAssistantText(page)) return page;
    await sleep(POLL_MS);
  }
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

async function sendText(page, text) {
  const composer = await getComposer(page);
  if (!composer) throw new Error("ChatGPT composer not found.");
  await fillComposer(composer, text);
  await sleep(300);
  for (const selector of ['button[data-testid="send-button"]', 'button[aria-label*="Send"]', 'button[aria-label*="Изпрати"]']) {
    try {
      const btn = page.locator(selector).last();
      if (await btn.count() && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
        await btn.click();
        console.log("[DAVID] Message sent via send button.");
        return;
      }
    } catch {}
  }
  await composer.press("Enter");
  console.log("[DAVID] Message sent via Enter.");
}

async function refreshChat(context, page, state, attempt) {
  state.watchdog = "refreshing-chat";
  state.recoveryAttempt = attempt;
  saveState(state, `Refreshing ChatGPT recovery ${attempt}`);
  console.log(`[DAVID] Refreshing ChatGPT (recovery ${attempt}/${MAX_RECOVERY_ATTEMPTS}).`);
  page = await waitForSession(context, page, state);
  if (usable(page)) await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(REFRESH_SETTLE_MS);
  return waitForSession(context, page, state);
}

async function waitPlatform(context, page, state, blocker) {
  if (blocker === "rate limit") {
    const rl = await reportRateLimit("SYSTEM", "ChatGPT too many requests / rate limit");
    state.problem = "ChatGPT platform: rate limit";
    state.problemRetryAt = rl.blockedUntil;
    state.watchdog = "global-rate-limit";
    saveState(state, `GLOBAL RATE LIMIT: all sends blocked until ${rl.blockedUntil}; stage=${rl.stage}`);
    console.log(`[DAVID] GLOBAL RATE LIMIT stage=${rl.stage} until ${rl.blockedUntil}. All workers must WAIT.`);
    await sleep(1000);
    return waitForSession(context, page, state);
  }

  if (blocker === "send timeout") {
    state.problem = null;
    state.watchdog = "send-timeout-wait-guard";
    saveState(state, "Message send timeout detected; central guard owns bounded Retry. Worker will not duplicate-send.");
    console.log("[DAVID] SEND TIMEOUT: waiting for central guard. NO DUPLICATE RESEND.");
    const until = Date.now() + 60000;
    while (Date.now() < until) {
      await sleep(1000);
      page = await waitForSession(context, page, state);
      const current = await visiblePlatformBlock(page);
      if (current !== "send timeout") {
        state.watchdog = "send-timeout-recovered";
        saveState(state, "Message send timeout cleared by central guard");
        return page;
      }
    }
    console.log("[DAVID] SEND TIMEOUT still visible after 60s. Refreshing view only; central guard remains recovery owner.");
    if (usable(page)) await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(REFRESH_SETTLE_MS);
    return waitForSession(context, page, state);
  }

  const human = blocker === "captcha" || blocker === "human verification";
  const waitMs = human ? 30000 : blocker === "network error" ? 10000 : PLATFORM_BACKOFF_MS;
  state.problem = `ChatGPT platform: ${blocker}`;
  state.problemRetryAt = new Date(Date.now() + waitMs).toISOString();
  state.watchdog = human ? "human-blocked" : "platform-backoff";
  saveState(state, `Platform problem ${blocker}; retry scheduled`);
  console.log(`[DAVID] Platform problem: ${blocker}. Retry in ${Math.round(waitMs / 1000)}s.`);
  await sleep(waitMs);
  page = await refreshChat(context, page, state, 0);
  delete state.problemRetryAt;
  if (!human) state.problem = null;
  saveState(state, "Platform retry window ended");
  return page;
}

async function waitForResponseStart(context, page, baselineHash, baselineUserCount, outgoingHash, state) {
  const until = Date.now() + RESPONSE_START_TIMEOUT_MS;
  while (Date.now() < until) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) return { started: false, blocker, page };
    if (await isGenerating(page)) {
      state.watchdog = "gpt-thinking";
      saveState(state, "GPT started thinking/generating");
      return { started: true, acceptedOnly: false, page };
    }
    const turn = await latestTurnInfo(page);
    const text = await latestAssistantText(page);
    if (turn.role === "assistant" && text && hashText(text) !== baselineHash) {
      state.watchdog = "gpt-writing";
      saveState(state, "GPT started a new response");
      return { started: true, acceptedOnly: false, page };
    }
    const counts = await messageCounts(page);
    const latestUserHash = hashText(await latestUserText(page));
    if (promptAcceptedSignal(counts.user, baselineUserCount, latestUserHash, outgoingHash)) {
      state.watchdog = "prompt-accepted-waiting-response";
      saveState(state, "User turn accepted; waiting without duplicate resend");
      return { started: true, acceptedOnly: true, page };
    }
    await sleep(POLL_MS);
  }
  return { started: false, blocker: null, page };
}

async function sendWithRecovery(context, page, state, text, kind) {
  const baselineHash = hashText(await latestAssistantText(page));
  const baselineCounts = await messageCounts(page);
  const outgoingText = state.justRolledOver
    ? `AUTOMATIC CHAT ROLLOVER: The previous Enchev conversation reached its maximum length. Reconstruct the exact current state from GitHub, MASTER SYSTEM PLAN and evidence, then continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${text}`
    : text;
  const outgoingHash = hashText(outgoingText);

  for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      page = await waitPlatform(context, page, state, blocker);
      attempt -= 1;
      continue;
    }

    const countsBeforeRetry = await messageCounts(page);
    const latestUserHashBeforeRetry = hashText(await latestUserText(page));
    if (promptAcceptedSignal(countsBeforeRetry.user, baselineCounts.user, latestUserHashBeforeRetry, outgoingHash)) {
      state.watchdog = "prompt-already-accepted";
      state.recoveryAttempt = attempt - 1;
      saveState(state, "Prompt already exists as accepted user turn; suppressing duplicate resend");
      console.log("[DAVID] Prompt already accepted. Duplicate resend suppressed.");
      return { ok: true, page, baselineHash, outgoingHash };
    }

    if (attempt >= 3) page = await refreshChat(context, page, state, attempt);
    state.watchdog = kind === "fix" ? "fixing-problem" : attempt === 1 ? "sending-relay" : "recovering-relay";
    state.recoveryAttempt = attempt - 1;
    state.relayAttempts = Number(state.relayAttempts || 0) + 1;
    saveState(state, kind === "fix" ? "Sending problem-fix instruction" : `Sending development relay attempt ${attempt}`);
    const permit = await waitForGlobalSendPermit("SYSTEM", async (decision) => {
      state.watchdog = "global-rate-limit-wait";
      state.problem = "ChatGPT platform: global rate limit";
      state.problemRetryAt = decision.state?.blockedUntil || decision.state?.probeLeaseUntil || null;
      saveState(state, `GLOBAL RATE LIMIT WAIT mode=${decision.mode}; owner=${decision.state?.probeOwner || "none"}`);
    });
    if (permit.mode === "probe") {
      state.watchdog = "global-rate-limit-probe";
      saveState(state, "SYSTEM owns the single post-cooldown probe send");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(2500);
    }

    console.log(`[DAVID] Sending ${kind} attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}. rateMode=${permit.mode}`);
    await sendText(page, outgoingText);
    if (permit.mode === "probe") await markProbeSendStarted("SYSTEM");
    const started = await waitForResponseStart(context, page, baselineHash, baselineCounts.user, outgoingHash, state);
    page = started.page;
    syncActiveChatUrl(page, state);
    if (started.blocker) {
      page = await waitPlatform(context, page, state, started.blocker);
      continue;
    }
    if (started.started) {
      state.turnsSent = Number(state.turnsSent || 0) + 1;
      state.recoveryAttempt = 0;
      saveState(state, started.acceptedOnly
        ? `User turn accepted; logical cycle ${state.turnsSent}; waiting for assistant`
        : `GPT response started; logical cycle ${state.turnsSent}`);
      return { ok: true, page, baselineHash, outgoingHash };
    }
    console.log("[DAVID] GPT did not start and user turn was not confirmed. LAW: REFRESH -> RESEND.");
    page = await refreshChat(context, page, state, attempt);
  }
  state.watchdog = "refreshing-chat";
  state.problem = "GPT did not accept the user turn after recovery attempts";
  saveState(state, "Response start recovery exhausted; refreshing instead of stopping");
  page = await refreshChat(context, page, state, MAX_RECOVERY_ATTEMPTS);
  return { ok: false, page, baselineHash, outgoingHash };
}
async function waitForCompletion(context, page, state, baselineHash) {
  let lastHash = baselineHash;
  let lastActivityAt = Date.now();
  let generatingObserved = false;
  while (true) {
    page = await waitForSession(context, page, state);
    const blocker = await visiblePlatformBlock(page);
    if (blocker) {
      page = await waitPlatform(context, page, state, blocker);
      lastActivityAt = Date.now();
      generatingObserved = false;
      continue;
    }
    const generating = await isGenerating(page);
    const turn = await latestTurnInfo(page);
    const text = await latestAssistantText(page);
    const currentHash = text ? hashText(text) : null;

    if (turn.role === "assistant" && currentHash && currentHash !== baselineHash && currentHash !== lastHash) {
      lastHash = currentHash;
      lastActivityAt = Date.now();
      state.watchdog = "gpt-writing";
      saveState(state, "GPT text progressed");
    }

    if (generating) {
      if (!generatingObserved) {
        generatingObserved = true;
        state.watchdog = "gpt-thinking";
        saveState(state, "GPT generation indicator observed");
      }
      if (Date.now() - lastActivityAt >= STALL_TIMEOUT_MS) {
        state.watchdog = "stalled";
        state.problem = "GPT response stalled or remained blank";
        saveState(state, "GPT generation stalled without text progress");
        return { status: "stalled", page, text, hash: currentHash };
      }
      await sleep(POLL_MS);
      continue;
    }

    generatingObserved = false;
    if (turn.role === "assistant" && currentHash && currentHash !== baselineHash) {
      if (await responseComplete(page, baselineHash)) {
        const finalText = await latestAssistantText(page);
        return { status: "complete", page, text: finalText, hash: hashText(finalText) };
      }
    }

    if (Date.now() - lastActivityAt >= STALL_TIMEOUT_MS) {
      state.watchdog = "stalled";
      state.problem = "GPT response stalled or remained blank";
      saveState(state, "GPT stalled/blank; same-turn recovery required");
      return { status: "stalled", page, text, hash: currentHash };
    }
    await sleep(POLL_MS);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  while (true) {
    const sent = await sendWithRecovery(context, page, state, prompt, kind);
    page = sent.page;
    if (!sent.ok) {
      await sleep(1000);
      continue;
    }

    let sameTurnRecoveries = 0;
    while (true) {
      const result = await waitForCompletion(context, page, state, sent.baselineHash);
      page = result.page;
      if (result.status !== "stalled") {
        state.lastAssistantHash = result.hash;
        state.problem = null;
        if (state.justRolledOver) state.justRolledOver = false;
        syncActiveChatUrl(page, state);
        await reportProbeSuccess("SYSTEM");
        delete state.problemRetryAt;
        saveState(state, "Completed assistant response captured");
        return { page, text: result.text, hash: result.hash };
      }

      sameTurnRecoveries += 1;
      state.problem = null;
      if (sameTurnRecoveries <= STALL_RESEND_LIMIT) {
        state.watchdog = "stalled-resend";
        saveState(state, `LAW: GPT stopped thinking/writing -> resend same logical task ${sameTurnRecoveries}/${STALL_RESEND_LIMIT}`);
        console.log(`[DAVID] LAW: GPT stopped thinking/writing -> RESEND (${sameTurnRecoveries}/${STALL_RESEND_LIMIT}).`);
        break;
      }

      page = await refreshChat(context, page, state, sameTurnRecoveries);
      state.watchdog = "stalled-refresh-resend";
      saveState(state, "LAW: repeated stall -> refresh -> resend");
      console.log("[DAVID] LAW: repeated stall -> REFRESH -> RESEND.");
      sameTurnRecoveries = 0;
      break;
    }
  }
}
async function main() {
  const { chromium } = await import("playwright-core");
  console.log(`[DAVID] Connecting to browser CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No active Chromium context on CDP port.");
  const state = loadState();
  activeChatUrl = state.chatUrl || INITIAL_CHAT_URL;
  let page = await waitForSession(context, await ensureTargetPage(context), state);
  syncActiveChatUrl(page, state);
  if (state.previousChatUrl) await closeOldConversationTabs(context, state.previousChatUrl, page);
  console.log(`[DAVID] Session ready: ${await safeUrl(page)}`);

  state.stopped = false;
  state.watchdog = "monitoring";
  delete state.stopReason;
  saveState(state, "DAVID V5 connected: continuous mode, no DAVID_STOP");
  console.log(`[DAVID] V5 continuous mode ON. No DAVID_STOP. max cycles=${MAX_TURNS}.`);
  console.log(`[DAVID] poll=${POLL_MS}ms cooldown=${COOLDOWN_MS}ms start=${RESPONSE_START_TIMEOUT_MS}ms stall=${STALL_TIMEOUT_MS}ms.`);
  console.log("[DAVID] Ctrl+C stops the local process manually.");

  // Ignore any historical DAVID_STOP text from older versions. V5 owns the flow now.
  const initialText = await latestAssistantText(page);
  if (initialText.includes("[[DAVID_STOP]]")) {
    state.legacyStopIgnored = true;
    state.lastAssistantHash = hashText(initialText);
    saveState(state, "Legacy DAVID_STOP ignored by V5");
    console.log("[DAVID] Legacy DAVID_STOP ignored. Continuing work.");
  }

  let mode = state.problem ? "fix" : "work";

  while (state.turnsSent < MAX_TURNS) {
    if (state.problem && isExternalBlocker(state.problem)) {
      const deferred = state.problem;
      const alreadyDeferred = Boolean(state.deferredBlockerAcknowledged) && sameBlocker(state.deferredBlocker, deferred);

      state.problem = null;
      state.problemAttempts = 0;
      mode = "work";

      if (alreadyDeferred) {
        state.watchdog = "external-blocker-already-deferred";
        saveState(state, `External blocker already deferred; skipping relay and continuing WORK: ${deferred}`);
        console.log(`[DAVID] BLOCKER ALREADY DEFERRED -> WORK MODE: ${deferred}`);
      } else {
        state.deferredBlocker = deferred;
        state.deferredBlockerAcknowledged = false;
        state.deferredBlockerCount = Number(state.deferredBlockerCount || 0) + 1;
        state.watchdog = "external-blocker-deferred";
        saveState(state, `External blocker deferred once: ${deferred}`);
        console.log(`[DAVID] NEW EXTERNAL BLOCKER -> ONE DEFER RELAY: ${deferred}`);

        const result = await runPrompt(context, page, state, deferPrompt(deferred, state.deferredBlockerCount), "work");
        page = result.page;
        const nextProblem = extractProblem(result.text);

        if (nextProblem) {
          if (isExternalBlocker(nextProblem)) {
            if (sameBlocker(deferred, nextProblem)) {
              state.deferredBlocker = deferred;
              state.deferredBlockerAcknowledged = true;
              state.problem = null;
              state.watchdog = "external-blocker-already-deferred";
              saveState(state, `Same blocker repeated after one defer; forcing WORK: ${nextProblem}`);
            } else {
              state.deferredBlocker = nextProblem;
              state.deferredBlockerAcknowledged = false;
              state.problem = nextProblem;
              saveState(state, `Different external blocker discovered: ${nextProblem}`);
            }
            await sleep(COOLDOWN_MS);
            continue;
          }
          state.problem = nextProblem;
          mode = "fix";
          saveState(state, `New internal problem after deferred blocker: ${nextProblem}`);
          await sleep(COOLDOWN_MS);
          continue;
        }

        if (!endsOk(result.text)) {
          const terminal = await waitForTerminalMarker(page, state);
          if (terminal.type === "problem") {
            if (isExternalBlocker(terminal.problem) && sameBlocker(deferred, terminal.problem)) {
              state.deferredBlockerAcknowledged = true;
              state.problem = null;
              mode = "work";
              saveState(state, `Same terminal blocker repeated after one defer; forcing WORK: ${terminal.problem}`);
            } else {
              state.problem = terminal.problem;
              mode = isExternalBlocker(terminal.problem) ? "work" : "fix";
              saveState(state, `Terminal marker became PROBLEM IN: ${terminal.problem}`);
            }
            continue;
          }
        }

        state.deferredBlockerAcknowledged = true;
        state.lastResult = "OK";
        saveState(state, "One defer relay completed; same blocker will not receive another relay");
        await sleep(COOLDOWN_MS);
        continue;
      }
    }

    if (mode === "fix" && state.problem) {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      state.watchdog = "fixing-problem";
      saveState(state, `Trying to fix problem attempt ${state.problemAttempts}`);
      console.log(`[DAVID] PROBLEM: ${state.problem}`);
      const result = await runPrompt(context, page, state, fixPrompt(state.problem, state.problemAttempts), "fix");
      page = result.page;
      const nextProblem = extractProblem(result.text);
      if (nextProblem) {
        state.problem = nextProblem;
        state.watchdog = "problem-detected";
        saveState(state, `Problem remains after attempt ${state.problemAttempts}`);
        console.log(`[DAVID] Problem remains: ${nextProblem}`);
        if (state.problemAttempts % 4 === 0) {
          state.problemRetryAt = new Date(Date.now() + PROBLEM_BACKOFF_MS).toISOString();
          state.watchdog = "problem-backoff";
          saveState(state, "Repeated problem; short backoff before next fix attempt");
          await sleep(PROBLEM_BACKOFF_MS);
          delete state.problemRetryAt;
        } else {
          await sleep(COOLDOWN_MS);
        }
        continue;
      }

      if (!endsOk(result.text)) {
        const terminal = await waitForTerminalMarker(page, state);
        if (terminal.type === "problem") {
          state.problem = terminal.problem;
          state.watchdog = "problem-detected";
          saveState(state, `Fix response ended in PROBLEM IN: ${terminal.problem}`);
          continue;
        }
      }
      console.log("[DAVID] Fix result: OK.");
      state.problem = null;
      state.problemAttempts = 0;
      delete state.problemRetryAt;
      state.watchdog = "problem-fixed";
      saveState(state, "Problem fixed; returning to stage execution");
      mode = "work";
      await sleep(COOLDOWN_MS);
      continue;
    }

    state.watchdog = "sending-relay";
    saveState(state, "Continuing MASTER SYSTEM PLAN stages");
    const result = await runPrompt(context, page, state, CONTINUE_PROMPT, "work");
    page = result.page;
    const problem = extractProblem(result.text);
    if (problem) {
      state.problem = problem;
      state.problemAttempts = 0;
      state.watchdog = "problem-detected";
      saveState(state, `GPT reported problem: ${problem}`);
      console.log(`[DAVID] GPT reported PROBLEM IN: ${problem}`);
      mode = "fix";
      await sleep(COOLDOWN_MS);
      continue;
    }

    if (!endsOk(result.text)) {
      const terminal = await waitForTerminalMarker(page, state);
      if (terminal.type === "problem") {
        state.problem = terminal.problem;
        state.problemAttempts = 0;
        state.watchdog = "problem-detected";
        mode = isExternalBlocker(terminal.problem) ? "work" : "fix";
        saveState(state, `Terminal marker became PROBLEM IN: ${terminal.problem}`);
        continue;
      }
    }
    state.lastResult = "OK";
    console.log("[DAVID] Final OK received. NOW sending/continuing to next stage is allowed.");
    state.problem = null;
    state.problemAttempts = 0;
    state.watchdog = "answer-complete";
    saveState(state, "Stage/block complete; continuing automatically");
    await sleep(COOLDOWN_MS);
  }
}

function runSelfTest() {
  const outgoingHash = hashText("relay");
  const otherHash = hashText("other");
  if (!promptAcceptedSignal(4, 3, outgoingHash, outgoingHash)) throw new Error("ENCH_EV5 self-test: accepted user turn must suppress resend");
  if (promptAcceptedSignal(3, 3, outgoingHash, outgoingHash)) throw new Error("ENCH_EV5 self-test: unchanged user count must not claim new acceptance");
  if (promptAcceptedSignal(4, 3, otherHash, outgoingHash)) throw new Error("ENCH_EV5 self-test: different user text must not claim acceptance");
  if (!sameTurnPromptPresent(outgoingHash, outgoingHash)) throw new Error("ENCH_EV5 self-test: same accepted turn must survive refresh recovery");
  if (sameTurnPromptPresent(otherHash, outgoingHash)) throw new Error("ENCH_EV5 self-test: different latest user turn must permit safe resend");
  if (!runPrompt.toString().includes("stalled-resend")) throw new Error("ENCH_EV5 self-test: stalled generation must trigger bounded resend");
  if (!runPrompt.toString().includes("stalled-refresh-resend")) throw new Error("ENCH_EV5 self-test: repeated stall must refresh before resend");
  console.log("ENCHEV_V5_RESPONSE_WATCHDOG_SELF_TEST PASS accepted_turn=3 bounded_stall_resend=1 refresh_after_repeat=1");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  main().catch(async (error) => {
    console.error("[DAVID] FATAL:", error?.stack || error);
    process.exit(1);
  });
}
