import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { waitForGlobalSendPermit, reportProbeSuccess, markGlobalSendStarted } from "./chatgpt-rate-limit-coordinator.mjs";
import { CHATGPT_ROOT, rotateOwnedChatPage } from "./chatgpt-session-rotation.mjs";
import { ensureChatGptEffortMode } from "./chatgpt-effort-mode.mjs";
import { sendPromptVerified } from "./chatgpt-send-ack.mjs";

const EFFORT_MODE = String(process.env.DAVID_PROJECT_EFFORT_MODE || "medium").toLowerCase();

const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const STATE_FILE = process.env.DAVID_APK_STATE_FILE || path.join(process.cwd(), ".david-apk-state.json");
const ENV_CHAT_URL = process.env.DAVID_APK_CHAT_URL || "";
const FRESH_SESSION_ON_START = process.env.DAVID_FRESH_SESSIONS_ON_START === "1";
const POLL_MS = Number(process.env.DAVID_APK_POLL_MS || 900);
const START_TIMEOUT_MS = Number(process.env.DAVID_APK_START_TIMEOUT_MS || 60000);
const STALL_MS = Number(process.env.DAVID_APK_STALL_MS || 600000);
const COOLDOWN_MS = Number(process.env.DAVID_APK_COOLDOWN_MS || 1200);
const COMPLETE_QUIET_MS = Number(process.env.DAVID_COMPLETE_QUIET_MS || 7000);
const COMPLETE_STABLE_SAMPLES = Number(process.env.DAVID_COMPLETE_STABLE_SAMPLES || 5);
const COMPLETE_SAMPLE_MS = Number(process.env.DAVID_COMPLETE_SAMPLE_MS || 1200);
const SEMANTIC_TERMINAL_QUIET_MS = Number(process.env.DAVID_SEMANTIC_TERMINAL_QUIET_MS || 15000);
const PROBLEM_PREFIX = "PROBLEM IN:";
const MARKER = "[DAVID_RELAY_APK_V1]";
const TAB_NAME = "DAVID_APK_MANAGED_V1";
const PENDING_TAB_NAME = "DAVID_APK_PENDING_V1";
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

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}

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
  return Boolean(rows.length && /^OK$/i.test(rows.at(-1)));
}
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
        console.log("[APK] Stable semantic completion accepted. NO duplicate prompt.");
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
    console.log("[APK] Waiting for terminal evidence. NO NEW PROMPT.");
    await sleep(3000);
  }
}
function fixPrompt(problem, attempt) {
  return `@GitHub

DAVID APK PROBLEM:
${problem}

TRY TO MAKE THIS FIX YOURSELF NOW. Опит ${attempt}. Провери SoulFlameAdmin/soulflame-twins, PR #111 и текущите CI/build evidence. Опитай безопасен технически fix или валиден алтернативен подход. Не измисляй evidence и не заобикаляй login/CAPTCHA/MFA/permissions.

Ако fix-ът е доказан: OK
Ако още е блокирано: ${PROBLEM_PREFIX} <точният оставащ проблем>

След успешен fix продължи следващата dependency-safe DAVID Phone/APK задача.

${ORCHESTRATOR_LAW}\n\n${DEPLOY_LAW}
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
  if (FRESH_SESSION_ON_START && activeChatUrl === CHATGPT_ROOT) return null;
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

async function ensurePendingApkPage(context, current, state) {
  if (current && !current.isClosed()) {
    await setPageTag(current, PENDING_TAB_NAME);
    return current;
  }

  const tagged = await findTaggedPage(context, [PENDING_TAB_NAME, TAB_NAME]);
  if (tagged && !tagged.isClosed()) {
    await setPageTag(tagged, PENDING_TAB_NAME);
    return tagged;
  }

  const page = await context.newPage();
  await setPageTag(page, PENDING_TAB_NAME);
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  state.pendingNewChat = true;
  save(state, "APK pending ChatGPT tab created while waiting for session discovery");
  console.log("[APK] Pending ChatGPT tab created immediately; waiting for DAVID Phone/APK session discovery.");
  return page;
}


async function ensurePage(context, current, state) {
  const target = (FRESH_SESSION_ON_START && activeChatUrl === CHATGPT_ROOT) ? null : await ensureApkUrl(context, state);
  if (!target && activeChatUrl !== "https://chatgpt.com/") return null;

  if (current && !current.isClosed()) {
    const currentUrl = cleanConversationUrl(current.url());
    if ((target && currentUrl === target) || (!target && current.url().startsWith("https://chatgpt.com/"))) {
      await setPageTag(current, TAB_NAME);
      return current;
    }
  }

  const tagged = await findTaggedPage(context);
  if (tagged) {
    if (target && cleanConversationUrl(tagged.url()) !== target) {
      await tagged.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    }
    await setPageTag(tagged, TAB_NAME);
    return tagged;
  }

  const existing = target
    ? context.pages().find((p) => !p.isClosed() && cleanConversationUrl(p.url()) === target)
    : null;
  if (existing) {
    await setPageTag(existing, TAB_NAME);
    return existing;
  }

  const page = await context.newPage();
  await setPageTag(page, target ? TAB_NAME : PENDING_TAB_NAME);
  await page.goto(target || "https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await setPageTag(page, TAB_NAME);
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

async function rolloverConversation(context, page, state, reason = "conversation-limit") {
  const oldUrl = cleanConversationUrl(page?.url?.()) || page?.url?.() || activeChatUrl;
  if (!page || page.isClosed()) page = await ensurePage(context, null, state);
  if (!page || page.isClosed()) throw new Error("APK rollover requires one owned ChatGPT tab");

  state.previousChatUrl = oldUrl;
  state.staleChatUrls = Array.from(new Set([...(Array.isArray(state.staleChatUrls) ? state.staleChatUrls : []), oldUrl])).slice(-20);
  state.rolloverCount = Number(state.rolloverCount || 0) + 1;
  state.pendingNewChat = true;
  state.justRolledOver = true;
  state.watchdog = reason === "final-ok" ? "apk-session-rotate-after-ok" : "apk-conversation-rollover";

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
  save(state, `APK session rotation #${state.rolloverCount} (${reason}); reusing owned tab only`);

  const rotated = await rotateOwnedChatPage({
    page,
    getComposer: composer,
    setPageTag,
    pendingTag: PENDING_TAB_NAME,
    managedTag: TAB_NAME,
    onWait: async ({ phase, attempt, url }) => {
      state.watchdog = phase === "auth-wait" ? "apk-session-rotate-auth-wait" : "apk-session-rotate-wait";
      save(state, `APK session rotation waiting phase=${phase} attempt=${attempt} url=${url || "unknown"}; NO NEW TAB`);
    }
  });
  if (!rotated.ok) throw new Error(`APK same-tab session rotation failed: ${rotated.reason}`);

  event.oldTabReusedAt = new Date().toISOString();
  await closeOldConversationTabs(context, oldUrl, page);
  save(state, `APK fresh ChatGPT session ready in SAME TAB #${state.rolloverCount}; reason=${reason}`);
  console.log(`[APK] Fresh ChatGPT session ready in SAME TAB #${state.rolloverCount}; reason=${reason}. NO EXTRA TAB.`);
  return page;
}

