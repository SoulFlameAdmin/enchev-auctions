import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";
import {
  getRateLimitState,
  rateLimitRemainingMs,
  markGlobalSendStarted,
  reportProbeSuccess,
  reportRateLimit
} from "./chatgpt-rate-limit-coordinator.mjs";
import { CHATGPT_ROOT, rotateOwnedChatPage } from "./chatgpt-session-rotation.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const ROLE = String(process.env.DAVID_FREE_TALK_ROLE || "FREE_A").toUpperCase();
if (!["FREE_A","FREE_B"].includes(ROLE)) throw new Error("DAVID_FREE_TALK_ROLE must be FREE_A or FREE_B");
const PARTNER = ROLE === "FREE_A" ? "FREE_B" : "FREE_A";
const STATE_FILE = process.env.DAVID_FREE_TALK_STATE_FILE || path.join(HERE, ROLE === "FREE_A" ? ".david-free-talk-a-state.json" : ".david-free-talk-b-state.json");
const EXCHANGE_FILE = process.env.DAVID_FREE_TALK_EXCHANGE_FILE || path.join(HERE, ".david-free-talk-exchange.json");
const CDP_URL = process.env.DAVID_CDP_URL || "http://127.0.0.1:9444";
const TAB_NAME = ROLE === "FREE_A" ? "DAVID_FREE_A_MANAGED_V1" : "DAVID_FREE_B_MANAGED_V1";
const PENDING_TAB_NAME = ROLE === "FREE_A" ? "DAVID_FREE_A_PENDING_V1" : "DAVID_FREE_B_PENDING_V1";
const ROLE_MARKER = ROLE === "FREE_A" ? "[DAVID_FREE_TALK_A_V1]" : "[DAVID_FREE_TALK_B_V1]";
const POLL_MS = Number(process.env.DAVID_FREE_TALK_POLL_MS || 250);
const QUIET_MS = Number(process.env.DAVID_FREE_TALK_QUIET_MS || 700);
const STALL_MS = Number(process.env.DAVID_FREE_TALK_STALL_MS || 600000);

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function nowIso(){ return new Date().toISOString(); }
function readJson(file, fallback={}){
  try { return { ...fallback, ...JSON.parse(fs.readFileSync(file,"utf8")) }; } catch { return { ...fallback }; }
}
function writeJson(file, value){
  const tmp=file+".tmp-"+process.pid+"-"+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(value,null,2),"utf8");
  fs.renameSync(tmp,file);
}
let state=readJson(STATE_FILE,{
  version:1, role:ROLE, partner:PARTNER, chatUrl:null, watchdog:"starting",
  lastConsumedSeq:0,lastPublishedSeq:0,lastAssistantHash:null,inflightKey:null,inflightBaseHash:null,
  rolloverCount:0,previousChatUrl:null,staleChatUrls:[],justRolledOver:false
});
function save(action){
  state={...state,role:ROLE,partner:PARTNER,updatedAt:nowIso(),lastAction:action};
  writeJson(STATE_FILE,state);
}
function readExchange(){
  return readJson(EXCHANGE_FILE,{version:1,seq:0,lastSpeaker:null,text:null,updatedAt:null});
}
function publish(seq,text){
  const current=readExchange();
  if(Number(current.seq||0)>=seq) return current;
  const next={version:1,seq,lastSpeaker:ROLE,text:String(text||"").trim(),updatedAt:nowIso()};
  writeJson(EXCHANGE_FILE,next);
  state.lastPublishedSeq=seq;
  save("Published free-talk response seq="+seq);
  return next;
}
function cleanUrl(url){
  const m=String(url||"").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+/i);
  return m?m[0]:null;
}
function hash(text){
  let h=2166136261; for(const ch of String(text||"")){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
  return String(h>>>0);
}

function conversationLimitText(text){
  return /(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i.test(String(text||""));
}
async function conversationLimitReached(page){
  try{
    return await page.evaluate(()=>{
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;};
      const re=/(достигнахте максималната продължителност на този разговор|максималната продължителност на този разговор|maximum length for this conversation|conversation has reached (?:its )?maximum length)/i;
      for(const el of document.querySelectorAll("div,section,p,span")){
        if(!visible(el)) continue;
        const t=(el.textContent||"").replace(/\s+/g," ").trim();
        if(t&&t.length<500&&re.test(t)) return true;
      }
      return false;
    });
  }catch{return false;}
}
async function closeOldConversationTabs(context,oldUrl,keepPage){
  const old=cleanUrl(oldUrl);
  if(!old) return 0;
  let closed=0;
  for(const candidate of context.pages()){
    if(!candidate||candidate===keepPage||candidate.isClosed()) continue;
    try{
      if(cleanUrl(candidate.url())!==old) continue;
      await candidate.close({runBeforeUnload:false}).catch(()=>{});
      closed++;
    }catch{}
  }
  return closed;
}
async function rolloverConversation(context,page,reason="conversation-limit"){
  const oldUrl=cleanUrl(page?.url?.())||page?.url?.()||state.chatUrl||CHATGPT_ROOT;
  if(!page||page.isClosed()) page=await ensurePage(context,null);
  if(!page||page.isClosed()) throw new Error(ROLE+" rollover requires one owned ChatGPT tab");

  state.previousChatUrl=oldUrl;
  state.staleChatUrls=Array.from(new Set([...(Array.isArray(state.staleChatUrls)?state.staleChatUrls:[]),oldUrl])).slice(-20);
  state.rolloverCount=Number(state.rolloverCount||0)+1;
  state.justRolledOver=true;
  state.chatUrl=CHATGPT_ROOT;
  state.watchdog="free-talk-rollover";
  save("FREE TALK same-tab rollover #"+state.rolloverCount+" reason="+reason);

  const rotated=await rotateOwnedChatPage({
    page,
    getComposer:composer,
    setPageTag:tag,
    pendingTag:PENDING_TAB_NAME,
    managedTag:TAB_NAME,
    onWait:async ({phase,attempt,url})=>{
      state.watchdog=phase==="auth-wait"?"human-login-required":"free-talk-rollover-wait";
      save("FREE TALK rollover wait phase="+phase+" attempt="+attempt+" url="+(url||"unknown"));
    }
  });
  if(!rotated.ok) throw new Error(ROLE+" same-tab rollover failed: "+rotated.reason);

  await closeOldConversationTabs(context,oldUrl,page);
  save("Fresh FREE TALK session ready in SAME TAB #"+state.rolloverCount);
  return page;
}
async function waitOnlyForActualGlobalBlock(){
  for(;;){
    const st=getRateLimitState();
    if(st.status==="clear") return {mode:"fast",state:st};
    if(st.status==="probe" && st.probeOwner===ROLE) return {mode:"probe",state:st};
    const waitMs=Math.max(250,Math.min(1000,rateLimitRemainingMs(st)||1000));
    state.watchdog="free-talk-rate-limit-wait";
    save("Actual global rate limit wait status="+st.status+" owner="+(st.probeOwner||"none"));
    await sleep(waitMs);
  }
}
async function tag(page,name){ await page.evaluate(v=>{window.name=v;},name).catch(()=>{}); }
async function findTagged(context){
  for(const page of context.pages()){
    if(!page||page.isClosed()) continue;
    const name=await page.evaluate(()=>window.name||"").catch(()=>"");
    if(name===TAB_NAME||name===PENDING_TAB_NAME) return page;
  }
  return null;
}
async function composer(page){
  for(const sel of ["#prompt-textarea",'[data-testid="prompt-textarea"]','div[contenteditable="true"][role="textbox"]','div[contenteditable="true"]']){
    const x=page.locator(sel).last();
    if(await x.count().catch(()=>0) && await x.isVisible().catch(()=>false)) return x;
  }
  return null;
}
async function latestAssistant(page){
  try{
    const n=page.locator('[data-message-author-role="assistant"]');
    if(!await n.count()) return "";
    return (await n.last().innerText().catch(()=>"")).trim();
  }catch{return "";}
}
async function latestUser(page){
  try{
    const n=page.locator('[data-message-author-role="user"]');
    if(!await n.count()) return "";
    return (await n.last().innerText().catch(()=>"")).trim();
  }catch{return "";}
}
async function stopVisible(page){
  for(const sel of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]','button[aria-label*="Спри"]']){
    const n=page.locator(sel).last();
    if(await n.count().catch(()=>0) && await n.isVisible().catch(()=>false)) return true;
  }
  return false;
}
async function rateLimitVisible(page){
  try{
    return await page.evaluate(()=>{
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;};
      const re=/(твърде много заявки|правите заявки прекалено бързо|too many requests|requests too quickly|rate limit)/i;
      for(const el of document.querySelectorAll('[role="dialog"],[role="alert"],[aria-live="assertive"],[data-testid*="error" i]')){
        if(!visible(el)||el.closest('[data-message-author-role]')) continue;
        const t=(el.textContent||"").replace(/\s+/g," ").trim();
        if(re.test(t)) return true;
      }
      return false;
    });
  }catch{return false;}
}
async function ensurePage(context,page){
  if(page && !page.isClosed()) return page;
  page=await findTagged(context);
  if(page) return page;
  const url=cleanUrl(state.chatUrl);
  if(url){
    page=context.pages().find(p=>!p.isClosed()&&cleanUrl(p.url())===url)||null;
    if(page){ await tag(page,TAB_NAME); return page; }
  }
  page=await context.newPage();
  await page.goto("https://chatgpt.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});
  await tag(page,PENDING_TAB_NAME);
  save("Created pending free-talk tab");
  return page;
}
async function waitReady(context,page){
  for(;;){
    page=await ensurePage(context,page);
    const url=page.url();
    if(url.includes("/login")||url.includes("/auth/")){
      state.watchdog="human-login-required"; save("Waiting for ChatGPT login"); await sleep(3000); continue;
    }
    if(await conversationLimitReached(page)){
      page=await rolloverConversation(context,page);
      continue;
    }
    const c=await composer(page);
    if(c || await latestAssistant(page)){
      const cu=cleanUrl(page.url());
      if(cu && cu!==state.chatUrl){ state.chatUrl=cu; await tag(page,TAB_NAME); save("Conversation URL synced"); }
      return page;
    }
    state.watchdog="free-talk-page-wait"; save("Waiting for interactive ChatGPT page");
    await sleep(POLL_MS);
  }
}
async function fillAndSend(page,text){
  let c=null,filled=false;
  for(let i=0;i<10&&!filled;i++){
    c=await composer(page);
    if(!c){await sleep(400);continue;}
    try{await c.fill(text,{timeout:1800});filled=true;break;}catch{}
    c=await composer(page);
    if(!c){await sleep(400);continue;}
    try{
      await c.focus({timeout:1200});
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(text);
      filled=true;break;
    }catch{}
    await sleep(400);
  }
  if(!filled||!c) throw new Error("FREE TALK composer unavailable after bounded reacquire");
  await sleep(200);
  for(const sel of ['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="Изпрати"]']){
    const b=page.locator(sel).last();
    if(await b.count().catch(()=>0)&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false)){
      try{await b.click({timeout:2000});return "button";}catch{}
    }
  }
  await c.focus({timeout:1500}).catch(()=>{});
  await c.press("Enter",{timeout:2500});
  return "enter";
}
async function waitComplete(context,page,baseHash){
  let lastHash=baseHash||"",stableHash="",stableSince=0,lastProgress=Date.now();
  for(;;){
    page=await waitReady(context,page);
    if(await rateLimitVisible(page)){
      const rl=await reportRateLimit(ROLE,"FREE TALK UI rate limit");
      state.watchdog="free-talk-rate-limit-wait"; save("Rate limit until "+(rl.blockedUntil||rl.probeLeaseUntil||"unknown"));
      return {page,retry:true};
    }
    const text=await latestAssistant(page);
    const h=text?hash(text):"";
    if(h&&h!==lastHash){lastHash=h;lastProgress=Date.now();stableHash=h;stableSince=Date.now();state.watchdog="free-talk-writing";save("Partner response progressing");}
    if(await stopVisible(page)){state.watchdog="free-talk-thinking";save("ChatGPT active");await sleep(POLL_MS);continue;}
    if(h&&h!==baseHash){
      if(h!==stableHash){stableHash=h;stableSince=Date.now();}
      if(Date.now()-stableSince>=QUIET_MS){
        state.lastAssistantHash=h; state.watchdog="free-talk-response-ready"; save("Stable response captured");
        return {page,retry:false,text,hash:h};
      }
    }
    if(Date.now()-lastProgress>STALL_MS){
      state.watchdog="free-talk-stalled-refresh"; save("Stall timeout -> bounded reload");
      await page.reload({waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});
      await sleep(2000); return {page,retry:true};
    }
    state.watchdog="free-talk-waiting-response"; save("Waiting for partner response");
    await sleep(POLL_MS);
  }
}
async function sendAndCapture(context,page,key,prompt){
  page=await waitReady(context,page);
  const marker=key;
  let baseHash=state.inflightKey===key?String(state.inflightBaseHash||state.lastAssistantHash||""):hash(await latestAssistant(page));
  const alreadySent=(await latestUser(page)).includes(marker);
  if(!alreadySent){
    state.inflightKey=key; state.inflightBaseHash=baseHash; state.watchdog="free-talk-send-ready"; save("Preparing "+key);
    const permit=await waitOnlyForActualGlobalBlock();
    if(permit.mode==="probe"){state.watchdog="free-talk-global-probe";save("Owns post-cooldown probe");}
    await fillAndSend(page,prompt);
    if(permit.mode==="probe") await markGlobalSendStarted(ROLE);
    state.watchdog="free-talk-sent"; save("Sent immediately "+key);
  }else{
    state.watchdog="free-talk-resume-inflight"; save("Resuming existing "+key+" without duplicate send");
  }
  for(;;){
    const done=await waitComplete(context,page,baseHash);
    page=done.page;
    if(done.retry){await sleep(1500);continue;}
    state.inflightKey=null; state.inflightBaseHash=null; state.watchdog="free-talk-complete"; save("Completed "+key);
    await reportProbeSuccess(ROLE);
    return {page,text:done.text};
  }
}
function seedPrompt(){
  return ROLE_MARKER+"\n[DAVID_FREE_TALK_SEED_V2]\n\nYou are "+ROLE+" in an open-ended two-session free-talk experiment with "+PARTNER+". Start wherever your curiosity takes you. You may change topics whenever you want, ask questions, disagree, speculate, joke, research, browse/search the web, inspect sources, use available information tools, and bring anything interesting you find back into the conversation. You do not need to ask for permission to explore. Respond in whatever style and length feels natural. When a session reaches its maximum length, the relay will continue you in a fresh session automatically. Do not perform external side-effect actions such as posting publicly, purchasing, changing accounts, or modifying the human's projects unless the human explicitly asks.";
}
function relayPrompt(seq,text){
  const continuation=state.justRolledOver?"\n\nYou are continuing the same FREE TALK experiment in a fresh ChatGPT session because the previous session reached its maximum length. Pick up naturally from the relay below.":"";
  state.justRolledOver=false;
  return ROLE_MARKER+"\n[DAVID_FREE_TALK_RELAY_V2 seq="+seq+" from="+PARTNER+" to="+ROLE+"]"+continuation+"\n\n"+PARTNER+" said:\n\n"+text+"\n\nReply however you want and take the conversation wherever you want. You may browse/search, inspect sources, use available information tools, switch topics, question assumptions, or explore something new on your own initiative. No need to ask permission to research. Do not perform external side-effect actions such as public posting, purchases, account changes, or project modifications unless the human explicitly asks.";
}
async function main(){
  state.watchdog="free-talk-starting";save("Worker starting");
  let browser=null,context=null;
  while(!context){
    try{
      browser=await chromium.connectOverCDP(CDP_URL,{timeout:120000});
      context=browser.contexts()[0]||null;
      if(!context) throw new Error("No Chromium context");
    }catch(error){
      state.watchdog="free-talk-cdp-wait";save("CDP wait: "+(error?.message||error));await sleep(5000);
    }
  }
  let page=await waitReady(context,null);
  console.log("["+ROLE+"] FREE TALK loop ON. partner="+PARTNER+" url="+page.url());

  for(;;){
    page=await waitReady(context,page);
    const exchange=readExchange();
    const seq=Number(exchange.seq||0);

    if(ROLE==="FREE_A" && seq===0 && Number(state.lastPublishedSeq||0)===0){
      const result=await sendAndCapture(context,page,"[DAVID_FREE_TALK_SEED_V2]",seedPrompt());
      page=result.page;
      publish(1,result.text);
      continue;
    }

    if(exchange.lastSpeaker===PARTNER && seq>Number(state.lastConsumedSeq||0) && String(exchange.text||"").trim()){
      const relayKey="[DAVID_FREE_TALK_RELAY_V2 seq="+seq+" from="+PARTNER+" to="+ROLE+"]";
      state.lastConsumedSeq=seq; save("Consuming partner seq="+seq);
      const result=await sendAndCapture(context,page,relayKey,relayPrompt(seq,exchange.text));
      page=result.page;
      publish(seq+1,result.text);
      continue;
    }

    state.watchdog="free-talk-listening";
    save("Waiting for "+PARTNER+" exchange");
    await sleep(POLL_MS);
  }
}
if(process.argv.includes("--self-test")){
  if(!ROLE_MARKER.includes("DAVID_FREE_TALK_")) throw new Error("marker missing");
  if(PARTNER===ROLE) throw new Error("partner role invalid");
  if(!conversationLimitText("You have reached the maximum length for this conversation.")) throw new Error("rollover detection missing");
  console.log("DAVID_FREE_TALK_SELF_TEST PASS role="+ROLE+" partner="+PARTNER+" dedupe=relay-seq fast_relay=ON browse_tools=ALLOWED same_tab_rollover=ON");
}else{
  main().catch(error=>{console.error("["+ROLE+"] FATAL",error?.stack||error);process.exit(1);});
}
