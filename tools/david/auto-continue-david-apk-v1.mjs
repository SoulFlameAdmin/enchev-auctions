import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_APK_STATE_FILE || path.join(process.cwd(), ".david-apk-state.json");
const ENV_CHAT_URL = process.env.DAVID_APK_CHAT_URL || "";
const POLL_MS = Number(process.env.DAVID_APK_POLL_MS || 900);
const START_TIMEOUT_MS = Number(process.env.DAVID_APK_START_TIMEOUT_MS || 15000);
const STALL_MS = Number(process.env.DAVID_APK_STALL_MS || 70000);
const COOLDOWN_MS = Number(process.env.DAVID_APK_COOLDOWN_MS || 1200);
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_STABLE_SAMPLES = Number(process.env.DAVID_COMPLETE_STABLE_SAMPLES || 5);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const PROBLEM_PREFIX = "PROBLEM IN:";
const MARKER = "[DAVID_RELAY_APK_V1]";
const DEPLOY_LAW = `
DAVID VERCEL DEPLOY LAW:
- Before ANY Vercel create/update/redeploy, claim the global Supabase lease:
  select public.david_claim_vercel_deploy('DAVID_APK','soulflame-twins',<commit_sha_or_null>,900);
- granted=false => DO NOT deploy; continue dependency-safe APK work.
- granted=true => mark deploying, perform exactly one intended deployment, then release with public.david_release_vercel_deploy('DAVID_APK',<success>,<detail_json>).
- Record quota/rate-limit backoff only when Vercel gives a real retry time. Never invent one.
`;
const TITLE_MATCH = /(DAVID\s*Phone|SoulFlame\s*Twins|DAVID\s*APK)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (x) => createHash("sha256").update(String(x || "")).digest("hex");

let activeChatUrl = "";

