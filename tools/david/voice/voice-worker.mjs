// DAVID Voice isolated Windows worker. NOT part of existing five-tab supervisor.
// Requires separate operator arming after real ChatGPT Voice UI is started and muted.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { chromium } from "playwright-core";
import { cleanChatUrl, newRelayTurn, safeStatus } from "./voice-guardian.mjs";
import {
  waitForGlobalSendPermit, markGlobalSendStarted, releaseWorkerLeases,
  reportRateLimit, reportProbeSuccess
} from "../chatgpt-rate-limit-coordinator.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "voice-config.json"), "utf8"));
const CHAT_URL = cleanChatUrl(process.env.DAVID_VOICE_CHAT_URL || CONFIG.primaryChatUrl);
const PORT = Number(process.env.DAVID_VOICE_PORT || 9448);
const LIVE = process.env.DAVID_VOICE_LIVE === "1";
const OWNER = "DAVID_VOICE";
const RELAY_TOKEN = process.env.DAVID_VOICE_RELAY_TOKEN || "";
const GUARDIAN_TOKEN = process.env.DAVID_VOICE_GUARDIAN_TOKEN || "";
const PROFILE = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "DAVID-Voice-ChatGPT");
const STATE_PATH = path.join(ROOT, ".david-voice-queue.json");
const MAX_TURNS = 100;
const CHECK_MS = 10_000;
let browser = null, page = null, armed = false, busy = false, paused = false;

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error("Bad DAVID_VOICE_PORT");
if (RELAY_TOKEN.length < 16 || GUARDIAN_TOKEN.length < 16 || RELAY_TOKEN === GUARDIAN_TOKEN) {
  throw new Error("Configure distinct DAVID_VOICE_RELAY_TOKEN and DAVID_VOICE_GUARDIAN_TOKEN (16+ chars) locally");
}
if (LIVE && process.platform !== "win32") throw new Error("Live browser adapter requires Windows");
if (!CONFIG.requireHumanVoiceArming || CONFIG.managedMainEdgeProfile) {
  throw new Error("Unsafe Voice configuration; human arming and isolated profile are mandatory");
}

function readState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_PATH,"utf8"));
    if (!Array.isArray(saved.turns)) throw new Error("Bad state");
    for (const t of saved.turns) if (t.state === "sending") t.state = "uncertain";
    return saved;
  } catch { return { turns: [], lastError: null, rolloverRequired: false }; }
}
const state = readState();
function persist() {
  state.updatedAt = new Date().toISOString();
  const tmp = STATE_PATH + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state,null,2),{encoding:"utf8",mode:0o600});
  fs.renameSync(tmp,STATE_PATH);
}
persist();

