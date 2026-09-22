import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const HERE=path.dirname(fileURLToPath(import.meta.url));
const SCI_CDP=process.env.SF_SCIENTIST_CDP_URL||"http://127.0.0.1:9555";
const DAVID_CDP=process.env.DAVID_CDP_URL||"http://127.0.0.1:9444";
const STATE=path.join(HERE,".sf-scientist-state.json");
const COMMAND=path.join(HERE,".sf-scientist-command.json");
const RESPONSE=path.join(HERE,".sf-scientist-response.json");
const DECISIONS=path.join(HERE,".sf-scientist-decisions.jsonl");
const MEMORY=path.join(HERE,".sf-scientist-memory.jsonl");
const TABMON=path.join(HERE,".david-tab-monitor.json");
const POLL=Number(process.env.SF_SCIENTIST_POLL_MS||1200);
const AUTO_MIN=Number(process.env.SF_SCIENTIST_AUTO_MIN_MS||45000);
const READY_MS=180000;
const RESPONSE_MS=900000;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toISOString();
const digest=v=>crypto.createHash("sha256").update(String(v||"")).digest("hex").slice(0,16);

function readJson(p,f=null){try{return JSON.parse(fs.readFileSync(p,"utf8"));}catch{return f;}}
function writeJson(p,v){const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(v,null,2),"utf8");fs.renameSync(t,p);}
function append(p,v){fs.appendFileSync(p,JSON.stringify(v)+"\n","utf8");}
let state=readJson(STATE,{version:1,status:"starting",heartbeatAt:null,chatUrl:null,lastAction:"boot",lastObservation:null,lastDecision:null,lastResponse:null,lastCommandId:null,lastAutoAnalysisAt:null,loginRequired:false});
function save(action,patch={}){state={...state,...patch,heartbeatAt:now(),lastAction:action};writeJson(STATE,state);}