const APK_PROMPT = `@GitHub

Продължи СЕГА разработката на DAVID Phone / SoulFlame Twins в SoulFlameAdmin/soulflame-twins.
Текущата доказана линия е PR #111, branch test/david-phone-v039-fixed-chat-link-20260918, DAVID Phone v0.3.9 fixed GPT chat routing.

Първо провери реалното текущо GitHub/PR/CI състояние и не повтаряй вече завършена работа. После изпълни една най-важна следваща dependency-safe стъпка към стабилен DAVID Phone APK: voice/app commands, contacts/messaging, permissions, updater, build/tests и безопасен release handoff според реалното състояние.

DAVID APK UPGRADE LAW:
- продължавай upgrade-а версия по версия, без да рестартираш завършена работа;
- работи в test branch/PR, не директно в main;
- преди следващ upgrade първо стабилизирай текущия: build + приложими tests + evidence;
- ако build/test се счупи, поправи го преди нов feature;
- пази GPT chat routing и current session continuity;
- не merge-вай/release-вай към production без изрично разрешение, но можеш да подготвяш доказан APK build/artifact и PR;
- след успешно завършен блок автоматично премини към следващия най-важен upgrade.

Работи в test branch, пусни приложимите build/tests, поправи грешките и остави evidence. Не измисляй резултати, не заобикаляй login/CAPTCHA/MFA/permissions и не прави destructive действие без разрешение.
Ако стъпката е успешно завършена и доказана, последният ред да е: OK
Ако има реален blocker, последният ред да е: ${PROBLEM_PREFIX} <точният проблем>

${DEPLOY_LAW}

${MARKER}`;

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { turnsSent: 0, problem: null, problemAttempts: 0, watchdog: "boot" }; }
}
function save(state, action) {
  if (action) state.lastAction = action;
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
function cleanConversationUrl(url) {
  const m = String(url || "").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?#]|$)/i);
  return m ? m[0] : null;
}
function extractProblem(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = rows.length - 1; i >= 0; i--) {
    const p = rows[i].toUpperCase().indexOf(PROBLEM_PREFIX);
    if (p >= 0) return rows[i].slice(p + PROBLEM_PREFIX.length).trim() || "Unknown APK blocker";
  }
  return null;
}
function endsOk(text) {
  const rows = String(text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return Boolean(rows.length && /^OK[.!]?$/i.test(rows.at(-1)));
}
function fixPrompt(problem, attempt) {
  return `@GitHub

DAVID APK PROBLEM:
${problem}

TRY TO MAKE THIS FIX YOURSELF NOW. Опит ${attempt}. Провери SoulFlameAdmin/soulflame-twins, PR #111 и текущите CI/build evidence. Опитай безопасен технически fix или валиден алтернативен подход. Не измисляй evidence и не заобикаляй login/CAPTCHA/MFA/permissions.

Ако fix-ът е доказан: OK
Ако още е блокирано: ${PROBLEM_PREFIX} <точният оставащ проблем>

След успешен fix продължи следващата dependency-safe DAVID Phone/APK задача.

${DEPLOY_LAW}
${MARKER}`;
}

async function discoverApkChat(context) {
  const candidates = new Map();
  for (const page of context.pages()) {
    if (page.isClosed()) continue;
    try {
      const own = cleanConversationUrl(page.url());
      const title = await page.title().catch(() => "");
      if (own && TITLE_MATCH.test(title)) candidates.set(own, title);
      if (!page.url().includes("chatgpt.com")) continue;
      const links = await page.locator('a[href^="/c/"],a[href*="chatgpt.com/c/"]').evaluateAll((els) =>
        els.map((el) => ({
          href: el.getAttribute("href") || "",
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          title: el.getAttribute("title") || "",
          aria: el.getAttribute("aria-label") || ""
        }))
      ).catch(() => []);
      for (const item of links) {
        const label = `${item.text} ${item.title} ${item.aria}`.trim();
        if (!TITLE_MATCH.test(label)) continue;
        const raw = item.href.startsWith("http") ? item.href : `https://chatgpt.com${item.href}`;
        const u = cleanConversationUrl(raw);
        if (u) candidates.set(u, label);
      }
    } catch {}
  }
  if (candidates.size === 1) return [...candidates.keys()][0];
  if (candidates.size > 1) {
    console.log("[APK] Multiple matching ChatGPT sessions found; refusing to guess:");
    for (const [u, label] of candidates) console.log(`[APK]   ${label} -> ${u}`);
  }
  return null;
}

async function ensureApkUrl(context, state) {
  const fromEnv = cleanConversationUrl(ENV_CHAT_URL);
  const fromState = cleanConversationUrl(state.chatUrl);
  activeChatUrl = fromEnv || fromState || activeChatUrl;
  if (activeChatUrl) return activeChatUrl;
  const discovered = await discoverApkChat(context);
  if (discovered) {
    activeChatUrl = discovered;
    state.chatUrl = discovered;
    state.sessionSource = "chatgpt-sidebar-auto-discovery";
    save(state, `APK session auto-discovered: ${discovered}`);
    console.log(`[APK] Auto-discovered session: ${discovered}`);
    return discovered;
  }
  state.watchdog = "needs-apk-session";
  save(state, "Waiting for unique DAVID Phone / SoulFlame Twins / DAVID APK ChatGPT session");
  return null;
}

async function ensurePage(context, current, state) {
  const target = await ensureApkUrl(context, state);
  if (!target) return null;
  if (current && !current.isClosed() && cleanConversationUrl(current.url()) === target) return current;
  const existing = context.pages().find((p) => !p.isClosed() && cleanConversationUrl(p.url()) === target);
  if (existing) return existing;
  const page = await context.newPage();
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  return page;
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
  if (closed) console.log(`[APK] Closed ${closed} stale old conversation tab(s): ${oldConversationUrl}`);
  return closed;
}

async function conversationLimitReached(page) {
  try {
    return await page.evaluate(() => {
      const re = /(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i;
      const visible = (el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
      };
      for (const el of document.querySelectorAll("div,section,p,span")) {
        if (!visible(el)) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && t.length < 500 && re.test(t)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function rolloverConversation(context, page, state) {
  const oldUrl = cleanConversationUrl(page?.url?.()) || page?.url?.() || activeChatUrl;
  
  const oldPage = page;
  state.previousChatUrl = oldUrl;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), oldUrl])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = "apk-conversation-rollover";

  const event = {
    number: state.rolloverCount,
    oldUrl: cleanConversationUrl(oldUrl) || oldUrl,
    newUrl: null,
    startedAt: new Date().toISOString(),
    oldTabClosedAt: null
  };
  state.rolloverHistory = [...(Array.isArray(state.rolloverHistory) ? state.rolloverHistory : []), event].slice(-50);

  const newPage = await context.newPage();
  await newPage.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  activeChatUrl = "https://chatgpt.com/";
  state.chatUrl = activeChatUrl;

  if (oldPage && !oldPage.isClosed()) {
    await oldPage.close({ runBeforeUnload: false }).catch(() => {});
    event.oldTabClosedAt = new Date().toISOString();
  }
  await closeOldConversationTabs(context, oldUrl, newPage);
  save(state, `APK conversation max length -> new tab #${state.rolloverCount}; old tab closed`);
  console.log(`[APK] Conversation max length -> NEW TAB #${state.rolloverCount}; OLD TAB CLOSED.`);
  await sleep(1200);
  return newPage;
}

function syncChatUrl(page, state) {
  const u = cleanConversationUrl(page?.url?.());
  if (!u || u === activeChatUrl) return;
  activeChatUrl = u;
  state.chatUrl = u;
  state.pendingNewChat = false;
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
  console.log(`[APK] Active conversation: ${u}`);
}

async function composer(page) {
  if (!page || page.isClosed()) return null;
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
    return x.last().getAttribute("data-message-author-role").catch(() => null);
  } catch { return null; }
}
async function generating(page) {
  for (const s of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]','button[aria-label*="stop"]','button[aria-label*="Спри"]','button:has-text("Stop generating")','button:has-text("Stop thinking")','button:has-text("Stop response")','button:has-text("Спри генерирането")','button:has-text("Спри да мисли")','button:has-text("Спри отговора")']) {
    try {
      const x = page.locator(s).last();
      if (await x.count() && await x.isVisible().catch(() => false)) return true;
    } catch {}
  }
  return false;
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

    if (
      stableSamples >= COMPLETE_STABLE_SAMPLES &&
      Date.now() - stableSince >= COMPLETE_QUIET_MS &&
      !await generating(page)
    ) return true;

    await sleep(COMPLETE_SAMPLE_MS);
  }
  return false;
}

async function waitReady(context, page, state) {
  while (true) {
    if (!activeChatUrl || activeChatUrl === "https://chatgpt.com/") {
      if (activeChatUrl === "https://chatgpt.com/" && page && !page.isClosed()) {
        if (await composer(page)) return page;
      } else {
        const found = await ensureApkUrl(context, state);
        if (!found) { await sleep(3000); continue; }
      }
    }
    page = await ensurePage(context, page, state);
    if (!page) { await sleep(3000); continue; }
    if (page.url().includes("/login") || page.url().includes("/auth/")) { await sleep(1500); continue; }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      continue;
    }
    syncChatUrl(page, state);
    if (await composer(page) || await latestAssistant(page)) return page;
    await sleep(POLL_MS);
  }
}
async function fillAndSend(page, text) {
  const c = await composer(page);
  if (!c) throw new Error("APK ChatGPT composer not found");
  try { await c.fill(text); } catch {
    await c.click();
    await c.evaluate((el, value) => {
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    }, text);
  }
  await sleep(250);
  for (const s of ['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']) {
    const b = page.locator(s).last();
    if (await b.count() && await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) {
      await b.click();
      return;
    }
  }
  await c.press("Enter");
}
async function runPrompt(context, page, state, prompt, kind) {
  let stallResends = 0;
  for (;;) {
    page = await waitReady(context, page, state);
    const base = hash(await latestAssistant(page));
    const outgoing = state.justRolledOver
      ? `AUTOMATIC CHAT ROLLOVER: The previous DAVID Phone/APK conversation reached its maximum length. Reconstruct the exact current state from SoulFlameAdmin/soulflame-twins, PR #111, branch history and CI evidence. Continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
      : prompt;
    state.watchdog = kind === "fix" ? "apk-fixing-problem" : "apk-sending-relay";
    save(state, kind === "fix" ? "APK: sending fix instruction" : "APK: sending next task");
    await fillAndSend(page, outgoing);

    const startEnd = Date.now() + START_TIMEOUT_MS;
    let started = false;
    while (Date.now() < startEnd) {
      if (await generating(page)) { started = true; break; }
      const text = await latestAssistant(page);
      if (text && hash(text) !== base) { started = true; break; }
      await sleep(POLL_MS);
    }
    if (!started) {
      state.watchdog = "apk-no-thinking-refresh";
      save(state, "LAW: APK GPT did not start thinking -> refresh -> resend");
      console.log("[APK] LAW: no thinking -> REFRESH -> RESEND.");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(1800);
      continue;
    }

    state.turnsSent = Number(state.turnsSent || 0) + 1;
    save(state, `APK GPT started cycle ${state.turnsSent}`);
    let last = base, lastActivity = Date.now();
    while (true) {
      page = await waitReady(context, page, state);
      const text = await latestAssistant(page);
      const h = hash(text);
      if (await generating(page)) {
        lastActivity = Date.now();
      } else if (text && h !== base) {
        if (h !== last) { last = h; lastActivity = Date.now(); }
        if (await complete(page, base)) {
          if (state.justRolledOver) state.justRolledOver = false;
          syncChatUrl(page, state);
          state.lastAssistantHash = h;
          save(state, "APK response complete");
          return { page, text };
        }
      }
      if (Date.now() - lastActivity > STALL_MS) {
        stallResends += 1;
        if (stallResends <= 2) {
          state.watchdog = "apk-stalled-resend";
          save(state, `LAW: APK GPT stopped thinking/writing -> resend ${stallResends}/2`);
          console.log(`[APK] LAW: stopped thinking/writing -> RESEND (${stallResends}/2).`);
          await sleep(800);
          break;
        }
        state.watchdog = "apk-stalled-refresh-resend";
        save(state, "LAW: repeated APK stall -> refresh -> resend");
        console.log("[APK] LAW: repeated stall -> REFRESH -> RESEND.");
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await sleep(1800);
        stallResends = 0;
        break;
      }
      await sleep(POLL_MS);
    }
  }
}

async function main() {
  console.log(`[APK] Connecting to shared Edge CDP ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No shared Edge context");
  const state = loadState();
  activeChatUrl = cleanConversationUrl(ENV_CHAT_URL) || cleanConversationUrl(state.chatUrl) || "";
  let page = await waitReady(context, null, state);
  if (state.previousChatUrl) await closeOldConversationTabs(context, state.previousChatUrl, page);
  console.log(`[APK] Session ready: ${page.url()}`);
  state.watchdog = "apk-monitoring";
  save(state, "DAVID APK worker connected");

  while (true) {
    if (state.problem) {
      state.problemAttempts = Number(state.problemAttempts || 0) + 1;
      const result = await runPrompt(context, page, state, fixPrompt(state.problem, state.problemAttempts), "fix");
      page = result.page;
      const problem = extractProblem(result.text);
      if (problem) {
        state.problem = problem;
        save(state, `APK problem remains: ${problem}`);
        await sleep(state.problemAttempts % 4 === 0 ? 30000 : COOLDOWN_MS);
        continue;
      }
      state.problem = null;
      state.problemAttempts = 0;
      state.lastResult = endsOk(result.text) ? "OK" : "completed";
      save(state, "APK problem fixed; continuing");
      await sleep(COOLDOWN_MS);
      continue;
    }

    const result = await runPrompt(context, page, state, APK_PROMPT, "work");
    page = result.page;
    const problem = extractProblem(result.text);
    if (problem) {
      state.problem = problem;
      state.problemAttempts = 0;
      save(state, `APK GPT reported: ${problem}`);
      await sleep(COOLDOWN_MS);
      continue;
    }
    state.lastResult = endsOk(result.text) ? "OK" : "completed";
    save(state, "APK task/block complete; continuing automatically");
    await sleep(COOLDOWN_MS);
  }
}

main().catch((e) => {
  console.error("[APK] FATAL", e?.stack || e);
  process.exit(1);
});
