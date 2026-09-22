import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
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

function parseAction(text){
  const m=String(text||"").match(/^ACTION:\s*(.+)$/mi);
  if(!m)return {kind:"NONE",arg:""};
  const raw=m[1].trim();
  const head=raw.split(/\s+/,1)[0].toUpperCase();
  return {kind:head,arg:raw.slice(head.length).trim()};
}
function openDetached(exe,args=[]){
  const p=spawn(exe,args,{detached:true,stdio:"ignore",windowsHide:false});
  p.unref();
  return "started "+exe;
}
async function waitDetachedReady(page){
  const started=Date.now();
  while(Date.now()-started<READY_MS){
    if(await composer(page))return page;
    await sleep(1000);
  }
  throw new Error("Detached Scientist chat ready timeout");
}
async function askDetached(page,prompt){
  await waitDetachedReady(page);
  const base=digest(await latest(page));
  await send(page,prompt);
  let last=base,stable="",since=0,start=Date.now();
  while(Date.now()-start<RESPONSE_MS){
    const text=await latest(page),h=digest(text);
    if(h&&h!==last){last=h;stable=h;since=Date.now();}
    if(await busy(page)){await sleep(800);continue;}
    if(h&&h!==base){if(h!==stable){stable=h;since=Date.now();}if(Date.now()-since>1200)return text;}
    await sleep(700);
  }
  throw new Error("Detached Scientist response timeout");
}
async function consultAB(context,chief,question,s){
  const a=await context.newPage(),b=await context.newPage();
  try{
    await Promise.all([
      a.goto("https://chatgpt.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{}),
      b.goto("https://chatgpt.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{})
    ]);
    const base="Question from SF Chief Scientist:\n"+question+"\n\nEvidence snapshot:\n"+JSON.stringify(s,null,2);
    const [ra,rb]=await Promise.all([
      askDetached(a,"You are SCI-A. Generate the strongest plausible explanation, tests and next low-risk move. Do not invent evidence.\n\n"+base),
      askDetached(b,"You are SCI-B, the skeptical falsifier. Attack assumptions, find alternative explanations and propose discriminating tests. Do not invent evidence.\n\n"+base)
    ]);
    const synth=await ask(chief,"SF SCIENTIST A/B CONSULTATION\n\nSCI-A:\n"+ra+"\n\nSCI-B:\n"+rb+"\n\nSynthesize your own conclusion. State which claims are supported, what remains uncertain, and the next best low-risk step. ACTION: NONE");
    append(MEMORY,{at:now(),kind:"scientist-ab-consult",question,scienceA:ra,scienceB:rb,synthesis:synth});
    return "SCI-A + SCI-B consulted; chief synthesis recorded.";
  }finally{
    await a.close().catch(()=>{});
    await b.close().catch(()=>{});
  }
}
async function executeScientistAction(context,chief,text,s){
  const a=parseAction(text);
  let result="no action";
  if(a.kind==="NONE")return result;
  if(a.kind==="OPEN_POWERSHELL")result=openDetached("powershell.exe",["-NoProfile","-NoExit"]);
  else if(a.kind==="OPEN_CMD")result=openDetached("cmd.exe",[]);
  else if(a.kind==="OPEN_CHATGPT"){
    const p=await context.newPage();await p.goto("https://chatgpt.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});result="opened Scientist ChatGPT tab";
  }else if(a.kind==="SEARCH_WEB"){
    const q=a.arg.slice(0,500);if(!q)throw new Error("SEARCH_WEB requires query");
    const p=await context.newPage();await p.goto("https://www.bing.com/search?q="+encodeURIComponent(q),{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});result="opened web search: "+q;
  }else if(a.kind==="OPEN_URL"){
    if(!/^https:\/\//i.test(a.arg))throw new Error("OPEN_URL allows HTTPS only");
    const p=await context.newPage();await p.goto(a.arg,{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});result="opened URL: "+a.arg;
  }else if(a.kind==="DAVID_HEALTH_CHECK"){
    const x=await snapshot();result="DAVID health snapshot: "+JSON.stringify(x);
  }else if(a.kind==="GIT_STATUS"){
    try{
      const x=await execFileAsync("git",["-C","D:\\ASI\\enchev-auctions","status","--short","--branch"],{windowsHide:true,timeout:15000});
      result="git status: "+String(x.stdout||"").trim();
    }catch(e){result="git status failed: "+String(e?.message||e);}
  }else if(a.kind==="CONSULT_AB"){
    const q=a.arg||("Investigate current DAVID event and decide the best next scientific test.");
    result=await consultAB(context,chief,q,s);
  }else{
    result="rejected unsupported action: "+a.kind;
  }
  append(MEMORY,{at:now(),kind:"scientist-tool-action",action:a,result});
  save("Scientist autonomous tool action",{lastToolAction:a,lastToolResult:result});
  return result;
}

function boot(s){return "SF CORPORATION / AI SCIENTIST BOOTSTRAP\n\nYou are the independent AI Scientist observing the existing DAVID system. You are OUTSIDE DAVID. Preserve the existing DAVID architecture. Never claim an external action happened unless the local bridge reports it. Never bypass login/MFA/CAPTCHA/permissions. Observe, form hypotheses, test claims against evidence, detect regressions and propose improvements.\n\nFor autonomous observations answer compactly in Bulgarian:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH\n\nCurrent DAVID snapshot:\n"+JSON.stringify(s,null,2);}
function observe(reason,s){return "SF SCIENTIST AUTONOMOUS OBSERVATION\nEVENT: "+reason+"\n\nAnalyze only this evidence. You may decide no intervention is needed. Do not invent actions.\n\nDAVID SNAPSHOT:\n"+JSON.stringify(s,null,2)+"\n\nYou may autonomously choose ONE low-risk Scientist-sidecar action only when useful:\nACTION: NONE | OPEN_POWERSHELL | OPEN_CMD | OPEN_CHATGPT | SEARCH_WEB <query> | OPEN_URL <https-url> | DAVID_HEALTH_CHECK | GIT_STATUS | CONSULT_AB <question>\nThese actions affect only Scientist tools or read-only diagnostics; never modify DAVID architecture.\n\nReturn:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH\nACTION: ...";}
function user(text,s){return "MITKO -> SF AI SCIENTIST\n"+text+"\n\nLive DAVID snapshot:\n"+JSON.stringify(s,null,2)+"\n\nAnswer as SF AI Scientist. Separate observed facts from hypotheses. You can use one low-risk Scientist tool when useful by ending with ACTION: NONE | OPEN_POWERSHELL | OPEN_CMD | OPEN_CHATGPT | SEARCH_WEB <query> | OPEN_URL <https-url> | DAVID_HEALTH_CHECK | GIT_STATUS | CONSULT_AB <question>. Never modify DAVID architecture from this sidecar.";}
async function command(context,page,s){
  const c=readJson(COMMAND,null);if(!c?.id||c.id===state.lastCommandId||!String(c.text||"").trim())return;
  save("Processing Scientist chat command",{lastCommandId:c.id});
  const r=await ask(page,user(String(c.text).trim(),s));
  const actionResult=await executeScientistAction(context,page,r,s).catch(e=>"action failed: "+String(e?.message||e));
  const o={id:c.id,createdAt:now(),request:String(c.text).trim(),response:r,actionResult};writeJson(RESPONSE,o);append(MEMORY,{at:o.createdAt,kind:"mitko-chat",request:o.request,response:r,actionResult});save("Scientist chat complete",{lastResponse:r,lastToolResult:actionResult});
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
      await command(context,page,s);
      const e=event(prev,s),last=state.lastAutoAnalysisAt?Date.parse(state.lastAutoAnalysisAt):0;
      if(booted&&e.important&&Date.now()-last>=AUTO_MIN){const r=await ask(page,observe(e.reason,s));const actionResult=await executeScientistAction(context,page,r,s).catch(x=>"action failed: "+String(x?.message||x));append(DECISIONS,{type:"autonomous-decision",at:now(),event:e.reason,snapshot:s,response:r,actionResult});append(MEMORY,{at:now(),kind:"observed-system-event",event:e.reason,response:r,actionResult});save("Autonomous Scientist decision recorded",{lastObservation:e.reason,lastDecision:r,lastAutoAnalysisAt:now(),lastToolResult:actionResult});}
      prev=s;
    }catch(err){save("Scientist loop error",{status:"degraded",lastError:String(err?.stack||err)});}
    await sleep(POLL);
  }
}
process.on("unhandledRejection",e=>save("Unhandled rejection",{status:"degraded",lastError:String(e?.stack||e)}));
process.on("uncaughtException",e=>{save("Uncaught exception",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
main().catch(e=>{save("Scientist fatal",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