async function fetchJson(url){
  const ac=new AbortController(); const timer=setTimeout(()=>ac.abort(),1800);
  try{const r=await fetch(url,{signal:ac.signal});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json();}
  finally{clearTimeout(timer);}
}
async function processes(){
  const ps=[
    "$p=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.Name -eq 'node.exe'})",
    "$m=[ordered]@{SUP='dual-session-worker.mjs';SYSTEM='auto-continue-enchev-v5.mjs';DESIGN='auto-continue-design-v1.mjs';DPP='auto-complete-app2-v1.mjs';APK='auto-continue-david-apk-v1.mjs';CONTROL='auto-control-watchtower-v1.mjs';GUARD='connection-interruption-guard.mjs';FREE='free-talk-session-v1.mjs'}",
    "$o=[ordered]@{}",
    "foreach($k in $m.Keys){$n=$m[$k];$o[$k]=@($p|Where-Object{([string]$_.CommandLine)-like('*'+$n+'*')}).Count}",
    "$o|ConvertTo-Json -Compress"
  ].join(";");
  try{const x=await execFileAsync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-Command",ps],{windowsHide:true,timeout:6000});return JSON.parse(String(x.stdout||"{}").trim()||"{}");}
  catch{return {};}
}
function infer(p,tm){
  const s=Number(p.SUP||0),y=Number(p.SYSTEM||0),d=Number(p.DPP||0),a=Number(p.APK||0),c=Number(p.CONTROL||0),g=Number(p.GUARD||0),f=Number(p.FREE||0),z=Number(p.DESIGN||0),t=Number(tm?.totalChatGptTabs||0);
  if(!s&&!y&&!d&&!a&&!c&&!f)return "STOPPED";
  if(s===1&&y===1&&d===1&&a===1&&c===0&&g===1&&f===0&&z===0)return "SOULFLAME";
  if(s===1&&f===2&&!y&&!d&&!a&&!c&&!z)return "AB";
  if(s===1&&g===1&&y===1&&!d&&!a&&!c&&!f&&!z&&t===1)return "SOLO_SYSTEM";
  if(s===1&&g===1&&!y&&d===1&&!a&&!c&&!f&&!z&&t===1)return "SOLO_DPP";
  if(s===1&&g===1&&!y&&!d&&a===1&&!c&&!f&&!z&&t===1)return "SOLO_APK";
  return "CHECK";
}
async function snapshot(){
  const [p,ver]=await Promise.all([processes(),fetchJson(DAVID_CDP+"/json/version").catch(()=>null)]);
  const tm=readJson(TABMON,null),m=tm?.managed||{};
  return {at:now(),mode:infer(p,tm),cdp9444Online:Boolean(ver),process:p,monitor:tm?{totalChatGptTabs:Number(tm.totalChatGptTabs||0),SYSTEM:Array.isArray(m.SYSTEM)?m.SYSTEM.length:0,DESIGN:Array.isArray(m.DESIGN)?m.DESIGN.length:0,APP2:Array.isArray(m.APP2)?m.APP2.length:0,APK:Array.isArray(m.APK)?m.APK.length:0,CONTROL:Array.isArray(m.CONTROL)?m.CONTROL.length:0,FREE_A:Array.isArray(m.FREE_A)?m.FREE_A.length:0,FREE_B:Array.isArray(m.FREE_B)?m.FREE_B.length:0}:null};
}
function event(prev,next){
  if(!prev)return {important:true,reason:"Scientist attached to current DAVID state"};
  if(prev.mode!==next.mode)return {important:true,reason:"DAVID mode changed "+prev.mode+" -> "+next.mode};
  if(prev.cdp9444Online!==next.cdp9444Online)return {important:true,reason:"DAVID CDP 9444 "+(next.cdp9444Online?"ONLINE":"OFFLINE")};
  if(digest(JSON.stringify(prev.process))!==digest(JSON.stringify(next.process)))return {important:true,reason:"DAVID process topology changed"};
  if(digest(JSON.stringify(prev.monitor))!==digest(JSON.stringify(next.monitor)))return {important:true,reason:"DAVID managed ChatGPT tab topology changed"};
  return {important:false,reason:null};
}
function chatUrl(u){const m=String(u||"").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+/i);return m?m[0]:null;}
async function composer(page){for(const s of ["#prompt-textarea",'[data-testid="prompt-textarea"]','div[contenteditable="true"][role="textbox"]','div[contenteditable="true"]']){const x=page.locator(s).last();if(await x.count().catch(()=>0)&&await x.isVisible().catch(()=>false))return x;}return null;}
async function latest(page){try{const n=page.locator('[data-message-author-role="assistant"]');if(!await n.count())return "";return (await n.last().innerText().catch(()=>"")).trim();}catch{return "";}}
async function busy(page){for(const s of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]']){const n=page.locator(s).last();if(await n.count().catch(()=>0)&&await n.isVisible().catch(()=>false))return true;}return false;}
async function ready(page){
  const t=Date.now();
  while(Date.now()-t<READY_MS){
    if(await composer(page)){const u=chatUrl(page.url());save("Scientist chat ready",{status:"online",chatUrl:u||state.chatUrl,loginRequired:false});return page;}
    const body=await page.locator("body").innerText().catch(()=>"");
    if(/log in|sign in|login/i.test(body)||/auth|login/i.test(page.url()))save("Scientist login required",{status:"login-required",loginRequired:true});
    else save("Waiting for Scientist ChatGPT UI",{status:"starting"});
    await sleep(1200);
  }
  throw new Error("Scientist ChatGPT ready timeout");
}
async function pageFor(context){
  let pages=context.pages().filter(p=>String(p.url()||"").includes("chatgpt.com")),page=null;
  if(state.chatUrl)page=pages.find(p=>chatUrl(p.url())===state.chatUrl)||null;
  if(!page)page=pages[0]||await context.newPage();
  if(!String(page.url()||"").includes("chatgpt.com"))await page.goto(state.chatUrl||"https://chatgpt.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});
  return await ready(page);
}
async function send(page,text){
  const c=await composer(page); if(!c)throw new Error("Scientist composer unavailable");
  try{await c.fill(text,{timeout:2500});}catch{await c.focus();await page.keyboard.press("Control+A");await page.keyboard.insertText(text);}
  for(const s of ['button[data-testid="send-button"]','button[aria-label*="Send"]']){const b=page.locator(s).last();if(await b.count().catch(()=>0)&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false)){await b.click({timeout:2000});return;}}
  await c.press("Enter",{timeout:2500});
}
async function ask(page,prompt){
  const base=digest(await latest(page)); await send(page,prompt); save("Scientist prompt sent",{status:"thinking"});
  let last=base,stable="",since=0,start=Date.now();
  while(Date.now()-start<RESPONSE_MS){
    const text=await latest(page),h=digest(text);
    if(h&&h!==last){last=h;stable=h;since=Date.now();save("Scientist response progressing",{status:"thinking"});}
    if(await busy(page)){await sleep(800);continue;}
    if(h&&h!==base){if(h!==stable){stable=h;since=Date.now();}if(Date.now()-since>1200){const u=chatUrl(page.url());save("Scientist response captured",{status:"online",chatUrl:u||state.chatUrl,lastResponse:text});return text;}}
    await sleep(700);
  }
  throw new Error("Scientist response timeout");
}
function boot(s){return "SF CORPORATION / AI SCIENTIST BOOTSTRAP\n\nYou are the independent AI Scientist observing the existing DAVID system. You are OUTSIDE DAVID. Preserve the existing DAVID architecture. Never claim an external action happened unless the local bridge reports it. Never bypass login/MFA/CAPTCHA/permissions. Observe, form hypotheses, test claims against evidence, detect regressions and propose improvements.\n\nFor autonomous observations answer compactly in Bulgarian:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH\n\nCurrent DAVID snapshot:\n"+JSON.stringify(s,null,2);}
function observe(reason,s){return "SF SCIENTIST AUTONOMOUS OBSERVATION\nEVENT: "+reason+"\n\nAnalyze only this evidence. You may decide no intervention is needed. Do not invent actions.\n\nDAVID SNAPSHOT:\n"+JSON.stringify(s,null,2)+"\n\nReturn:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH";}
function user(text,s){return "MITKO -> SF AI SCIENTIST\n"+text+"\n\nLive DAVID snapshot:\n"+JSON.stringify(s,null,2)+"\n\nAnswer as SF AI Scientist. Separate observed facts from hypotheses. If you recommend an action, say exactly what and why.";}
async function command(page,s){
  const c=readJson(COMMAND,null);if(!c?.id||c.id===state.lastCommandId||!String(c.text||"").trim())return;
  save("Processing Scientist chat command",{lastCommandId:c.id});
  const r=await ask(page,user(String(c.text).trim(),s));
  const o={id:c.id,createdAt:now(),request:String(c.text).trim(),response:r};writeJson(RESPONSE,o);append(MEMORY,{at:o.createdAt,kind:"mitko-chat",request:o.request,response:r});save("Scientist chat complete",{lastResponse:r});
}
async function main(){
  save("Connecting to Scientist Edge",{status:"starting",scientistCdp:SCI_CDP,davidCdp:DAVID_CDP});
  const browser=await chromium.connectOverCDP(SCI_CDP,{timeout:30000}),contexts=browser.contexts();if(!contexts.length)throw new Error("Scientist Edge has no browser context");
  const context=contexts[0];let page=await pageFor(context),prev=null,booted=Boolean(state.bootstrappedAt);
  while(true){
    try{
      if(!page||page.isClosed())page=await pageFor(context);
      const s=await snapshot();save("Scientist heartbeat",{status:state.loginRequired?"login-required":"online",liveSnapshot:s});
      if(!booted&&!state.loginRequired){const r=await ask(page,boot(s));append(DECISIONS,{type:"bootstrap",at:now(),snapshot:s,response:r});save("Scientist bootstrap complete",{bootstrappedAt:now(),lastDecision:r,lastObservation:"Scientist attached"});booted=true;}
      await command(page,s);
      const e=event(prev,s),last=state.lastAutoAnalysisAt?Date.parse(state.lastAutoAnalysisAt):0;
      if(booted&&e.important&&Date.now()-last>=AUTO_MIN){const r=await ask(page,observe(e.reason,s));append(DECISIONS,{type:"autonomous-decision",at:now(),event:e.reason,snapshot:s,response:r});append(MEMORY,{at:now(),kind:"observed-system-event",event:e.reason,response:r});save("Autonomous Scientist decision recorded",{lastObservation:e.reason,lastDecision:r,lastAutoAnalysisAt:now()});}
      prev=s;
    }catch(err){save("Scientist loop error",{status:"degraded",lastError:String(err?.stack||err)});}
    await sleep(POLL);
  }
}
process.on("unhandledRejection",e=>save("Unhandled rejection",{status:"degraded",lastError:String(e?.stack||e)}));
process.on("uncaughtException",e=>{save("Uncaught exception",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
main().catch(e=>{save("Scientist fatal",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