function syncChatUrl(page, state) {
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

    if (
      stableSamples >= COMPLETE_STABLE_SAMPLES &&
      Date.now() - stableSince >= COMPLETE_QUIET_MS &&
      !await generating(page)
    ) return true;

    await sleep(COMPLETE_SAMPLE_MS);
  }
  return false;
}

async function sendTimeoutVisible(page) {
  try {
    return await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0 && r.width > 0 && r.height > 0;
      };
      const re = /(изпращането на съобщението изтече по време|message sending timed out|sending the message timed out|message send timed out)/i;
      for (const el of document.querySelectorAll('[role="alert"],[aria-live="assertive"],[data-testid*="error" i],div,section,p,span')) {
        if (!visible(el)) continue;
        if (el.closest('[data-message-author-role="assistant"]')) continue;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 360 && re.test(text)) return true;
      }
      return false;
    });
  } catch { return false; }
}

async function waitSendTimeoutRecovery(context, page, state) {
  state.problem = null;
  state.watchdog = "apk-send-timeout-wait-guard";
  save(state, "Message send timeout detected; central guard owns bounded Retry. APK will not duplicate-send.");
  console.log("[APK] SEND TIMEOUT: waiting for central guard. NO DUPLICATE RESEND.");
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    await sleep(1000);
    page = await ensurePage(context, page, state);
    if (await generating(page)) {
      state.watchdog = "apk-thinking";
      save(state, "Send-timeout retry accepted; GPT active");
      return page;
    }
    if (!await sendTimeoutVisible(page)) {
      state.watchdog = "apk-send-timeout-recovered";
      save(state, "Message send timeout cleared by central guard");
      return page;
    }
  }
  console.log("[APK] SEND TIMEOUT still visible after 60s. Refreshing view only; no worker resend.");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(2500);
  return page;
}