function equalSecret(input, expected) {
  const a=Buffer.from(String(input||"")),b=Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
function bearer(req, role) {
  const value = String(req.headers.authorization || "").replace(/^Bearer /i,"");
  return equalSecret(value,role==="guardian" ? GUARDIAN_TOKEN : RELAY_TOKEN);
}
function respond(res,status,data) {
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff"});
  res.end(JSON.stringify(data));
}
async function bodyJson(req) {
  let content="",size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>8192) throw new Error("Request too large");
    content+=chunk.toString("utf8");
  }
  return JSON.parse(content||"{}");
}
function setError(e) {
  state.lastError = String(e?.message || e || "Unknown error").slice(0,250);
  persist();
  console.error("[DAVID_VOICE]",state.lastError);
}
async function ensurePage() {
  if (!LIVE) return null;
  if (page && !page.isClosed()) return page;
  // The directory differs from the shared DAVID profile on port 9444.
  browser = await chromium.launchPersistentContext(PROFILE,{
    channel:"msedge",headless:false,args:["--no-first-run"]
  });
  page = browser.pages()[0] || await browser.newPage();
  await page.goto(CHAT_URL,{waitUntil:"domcontentloaded",timeout:60_000});
  return page;
}
async function composer() {
  if (!page || page.isClosed()) return null;
  for (const selector of [
    "#prompt-textarea", '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][role="textbox"]'
  ]) {
    const element=page.locator(selector).last();
    if (await element.count() && await element.isVisible().catch(()=>false)) return element;
  }
  return null;
}
function correctChat() {
  if (!page || page.isClosed()) return false;
  try { return cleanChatUrl(page.url())===CHAT_URL; }
  catch { return false; }
}
async function inspectBlocked() {
  if (!page || page.isClosed()) return false;
  const dialogs=page.locator('[role="dialog"], [role="alertdialog"]');
  const text=await dialogs.allInnerTexts().catch(()=>[]);
  if (text.some(t=>/too many requests|твърде много заявки|правите заявки прекалено бързо/i.test(t))) {
    await reportRateLimit(OWNER,"visible ChatGPT rate-limit dialog");
    return true;
  }
  if (text.some(t=>/maximum length|максималната продължителност/i.test(t))) {
    state.rolloverRequired=true; armed=false; persist();
    return true;
  }
  return false;
}
async function sendOne(turn) {
  if (!LIVE || !armed || paused || busy || turn.state!=="queued") return;
  busy=true;
  let permit=false;
  try {
    await ensurePage();
    if (!correctChat()) throw new Error("ChatGPT page is not the configured Voice conversation");
    if (await inspectBlocked()) return;
    if (await page.locator('[data-testid="stop-button"]').count()) return;
    let field=await composer();
    if (!field) { armed=false; throw new Error("ChatGPT composer unavailable in Voice mode; manual UI validation required"); }
    const userBubbles=page.locator('[data-message-author-role="user"]');
    const before=await userBubbles.count();
    // Shared account-wide pacing across SYSTEM/DESIGN/CONTROL/APP2/APK and VOICE.
    await waitForGlobalSendPermit(OWNER);
    permit=true;
    if (!armed || !correctChat()) return;
    field=await composer();
    if (!field) { armed=false; throw new Error("Voice composer disappeared before send"); }
    turn.state="sending";turn.attemptedAt=new Date().toISOString();persist();
    await field.fill(turn.text);
    await field.press("Enter");
    await markGlobalSendStarted(OWNER);
    permit=false;
    // Only mark delivered if an actual new user message is visible.
    let accepted=false;
    const until=Date.now()+15_000;
    while (Date.now()<until) {
      if ((await userBubbles.count())>before) {
        const visible=(await userBubbles.last().innerText().catch(()=>"")).replace(/\s+/g," ").trim();
        if (visible===turn.text) {accepted=true;break;}
      }
      await new Promise(r=>setTimeout(r,750));
    }
    turn.state=accepted?"sent":"uncertain";
    if (accepted) { turn.sentAt=new Date().toISOString(); await reportProbeSuccess(OWNER); }
    else { armed=false;state.lastError="Send not verified; held as uncertain (will not auto-resend)"; }
    persist();
  } catch(e) {
    if (turn.state==="sending") turn.state="uncertain"; // NEVER auto resend a possibly accepted turn
    setError(e);
    armed=false;
  } finally {
    if (permit) await releaseWorkerLeases(OWNER,"send-aborted-before-start").catch(()=>{});
    busy=false;
  }
}
async function tick() {
  if (!LIVE || !armed || paused || busy || state.rolloverRequired) return;
  const next=state.turns.find(t=>t.state==="queued");
  if (next) await sendOne(next);
}
const server=http.createServer(async(req,res)=>{
  try {
    if (!["GET","POST"].includes(req.method)) return respond(res,405,{error:"method_not_allowed"});
    const u=new URL(req.url,"http://localhost");
    if (u.pathname==="/status" && req.method==="GET") {
      if (!bearer(req,"relay") && !bearer(req,"guardian")) return respond(res,401,{error:"unauthorized"});
      return respond(res,200,safeStatus(state,{primaryChatUrl:CHAT_URL},LIVE,armed));
    }
    if (u.pathname==="/transcript" && req.method==="POST") {
      if (!bearer(req,"relay")) return respond(res,401,{error:"unauthorized"});
      const data=await bodyJson(req), t=newRelayTurn(data);
      const existing=state.turns.find(x=>x.id===t.id);
      if (existing) return respond(res,existing.text===t.text?200:409,
        existing.text===t.text?{id:t.id,state:existing.state,duplicate:true}:{error:"id_conflict"});
      if (state.turns.length>=MAX_TURNS) return respond(res,429,{error:"queue_full"});
      if (t.state==="pause") {paused=true;armed=false;t.state="processed"; }
      state.turns.push(t);persist();
      return respond(res,202,{id:t.id,state:t.state});
    }
    if (u.pathname==="/open" && req.method==="POST") {
      if (!bearer(req,"guardian")) return respond(res,401,{error:"unauthorized"});
      if (!LIVE) return respond(res,409,{error:"dry_run_cannot_open_browser"});
      await ensurePage();
      return respond(res,200,{opened:true,conversation:CHAT_URL,
        note:"Start ChatGPT voice output and mute ChatGPT microphone manually, then call /arm"});
    }
    if (u.pathname==="/arm" && req.method==="POST") {
      if (!bearer(req,"guardian")) return respond(res,401,{error:"unauthorized"});
      const data=await bodyJson(req);
      if (data.voiceOutputStarted!==true || data.chatgptInputMuted!==true)
        return respond(res,400,{error:"confirm_voice_output_and_muted_gpt_microphone"});
      if (LIVE) {
        if (!page || page.isClosed()) return respond(res,409,{error:"open_voice_window_first"});
        if (!correctChat() || !(await composer()))
          return respond(res,409,{error:"voice_conversation_or_composer_not_ready"});
      }
      paused=false;armed=LIVE;state.lastError=null;persist();
      return respond(res,200,{armed,mode:LIVE?"live":"dry-run",note:"Operator confirmed Voice UI; microphone state not machine-verified"});
    }
    if (u.pathname==="/pause" && req.method==="POST") {
      if (!bearer(req,"guardian")) return respond(res,401,{error:"unauthorized"});
      armed=false;paused=true;
      return respond(res,200,{armed:false,paused:true});
    }
    if (u.pathname==="/guardian/approve" && req.method==="POST") {
      if (!bearer(req,"guardian")) return respond(res,401,{error:"unauthorized"});
      const {id}=await bodyJson(req);
      const turn=state.turns.find(x=>x.id===id && x.state==="held");
      if (!turn) return respond(res,404,{error:"held_turn_not_found"});
      turn.state="queued";turn.approvedAt=new Date().toISOString();persist();
      return respond(res,200,{id,state:turn.state});
    }
    return respond(res,404,{error:"not_found"});
  }catch(e) {
    setError(e);
    return respond(res,e instanceof SyntaxError?400:422,{error:"request_failed"});
  }
});
server.listen(PORT,"127.0.0.1",()=>{
  console.log("[DAVID_VOICE] loopback ready port="+PORT+" mode="+(LIVE?"LIVE":"DRY_RUN")+
  " (isolated browser; no Windows processes changed until manually armed)");
});
const timer=setInterval(()=>{tick().catch(setError);},CHECK_MS);
const shutdown=async()=>{
  clearInterval(timer);armed=false;
  await releaseWorkerLeases(OWNER).catch(()=>{});
  server.close();
  if (browser) await browser.close().catch(()=>{});
  process.exit(0);
};
process.once("SIGINT",shutdown);
process.once("SIGTERM",shutdown);