async function waitReady(context, page, state) {
  while (true) {
    if (FRESH_SESSION_ON_START && activeChatUrl === CHATGPT_ROOT) {
      page = await ensurePage(context, page, state);
    } else {
      if (!activeChatUrl || activeChatUrl === "https://chatgpt.com/") {
        if (activeChatUrl === "https://chatgpt.com/" && page && !page.isClosed()) {
          if (await composer(page)) return page;
        } else {
          const found = await ensureApkUrl(context, state);
          if (!found) {
            page = await ensurePendingApkPage(context, page, state);

            // A new dedicated Edge profile may not expose enough sidebar
            // history for unique APK discovery. Never deadlock the APK worker:
            // reuse this owned pending tab as a fresh conversation and rebuild
            // exact project state from GitHub/PR/CI evidence in the work prompt.
            activeChatUrl = CHATGPT_ROOT;
            state.chatUrl = CHATGPT_ROOT;
            state.pendingNewChat = true;
            state.freshStartPending = true;
            state.sessionSource = "fresh-owned-tab-after-discovery-miss";
            state.watchdog = "apk-fresh-owned-tab-ready";
            save(state, "No unique APK session discovered -> continue in owned fresh ChatGPT tab");
            console.log("[APK] No unique prior APK session found. Using owned fresh tab and reconstructing from GitHub evidence.");

            if (await composer(page)) {
              const effort = await ensureChatGptEffortMode(page, EFFORT_MODE).catch(() => ({ ok: false }));
              if (effort?.changed) console.log("[APK] ChatGPT effort forced to "+EFFORT_MODE+".");
              return page;
            }

            await sleep(POLL_MS);
            continue;
          }
        }
      }
      page = await ensurePage(context, page, state);
    }
    if (!page) { await sleep(3000); continue; }
    if (page.url().includes("/login") || page.url().includes("/auth/")) { await sleep(1500); continue; }
    if (await conversationLimitReached(page)) {
      page = await rolloverConversation(context, page, state);
      continue;
    }
    syncChatUrl(page, state);
    if (await composer(page) || await latestAssistant(page)) {
      const effort = await ensureChatGptEffortMode(page, EFFORT_MODE).catch(() => ({ ok: false }));
      if (effort?.changed) console.log("[APK] ChatGPT effort forced to "+EFFORT_MODE+".");
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
    worker: "APK",
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

async function waitForScientistSupervision(state, reason) {
  state.problem = reason;
  state.watchdog = "apk-awaiting-supervision";
  save(state, "Recovery budget exhausted; SF Scientist / Unified Supervisor must diagnose before restart");
  console.log("[APK] Recovery budget exhausted -> AWAITING SF SCIENTIST / SUPERVISOR.");
  while (true) {
    state.supervisionHeartbeatAt = new Date().toISOString();
    save(state, "Awaiting SF Scientist / Unified Supervisor; no further refresh/resend");
    await sleep(15000);
  }
}
async function runPrompt(context, page, state, prompt, kind) {
  let stallResends = 0;
  let stallRefreshes = 0;
  let noStartRecoveries = 0;
  for (;;) {
    page = await waitReady(context, page, state);
    const base = hash(await latestAssistant(page));
    const outgoing = state.justRolledOver
      ? state.freshStartPending
        ? `AUTOMATIC FRESH RESTART HANDOFF: DAVID restarted cleanly into a new DAVID Phone/APK ChatGPT conversation. Reconstruct the exact current state from SoulFlameAdmin/soulflame-twins, PR #111, branch history and CI evidence. Continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
        : `AUTOMATIC CHAT ROLLOVER: The previous DAVID Phone/APK conversation reached its maximum length. Reconstruct the exact current state from SoulFlameAdmin/soulflame-twins, PR #111, branch history and CI evidence. Continue from the next unfinished dependency-safe task. Do NOT restart completed work.\n\n${prompt}`
      : prompt;
    state.watchdog = kind === "fix" ? "apk-fixing-problem" : "apk-sending-relay";
    save(state, kind === "fix" ? "APK: sending fix instruction" : "APK: sending next task");
    const permit = await waitForGlobalSendPermit("APK", async (decision) => {
      state.watchdog = "global-rate-limit-wait";
      state.problem = null;
      state.problemRetryAt = decision.state?.blockedUntil || decision.state?.probeLeaseUntil || null;
      save(state, `GLOBAL RATE LIMIT WAIT mode=${decision.mode}; owner=${decision.state?.probeOwner || "none"}`);
    });
    if (/ChatGPT platform: (?:global )?rate limit/i.test(String(state.problem || ""))) {
      state.problem = null;
      delete state.problemRetryAt;
      state.watchdog = "apk-send-permit";
      save(state, "ChatGPT platform rate-limit wait cleared by global coordinator; no project defer relay");
    }
    if (permit.mode === "probe") {
      state.watchdog = "global-rate-limit-probe";
      save(state, "APK owns the single post-cooldown probe send; no refresh required");
    }
    await fillAndSend(page, outgoing, state);
    await markGlobalSendStarted("APK");

    let startEnd = Date.now() + START_TIMEOUT_MS;
    let started = false;
    while (Date.now() < startEnd) {
      if (await sendTimeoutVisible(page)) {
        page = await waitSendTimeoutRecovery(context, page, state);
        startEnd = Date.now() + START_TIMEOUT_MS;
        continue;
      }
      if (await generating(page)) { started = true; break; }
      const text = await latestAssistant(page);
      if (text && hash(text) !== base) { started = true; break; }
      await sleep(POLL_MS);
    }
    if (!started) {
      state.watchdog = "apk-no-start-grace";
      save(state, "APK GPT did not start yet; WAIT 30s and verify same turn before any refresh");
      console.log("[APK] No start yet -> WAIT 30s, verify same turn. NO REFRESH.");
      const graceEnd = Date.now() + 30000;
      while (Date.now() < graceEnd) {
        if (await sendTimeoutVisible(page)) {
          page = await waitSendTimeoutRecovery(context, page, state);
        }
        if (await generating(page)) { started = true; break; }
        const graceText = await latestAssistant(page);
        if (graceText && hash(graceText) !== base) { started = true; break; }
        await sleep(POLL_MS);
      }
      if (!started) {
        noStartRecoveries += 1;
        if (noStartRecoveries > 2) {
          await waitForScientistSupervision(state, "APK response failed to start after two bounded refresh recoveries");
        }
        state.watchdog = "apk-no-start-bounded-refresh";
        save(state, `APK still inactive after extended grace -> bounded refresh ${noStartRecoveries}/2`);
        console.log(`[APK] Still inactive after grace -> bounded REFRESH ${noStartRecoveries}/2.`);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await sleep(1800);
        continue;
      }
    }

    state.turnsSent = Number(state.turnsSent || 0) + 1;
    save(state, `APK GPT started cycle ${state.turnsSent}`);
    let last = base, lastActivity = Date.now();
    while (true) {
      page = await waitReady(context, page, state);
      if (await sendTimeoutVisible(page)) {
        page = await waitSendTimeoutRecovery(context, page, state);
        lastActivity = Date.now();
        await sleep(POLL_MS);
        continue;
      }
      const text = await latestAssistant(page);
      const h = hash(text);
      if (await generating(page)) {
        if (text && h !== base && h !== last) {
          last = h;
          lastActivity = Date.now();
          delete state.activeNoProgressSince;
          state.watchdog = "apk-writing";
          save(state, "APK GPT text progressed while ACTIVE");
        } else if (Date.now() - lastActivity > STALL_MS) {
          if (state.watchdog !== "apk-active-no-progress") {
            state.watchdog = "apk-active-no-progress";
            state.problem = null;
            state.activeNoProgressSince = state.activeNoProgressSince || new Date(lastActivity).toISOString();
            save(state, "APK GPT remains ACTIVE with no text progress; WAIT only. No refresh/resend while Stop/generating is visible.");
          }
        }
        await sleep(POLL_MS);
        continue;
      } else if (text && h !== base) {
        if (h !== last) { last = h; lastActivity = Date.now(); delete state.activeNoProgressSince; }
        if (state.activeNoProgressSince) delete state.activeNoProgressSince;
        if (await complete(page, base)) {
          if (state.justRolledOver) state.justRolledOver = false;
          if (state.freshStartPending) state.freshStartPending = false;
          syncChatUrl(page, state);
          state.lastAssistantHash = h;
          await reportProbeSuccess("APK");
          delete state.problemRetryAt;
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
        stallRefreshes += 1;
        if (stallRefreshes > 1) {
          await waitForScientistSupervision(state, "APK repeated inactive stall after bounded resends and one refresh");
        }
        state.watchdog = "apk-stalled-refresh-resend";
        save(state, "Repeated inactive APK stall -> one final bounded refresh/resend before supervision");
        console.log("[APK] Repeated inactive stall -> one final REFRESH -> RESEND.");
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
  let browser = null;
  let context = null;
  while (!context) {
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 120000 });
      context = browser.contexts()[0] || null;
      if (!context) throw new Error("No shared Edge context");
    } catch (error) {
      console.log(`[APK] CDP not ready: ${error?.message || error}. WAIT 5s -> reconnect. Worker stays alive.`);
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
    save(state, "Cleared stale ChatGPT rate-limit problem from APK project state; coordinator owns cooldown");
  }
  if (FRESH_SESSION_ON_START) {
    state.previousChatUrl = cleanConversationUrl(state.chatUrl) || state.previousChatUrl || null;
    state.chatUrl = CHATGPT_ROOT;
    state.pendingNewChat = true;
    state.justRolledOver = true;
    state.freshStartPending = true;
    state.watchdog = "apk-fresh-session-boot";
    activeChatUrl = CHATGPT_ROOT;
    save(state, "FRESH SESSION BOOT: APK old chat URL ignored; project state preserved");
  } else {
    activeChatUrl = cleanConversationUrl(ENV_CHAT_URL) || cleanConversationUrl(state.chatUrl) || "";
  }
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
      if (!endsOk(result.text)) {
        const terminal = await waitForTerminalMarker(page, state);
        if (terminal.type === "problem") {
          state.problem = terminal.problem;
          save(state, `APK fix terminal marker became PROBLEM IN: ${terminal.problem}`);
          continue;
        }
      }
      state.problem = null;
      state.problemAttempts = 0;
      state.lastResult = "OK";
      save(state, "APK problem fixed with final OK; continuing in same ChatGPT conversation");
      state.nextTaskAt = new Date().toISOString();
      state.watchdog = "next-task-ready";
      save(state, "Previous block complete; NEXT TASK will continue in SAME ChatGPT conversation. Rollover only on real conversation limit.");
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
    if (!endsOk(result.text)) {
      const terminal = await waitForTerminalMarker(page, state);
      if (terminal.type === "problem") {
        state.problem = terminal.problem;
        state.problemAttempts = 0;
        save(state, `APK terminal marker became PROBLEM IN: ${terminal.problem}`);
        continue;
      }
    }
    state.lastResult = "OK";
    save(state, "Final OK received; continuing to NEXT APK task in the same ChatGPT conversation");
    console.log("[APK] Final OK received. continuing in same ChatGPT conversation.");
    state.nextTaskAt = new Date().toISOString();
      state.watchdog = "next-task-ready";
      save(state, "Previous block complete; NEXT TASK will continue in SAME ChatGPT conversation. Rollover only on real conversation limit.");
    await sleep(COOLDOWN_MS);
  }
}

function runSelfTest() {
  if (!semanticTerminalCandidate("APK upgrade completed successfully. Build PASS. Artifact evidence is recorded.")) throw new Error("APK self-test: proven stable completion should allow semantic fallback");
  if (semanticTerminalCandidate("Android CI is still running and pending. Please wait.")) throw new Error("APK self-test: pending CI must not auto-continue");
  if (semanticTerminalCandidate("Please log in and approve MFA before continuing.")) throw new Error("APK self-test: human gate must pause");
  if (!waitReady.toString().includes("fresh-owned-tab-after-discovery-miss")) throw new Error("APK self-test: discovery miss must auto-start owned fresh tab");
  console.log("DAVID_APK_RESPONSE_WATCHDOG_SELF_TEST PASS semantic_terminal=3 discovery_miss_autostart=ON");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  main().catch((e) => {
    console.error("[APK] FATAL", e?.stack || e);
    process.exit(1);
  });
}
