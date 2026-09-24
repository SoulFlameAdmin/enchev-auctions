import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { ensureChatGptEffortMode } from "./chatgpt-effort-mode.mjs";

const execFileAsync=promisify(execFile);
const HERE=path.dirname(fileURLToPath(import.meta.url));
const SCI_CDP=process.env.SF_SCIENTIST_CDP_URL||"http://127.0.0.1:9555";
const DAVID_CDP=process.env.DAVID_CDP_URL||"http://127.0.0.1:9444";
const STATE=path.join(HERE,".sf-scientist-state.json");
const SINGLETON_LOCK=path.join(HERE,".sf-scientist.lock");
const COMMAND=path.join(HERE,".sf-scientist-command.json");
const RESPONSE=path.join(HERE,".sf-scientist-response.json");
const DECISIONS=path.join(HERE,".sf-scientist-decisions.jsonl");
const MEMORY=path.join(HERE,".sf-scientist-memory.jsonl");
const TABMON=path.join(HERE,".david-tab-monitor.json");
const CAPTURE_DIR=path.join(HERE,".sf-scientist-captures");
const OPERATOR_LOG=path.join(HERE,".sf-scientist-operator.jsonl");
const SUPERVISOR_COMMAND=path.join(HERE,".sf-scientist-supervisor-command.json");
const SUPERVISOR_RESULT=path.join(HERE,".sf-scientist-supervisor-result.json");
const SUPERVISOR_RESULT_WAIT_MS=Number(process.env.SF_SCIENTIST_SUPERVISOR_RESULT_WAIT_MS||15000);
const SUPERVISOR_WORKERS=new Set(["SYSTEM","DESIGN","APP2","APK"]);
const MAX_AUTONOMOUS_STEPS=Number(process.env.SF_SCIENTIST_MAX_STEPS||4);
const POWERSHELL_TIMEOUT_MS=Number(process.env.SF_SCIENTIST_POWERSHELL_TIMEOUT_MS||60000);
const MAX_TOOL_OUTPUT=12000;
const RATE_LIMIT_BACKOFF_MS=Number(process.env.SF_SCIENTIST_RATE_LIMIT_BACKOFF_MS||120000);
const MAX_RATE_LIMIT_RETRIES=Number(process.env.SF_SCIENTIST_RATE_LIMIT_RETRIES||2);
const SEND_ACK_MS=Number(process.env.SF_SCIENTIST_SEND_ACK_MS||6500);
const MAX_SEND_ATTEMPTS=Number(process.env.SF_SCIENTIST_MAX_SEND_ATTEMPTS||3);
const GPT_WAIT_LIVE_REFRESH_MS=Number(process.env.SF_SCIENTIST_GPT_WAIT_LIVE_REFRESH_MS||2500);
const MAX_SHELLS=18;
const MAX_STATE_FILES=12;
const MAX_LOG_FILES=8;
const MAX_LOG_LINES=8;
const POLL=Number(process.env.SF_SCIENTIST_POLL_MS||1200);
const AUTO_MIN=Number(process.env.SF_SCIENTIST_AUTO_MIN_MS||8000);
const SETTLE_MS=Number(process.env.SF_SCIENTIST_SETTLE_MS||2500);
const MAX_EVENT_BURST_MS=Number(process.env.SF_SCIENTIST_MAX_EVENT_BURST_MS||7000);
const POWERSHELL_EXE=process.env.SystemRoot?path.join(process.env.SystemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe"):"powershell.exe";
let lastProcessProbeError=null;
let lastShellProbeError=null;
const READY_MS=180000;
const RESPONSE_MS=900000;
const SCIENTIST_CHAT_ROOT="https://chatgpt.com/";
const SCIENTIST_EFFORT="medium";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toISOString();
const digest=v=>crypto.createHash("sha256").update(String(v||"")).digest("hex").slice(0,16);

function readJson(p,f=null){
  try{return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));}
  catch{return f;}
}
function writeJson(p,v){const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(v,null,2),"utf8");fs.renameSync(t,p);}
function append(p,v){fs.appendFileSync(p,JSON.stringify(v)+"\n","utf8");}

let singletonFd=null;
let singletonOwned=false;
function pidAlive(pid){
  const n=Number(pid||0);
  if(!Number.isInteger(n)||n<=0)return false;
  try{process.kill(n,0);return true;}catch{return false;}
}
function acquireSingleton(){
  for(let attempt=0;attempt<2;attempt++){
    try{
      singletonFd=fs.openSync(SINGLETON_LOCK,"wx");
      fs.writeFileSync(singletonFd,JSON.stringify({pid:process.pid,startedAt:now()})+"\n","utf8");
      singletonOwned=true;
      return true;
    }catch(e){
      if(e&&e.code!=="EEXIST")throw e;
      const existing=readJson(SINGLETON_LOCK,null);
      if(existing&&pidAlive(existing.pid)){
        return false;
      }
      try{fs.unlinkSync(SINGLETON_LOCK);}catch{}
    }
  }
  return false;
}
function releaseSingleton(){
  if(!singletonOwned)return;
  try{if(singletonFd!==null)fs.closeSync(singletonFd);}catch{}
  singletonFd=null;
  try{
    const current=readJson(SINGLETON_LOCK,null);
    if(!current||Number(current.pid)===process.pid)fs.unlinkSync(SINGLETON_LOCK);
  }catch{}
  singletonOwned=false;
}

function ensureDir(p){try{fs.mkdirSync(p,{recursive:true});}catch{}}
function tailJsonl(p,count=8){
  try{
    return fs.readFileSync(p,"utf8").split(/\r?\n/).filter(Boolean).slice(-count).map(x=>{try{return JSON.parse(x);}catch{return null;}}).filter(Boolean);
  }catch{return [];}
}
function recentScientistMemory(){
  return tailJsonl(MEMORY,8).map(x=>({
    at:x.at||null,
    kind:x.kind||null,
    event:cleanText(x.event||"",220)||null,
    request:cleanText(x.request||"",220)||null,
    action:x.action||null,
    result:cleanText(x.result||x.actionResult||"",500)||null
  }));
}
if(!acquireSingleton()){
  process.exit(0);
}
process.on("exit",releaseSingleton);
process.on("SIGINT",()=>{releaseSingleton();process.exit(0);});
process.on("SIGTERM",()=>{releaseSingleton();process.exit(0);});

let state=readJson(STATE,{version:1,status:"starting",heartbeatAt:null,chatUrl:null,lastAction:"boot",lastObservation:null,lastDecision:null,lastResponse:null,lastCommandId:null,lastAutoAnalysisAt:null,loginRequired:false,liveActivity:"boot",activityAt:null});
function save(action,patch={}){
  const stamp=now();
  const meaningful=action!=="Scientist heartbeat";
  state={
    ...state,
    ...patch,
    heartbeatAt:stamp,
    lastAction:action,
    liveActivity:meaningful?action:(state.liveActivity||action),
    activityAt:meaningful?stamp:(state.activityAt||stamp)
  };
  writeJson(STATE,state);
}

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
  try{
    const cmd='$OutputEncoding=[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);'+ps;
    const x=await execFileAsync(POWERSHELL_EXE,["-NoProfile","-ExecutionPolicy","Bypass","-Command",cmd],{windowsHide:true,timeout:6000,maxBuffer:1048576});
    lastProcessProbeError=null;
    return JSON.parse(String(x.stdout||"{}").trim()||"{}");
  }catch(e){
    lastProcessProbeError=cleanText(e&&e.message||e,500);
    return {};
  }
}

function compactThought(text){
  const raw=String(text||"").replace(/\r/g,"").trim();
  if(!raw)return "";

  const order=["ВИДЯХ","РЕШИХ","ЗАЩО","ПРЕДЛАГАМ","RISK"];
  const sections=new Map();
  let current=null;

  for(const rawLine of raw.split("\n")){
    const line=rawLine.trim();
    if(!line)continue;

    const m=line.match(/^(ВИДЯХ|РЕШИХ|ЗАЩО|ПРЕДЛАГАМ|RISK|ACTION)\s*:\s*(.*)$/i);
    if(m){
      const key=m[1].toUpperCase();
      if(key==="ACTION"){current=null;continue;}
      current=order.find(x=>x.toUpperCase()===key)||null;
      if(current)sections.set(current,m[2]||"");
      continue;
    }

    if(current){
      const old=sections.get(current)||"";
      sections.set(current,(old+" "+line).trim());
    }
  }

  const out=[];
  for(const label of order){
    const value=cleanText(sections.get(label)||"",180);
    if(value)out.push(label+": "+value);
  }

  if(out.length)return out.join("\n");
  return cleanText(raw.replace(/\n+/g," "),520);
}

function cleanText(value,max=700){
  let t=String(value==null?"":value).replace(/\\u0000/g,"").replace(/\\r/g,"").trim();
  t=t
    .replace(/(authorization\\s*:\\s*bearer\\s+)[^\\s"']+/ig,"$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|password|passwd|secret)\\s*[=:]\\s*)[^\\s"';&]+/ig,"$1[REDACTED]")
    .replace(/\\bsk-[A-Za-z0-9_-]{12,}\\b/g,"[REDACTED_OPENAI_KEY]")
    .replace(/\\bgh[pousr]_[A-Za-z0-9_]{12,}\\b/g,"[REDACTED_GITHUB_TOKEN]");
  return t.length>max?t.slice(0,max)+"...":t;
}
function tailLines(p,maxLines=MAX_LOG_LINES){
  try{return fs.readFileSync(p,"utf8").replace(/^\\uFEFF/,"").split(/\\r?\\n/).filter(Boolean).slice(-maxLines).map(x=>cleanText(x,900));}
  catch{return [];}
}
function runtimeFiles(){
  let names=[];try{names=fs.readdirSync(HERE);}catch{}
  return {
    states:names.filter(n=>/^\\.david-.*\\.json$/i.test(n)).slice(0,80),
    logs:names.filter(n=>/\\.log$/i.test(n)).slice(0,40)
  };
}
function stateSummary(){
  const rows=[];
  for(const name of runtimeFiles().states){
    const j=readJson(path.join(HERE,name),null);
    if(!j||typeof j!=="object")continue;
    rows.push({
      file:name,
      updatedAt:j.updatedAt||j.heartbeatAt||j.lastUpdatedAt||null,
      status:j.status||null,
      watchdog:j.watchdog||null,
      lastAction:cleanText(j.lastAction||"",240)||null,
      lastError:cleanText(j.lastError||j.error||"",500)||null
    });
  }
  rows.sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
  return rows.slice(0,MAX_STATE_FILES);
}
function logSummary(){
  const files=runtimeFiles().logs.map(name=>{
    const p=path.join(HERE,name);let m=0;try{m=fs.statSync(p).mtimeMs||0;}catch{}
    return {name,path:p,mtime:m};
  }).filter(x=>x.mtime>0).sort((a,b)=>b.mtime-a.mtime).slice(0,MAX_LOG_FILES);
  const recent=[],alerts=[];
  const bad=/(error|failed|failure|exception|fatal|timeout|timed out|stalled|offline|problem in|crash|denied|refused)/i;
  for(const f of files){
    const lines=tailLines(f.path,MAX_LOG_LINES);
    if(lines.length)recent.push({file:f.name,mtime:new Date(f.mtime).toISOString(),lines});
    const hit=lines.filter(x=>bad.test(x)).slice(-4);
    if(hit.length)alerts.push({file:f.name,lines:hit});
  }
  return {recent,alerts};
}
async function shellProcesses(){
  const ps=[
    "$names=@('powershell.exe','pwsh.exe','cmd.exe','node.exe')",
    "$p=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$names -contains $_.Name -and $_.ProcessId -ne $PID})",
    "$o=@($p|Select-Object -First 80 @{n='pid';e={$_.ProcessId}},@{n='ppid';e={$_.ParentProcessId}},@{n='name';e={$_.Name}},@{n='cmd';e={$_.CommandLine}})",
    "$o|ConvertTo-Json -Compress"
  ].join(";");
  try{
    const cmd='$OutputEncoding=[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);'+ps;
    const x=await execFileAsync(POWERSHELL_EXE,["-NoProfile","-ExecutionPolicy","Bypass","-Command",cmd],{windowsHide:true,timeout:6500,maxBuffer:1048576});
    const raw=String(x.stdout||"").trim();if(!raw){lastShellProbeError=null;return [];}
    const parsed=JSON.parse(raw),arr=Array.isArray(parsed)?parsed:[parsed];
    lastShellProbeError=null;
    return arr.map(v=>({pid:Number(v.pid||0),ppid:Number(v.ppid||0),name:String(v.name||""),cmd:cleanText(v.cmd||"",520)})).filter(v=>v.pid).slice(0,MAX_SHELLS);
  }catch(e){
    lastShellProbeError=cleanText(e&&e.message||e,500);
    return [];
  }
}
function scientistWatchdogAudit(states,logs,probeErrors){
  const nowMs=Date.now();
  const activeNoProgress=states.filter(x=>/active-no-progress/i.test(String(x.watchdog||"")));
  const critical=states.filter(x=>/(fatal|offline|browser-dead|session-missing|composer-missing|recovery-budget-exhausted|stalled-awaiting-supervision|needs-scientist)/i.test(String(x.watchdog||"")) || /(?:fatal|uncaught|crash)/i.test(String(x.lastError||"")));
  const staleStates=states.filter(x=>{const t=Date.parse(String(x.updatedAt||""));return Number.isFinite(t)&&nowMs-t>300000;});
  const probeHealthy=!probeErrors.processCounts&&!probeErrors.shellProcesses;
  return {
    activeNoProgress:activeNoProgress.map(x=>({file:x.file,watchdog:x.watchdog,updatedAt:x.updatedAt,lastAction:x.lastAction})),
    critical:critical.map(x=>({file:x.file,watchdog:x.watchdog,updatedAt:x.updatedAt,lastError:x.lastError})),
    staleStates:staleStates.map(x=>({file:x.file,watchdog:x.watchdog,updatedAt:x.updatedAt})),
    logAlertCount:Array.isArray(logs.alerts)?logs.alerts.length:0,
    probeHealthy,
    needsAttention:Boolean(activeNoProgress.length||critical.length||staleStates.length||logs.alerts.length||!probeHealthy)
  };
}
async function liveTelemetry(){
  const shells=await shellProcesses();
  const logs=logSummary();
  const davidStates=stateSummary();
  const probeErrors={processCounts:lastProcessProbeError,shellProcesses:lastShellProbeError};
  const scientistAudit=scientistWatchdogAudit(davidStates,logs,probeErrors);
  return {shells,davidStates,recentLogs:logs.recent,logAlerts:logs.alerts,scientistAudit,probeErrors};
}
function telemetrySignature(t){
  return digest(JSON.stringify({
    shells:(t&&t.shells||[]).map(x=>[x.pid,x.ppid,x.name,x.cmd]),
    states:(t&&t.davidStates||[]).map(x=>[x.file,x.status,x.watchdog,x.lastAction,x.lastError]),
    alerts:t&&t.logAlerts||[],
    audit:t&&t.scientistAudit||null,
    probeErrors:t&&t.probeErrors||{}
  }));
}

function infer(p,tm,cdpOnline=false){
  const managed=tm&&tm.managed||{};
  const app2=Array.isArray(managed.APP2)?managed.APP2.length:0;
  const sysTab=Array.isArray(managed.SYSTEM)?managed.SYSTEM.length:0;
  const apkTab=Array.isArray(managed.APK)?managed.APK.length:0;
  const s=Number(p.SUP||0),y=Number(p.SYSTEM||0),d=Number(p.DPP||0),a=Number(p.APK||0),c=Number(p.CONTROL||0),g=Number(p.GUARD||0),f=Number(p.FREE||0),z=Number(p.DESIGN||0),t=Number(tm?.totalChatGptTabs||0);
  if(!s&&!y&&!d&&!a&&!c&&!f){
    if(cdpOnline&&app2===1&&t>=1)return "STARTING_DPP";
    if(cdpOnline&&sysTab===1&&t>=1)return "STARTING_SYSTEM";
    if(cdpOnline&&apkTab===1&&t>=1)return "STARTING_APK";
    if(cdpOnline&&t>0)return "EDGE_READY";
    return "STOPPED";
  }
  if(s===1&&y===1&&d===1&&a===1&&c===0&&g===1&&f===0&&z===0)return "SOULFLAME";
  if(s===1&&f===2&&!y&&!d&&!a&&!c&&!z)return "AB";
  if(s===1&&g===1&&y===1&&!d&&!a&&!c&&!f&&!z&&t===1)return "SOLO_SYSTEM";
  if(s===1&&g===1&&!y&&d===1&&!a&&!c&&!f&&!z&&t===1)return "SOLO_DPP";
  if(s===1&&g===1&&!y&&!d&&a===1&&!c&&!f&&!z&&t===1)return "SOLO_APK";
  return "CHECK";
}
async function snapshot(){
  const [p,ver,telemetry]=await Promise.all([
    processes(),
    fetchJson(DAVID_CDP+"/json/version").catch(()=>null),
    liveTelemetry()
  ]);
  const tm=readJson(TABMON,null),m=tm?.managed||{};
  return {at:now(),mode:infer(p,tm,Boolean(ver)),cdp9444Online:Boolean(ver),process:p,monitor:tm?{totalChatGptTabs:Number(tm.totalChatGptTabs||0),SYSTEM:Array.isArray(m.SYSTEM)?m.SYSTEM.length:0,DESIGN:Array.isArray(m.DESIGN)?m.DESIGN.length:0,APP2:Array.isArray(m.APP2)?m.APP2.length:0,APK:Array.isArray(m.APK)?m.APK.length:0,CONTROL:Array.isArray(m.CONTROL)?m.CONTROL.length:0,FREE_A:Array.isArray(m.FREE_A)?m.FREE_A.length:0,FREE_B:Array.isArray(m.FREE_B)?m.FREE_B.length:0}:null,liveTelemetry:telemetry};
}
function materialSnapshotView(s){
  return {
    mode:s&&s.mode||null,
    cdp9444Online:Boolean(s&&s.cdp9444Online),
    process:s&&s.process||{},
    monitor:s&&s.monitor||null
  };
}
function materialSnapshotKey(s){
  return digest(JSON.stringify(materialSnapshotView(s)));
}

function event(prev,next){
  if(!prev)return {important:true,reason:"Scientist attached to current DAVID state"};
  if(prev.mode!==next.mode)return {important:true,reason:"DAVID mode changed "+prev.mode+" -> "+next.mode};
  if(prev.cdp9444Online!==next.cdp9444Online)return {important:true,reason:"DAVID CDP 9444 "+(next.cdp9444Online?"ONLINE":"OFFLINE")};
  if(digest(JSON.stringify(prev.process))!==digest(JSON.stringify(next.process)))return {important:true,reason:"DAVID process topology changed"};
  if(digest(JSON.stringify(prev.monitor))!==digest(JSON.stringify(next.monitor)))return {important:true,reason:"DAVID managed ChatGPT tab topology changed"};
  if(telemetrySignature(prev.liveTelemetry)!==telemetrySignature(next.liveTelemetry)){
    if(digest(JSON.stringify(prev.liveTelemetry&&prev.liveTelemetry.scientistAudit||null))!==digest(JSON.stringify(next.liveTelemetry&&next.liveTelemetry.scientistAudit||null)))
      return {important:true,reason:"SF Scientist watchdog audit changed"};
    if(digest(JSON.stringify(prev.liveTelemetry&&prev.liveTelemetry.logAlerts||[]))!==digest(JSON.stringify(next.liveTelemetry&&next.liveTelemetry.logAlerts||[])))
      return {important:true,reason:"DAVID live log/error telemetry changed"};
    return {important:true,reason:"DAVID PowerShell/CMD/Node or runtime-state telemetry changed"};
  }
  return {important:false,reason:null};
}
function chatUrl(u){const m=String(u||"").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+/i);return m?m[0]:null;}

function normalizeUiText(v){return String(v||"").replace(/\s+/g," ").trim();}
async function visibleDialogTexts(page){
  const out=[];
  const dialogs=page.locator('[role="dialog"],[data-radix-dialog-content]');
  const n=await dialogs.count().catch(()=>0);
  for(let i=0;i<n;i++){
    const d=dialogs.nth(i);
    if(!await d.isVisible().catch(()=>false))continue;
    const t=normalizeUiText(await d.innerText().catch(()=>""));
    if(t)out.push({node:d,text:t});
  }
  return out;
}
function rateLimitText(text){
  return /(Твърде много заявки|Правите заявки прекалено бързо|too many requests|requests too quickly|rate limit|temporarily limited)/i.test(String(text||""));
}
async function safeDismissChatGptUi(page){
  if(!page||page.isClosed())return {dismissed:false,rateLimited:false,reason:"page-unavailable"};

  const dialogs=await visibleDialogTexts(page);
  let scope=null;
  let detectedText="";

  for(const d of dialogs){
    if(rateLimitText(d.text)){
      scope=d.node;
      detectedText=d.text;
      break;
    }
  }

  if(!scope){
    const body=normalizeUiText(await page.locator("body").innerText().catch(()=>""));
    if(rateLimitText(body)){
      scope=page;
      detectedText=body;
    }
  }

  if(!scope)return {dismissed:false,rateLimited:false,reason:null};

  const safeLabel=/^(Разбрано|Разбрах|Got it|OK|Okay|Close|Затвори)$/i;
  const candidates=scope.locator('button,[role="button"]');
  const n=await candidates.count().catch(()=>0);

  for(let i=n-1;i>=0;i--){
    const b=candidates.nth(i);
    if(!await b.isVisible().catch(()=>false))continue;

    const text=normalizeUiText(await b.innerText().catch(()=>""));
    const aria=normalizeUiText((await b.getAttribute("aria-label").catch(()=>""))||"");
    const label=safeLabel.test(text)?text:(safeLabel.test(aria)?aria:"");
    if(!label)continue;

    try{
      await b.click({timeout:2500});
      const at=now();
      save("Scientist auto-dismissed safe ChatGPT rate-limit dialog",{
        status:"rate-limited",
        lastUiRecovery:{at,type:"rate-limit",button:label,dialog:cleanText(detectedText,500)},
        rateLimitBackoffUntil:new Date(Date.now()+RATE_LIMIT_BACKOFF_MS).toISOString()
      });
      append(OPERATOR_LOG,{at,kind:"ui-recovery",type:"rate-limit",button:label,dialog:cleanText(detectedText,500)});
      return {dismissed:true,rateLimited:true,reason:"rate-limit",button:label,dialog:detectedText};
    }catch(e){
      return {dismissed:false,rateLimited:true,reason:"rate-limit-click-failed",error:String(e&&e.message||e)};
    }
  }

  return {dismissed:false,rateLimited:true,reason:"rate-limit-dialog-no-safe-button",dialog:detectedText};
}

async function waitRateLimitBackoff(page,context){
  const until=Date.now()+RATE_LIMIT_BACKOFF_MS;
  let lastLiveRefreshAt=0;
  save("Scientist respecting ChatGPT rate limit",{
    status:"rate-limited",
    rateLimitBackoffUntil:new Date(until).toISOString()
  });

  while(Date.now()<until){
    await safeDismissChatGptUi(page).catch(()=>null);

    if(Date.now()-lastLiveRefreshAt>=GPT_WAIT_LIVE_REFRESH_MS){
      lastLiveRefreshAt=Date.now();
      try{
        const live=await snapshot();
        save("Scientist heartbeat",{
          status:"rate-limited",
          liveSnapshot:live,
          currentMode:live.mode,
          currentCdp9444Online:live.cdp9444Online,
          rateLimitBackoffUntil:new Date(until).toISOString(),
          rateLimitLiveRefreshedAt:now()
        });
      }catch(e){
        save("Scientist heartbeat",{
          status:"rate-limited",
          rateLimitBackoffUntil:new Date(until).toISOString(),
          rateLimitProbeError:cleanText(e&&e.message||e,500)
        });
      }
    }

    await sleep(Math.min(1000,Math.max(250,until-Date.now())));
  }

  save("Scientist rate-limit backoff complete",{
    status:"online-warning",
    rateLimitBackoffUntil:null,
    lastUiRecovery:context||state.lastUiRecovery
  });
}

async function composer(page){for(const s of ["#prompt-textarea",'[data-testid="prompt-textarea"]','div[contenteditable="true"][role="textbox"]','div[contenteditable="true"]']){const x=page.locator(s).last();if(await x.count().catch(()=>0)&&await x.isVisible().catch(()=>false))return x;}return null;}
async function latest(page){try{const n=page.locator('[data-message-author-role="assistant"]');if(!await n.count())return "";return (await n.last().innerText().catch(()=>"")).trim();}catch{return "";}}
async function busy(page){for(const s of ['[data-testid="stop-button"]','[data-testid*="stop" i]','button[aria-label*="Stop"]']){const n=page.locator(s).last();if(await n.count().catch(()=>0)&&await n.isVisible().catch(()=>false))return true;}return false;}

function workLikeUrl(url){
  return /https:\/\/chatgpt\.com\/(?:work|workspace)(?:\/|$|\?)/i.test(String(url||"")) ||
         /[?&](?:mode|product)=work(?:&|$)/i.test(String(url||""));
}
async function exactVisibleControl(page,regex){
  const nodes=page.locator('button,[role="button"],[role="tab"],a');
  const n=await nodes.count().catch(()=>0);
  for(let i=n-1;i>=0;i--){
    const x=nodes.nth(i);
    if(!await x.isVisible().catch(()=>false))continue;
    const text=((await x.innerText().catch(()=>""))||"").replace(/\s+/g," ").trim();
    const aria=((await x.getAttribute("aria-label").catch(()=>""))||"").replace(/\s+/g," ").trim();
    if(regex.test(text)||regex.test(aria))return x;
  }
  return null;
}
async function workLimitVisible(page){
  try{
    const body=(await page.locator("body").innerText().catch(()=>"")).replace(/\s+/g," ");
    return /(Временно сте изчерпали лимита за използване на Work|temporarily.{0,80}(?:limit|quota).{0,40}Work|upgrade.{0,40}Work|add credits.{0,40}Work)/i.test(body);
  }catch{return false;}
}
async function scientistModelSolVisible(page){
  try{
    const nodes=page.locator('button,[role="button"]');
    const n=await nodes.count().catch(()=>0);
    for(let i=n-1;i>=0;i--){
      const x=nodes.nth(i);
      if(!await x.isVisible().catch(()=>false))continue;
      const text=((await x.innerText().catch(()=>""))||"").replace(/\s+/g," ").trim();
      const aria=((await x.getAttribute("aria-label").catch(()=>""))||"").replace(/\s+/g," ").trim();
      if(/GPT-5\.6\s*Sol/i.test(text)||/GPT-5\.6\s*Sol/i.test(aria))return true;
    }
  }catch{}
  return false;
}
async function ensureNormalChatExperience(page){
  if(!page||page.isClosed())return {ok:false,reason:"page-unavailable"};
  let clickedChat=false;
  let navigated=false;

  if(workLikeUrl(page.url())){
    await page.goto(SCIENTIST_CHAT_ROOT,{waitUntil:"domcontentloaded",timeout:60000});
    navigated=true;
    await sleep(700);
  }

  const chat=await exactVisibleControl(page,/^(Chat|Чат)$/i);
  if(chat){
    try{
      await chat.click({timeout:2500});
      clickedChat=true;
      await sleep(900);
    }catch(e){
      return {ok:false,reason:"chat-click-failed",clickedChat:false,navigated,error:String(e&&e.message||e)};
    }
  }else if(!navigated){
    return {ok:false,reason:"chat-toggle-not-found",clickedChat:false,navigated:false};
  }

  const composerReady=Boolean(await composer(page));
  const ok=!workLikeUrl(page.url())&&composerReady&&(clickedChat||navigated);
  return {ok,reason:ok?"chat-click-confirmed":composerReady?"chat-not-confirmed":"composer-missing",clickedChat,navigated};
}

async function ensureScientistChatMedium(page){
  if(!page||page.isClosed())return {ok:false,reason:"page-unavailable"};

  const chat=await ensureNormalChatExperience(page);
  if(!chat.ok){
    save("Scientist Chat profile NOT confirmed",{
      scientistExperience:"UNKNOWN",
      scientistReasoning:"UNKNOWN",
      scientistModel:"UNKNOWN",
      scientistProfileConfirmed:false,
      scientistProfileReason:chat.reason
    });
    return {ok:false,chat,effort:null,modelOk:false,reason:chat.reason};
  }

  const effort=await ensureChatGptEffortMode(page,SCIENTIST_EFFORT);
  const modelOk=await scientistModelSolVisible(page);
  const ok=Boolean(chat.ok&&effort&&effort.ok&&modelOk);
  save("Scientist Chat/Medium profile checked",{
    scientistExperience:"CHAT",
    scientistReasoning:effort&&effort.ok?"MEDIUM":"UNCONFIRMED",
    scientistModel:modelOk?"GPT-5.6 Sol":"UNCONFIRMED",
    scientistProfileConfirmed:ok,
    scientistProfileReason:ok?"chat-sol-medium-confirmed":((effort&&effort.reason)||(!modelOk?"model-not-confirmed":"profile-not-confirmed")),
    scientistPickerLabel:effort&&effort.pickerLabel||null,
    clickedChat:Boolean(chat.clickedChat)
  });
  return {ok,chat,effort,modelOk,reason:ok?"chat-sol-medium-confirmed":((effort&&effort.reason)||"profile-not-confirmed")};
}

async function ready(page){
  const t=Date.now();
  let profileFailures=0;
  while(Date.now()-t<READY_MS){
    const c=await composer(page);
    if(c){
      const profile=await ensureScientistChatMedium(page).catch(e=>({ok:false,reason:String(e&&e.message||e)}));
      const u=chatUrl(page.url());
      if(profile&&profile.ok){
        save("Scientist chat ready",{
          status:"online",chatUrl:u||state.chatUrl,loginRequired:false,
          scientistExperience:"CHAT",scientistReasoning:"MEDIUM",scientistModel:"GPT-5.6 Sol",
          scientistProfileConfirmed:true,scientistProfileWarning:null
        });
      }else{
        profileFailures++;
        save("Scientist chat ready with profile warning",{
          status:"online-warning",chatUrl:u||state.chatUrl,loginRequired:false,
          scientistExperience:"CHAT",
          scientistReasoning:"BEST-EFFORT-MEDIUM",
          scientistModel:"GPT-5.6 Sol",
          scientistProfileConfirmed:false,
          scientistProfileWarning:profile&&profile.reason||"profile-not-confirmed",
          scientistPickerLabel:profile&&profile.effort&&profile.effort.pickerLabel||null,
          profileVerifyAttempts:profileFailures
        });
      }
      return page;
    }
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
async function userMessageCount(page){
  try{return await page.locator('[data-message-author-role="user"]').count();}
  catch{return 0;}
}
async function composerTextValue(c){
  if(!c)return "";
  try{
    const value=await c.inputValue({timeout:500}).catch(()=>null);
    if(value!==null)return String(value||"").trim();
  }catch{}
  try{return String((await c.innerText().catch(()=>""))||"").trim();}
  catch{return "";}
}
async function waitForSendAck(page,beforeUserCount,attempt){
  const started=Date.now();
  while(Date.now()-started<SEND_ACK_MS){
    const ui=await safeDismissChatGptUi(page).catch(()=>({dismissed:false,rateLimited:false}));
    if(ui.rateLimited)return {ok:false,rateLimited:true,uiRecovery:ui,reason:"rate-limited"};

    const count=await userMessageCount(page);
    if(count>beforeUserCount)return {ok:true,reason:"user-message-count-increased",attempt,userMessageCount:count};

    const c=await composer(page);
    if(c){
      const txt=await composerTextValue(c);
      if(!txt)return {ok:true,reason:"composer-cleared",attempt,userMessageCount:count};
    }

    await sleep(250);
  }
  return {ok:false,rateLimited:false,reason:"send-not-acknowledged",attempt};
}
async function trySubmitPrompt(page,c,attempt){
  const selectors=[
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Изпрат" i]'
  ];

  if(attempt===1){
    for(const sel of selectors){
      const b=page.locator(sel).last();
      if(await b.count().catch(()=>0)&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false)){
        try{await b.click({timeout:2000});return "button:"+sel;}catch{}
      }
    }
  }

  if(attempt===2){
    try{await c.press("Enter",{timeout:2500});return "enter";}catch{}
  }

  if(attempt>=3){
    for(const sel of selectors){
      const b=page.locator(sel).last();
      if(await b.count().catch(()=>0)&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false)){
        try{await b.click({timeout:2000,force:true});return "force-button:"+sel;}catch{}
      }
    }
    try{await c.press("Enter",{timeout:2500});return "enter-fallback";}catch{}
  }

  return "no-submit-control";
}
async function send(page,text){
  const preUi=await safeDismissChatGptUi(page).catch(()=>({dismissed:false,rateLimited:false}));
  if(preUi.rateLimited){
    await waitRateLimitBackoff(page,preUi);
  }

  const profile=await ensureScientistChatMedium(page).catch(e=>({ok:false,reason:String(e&&e.message||e)}));
  if(!profile||!profile.ok){
    save("Scientist send proceeding with profile warning",{
      status:"online-warning",
      scientistProfileConfirmed:false,
      scientistProfileWarning:profile&&profile.reason||"profile-not-confirmed",
      scientistPickerLabel:profile&&profile.effort&&profile.effort.pickerLabel||null
    });
  }

  for(let attempt=1;attempt<=MAX_SEND_ATTEMPTS;attempt++){
    const c=await composer(page);
    if(!c)throw new Error("Scientist composer unavailable");

    const beforeUserCount=await userMessageCount(page);
    const currentText=await composerTextValue(c);

    if(currentText!==text){
      try{
        await c.fill(text,{timeout:3000});
      }catch{
        await c.focus();
        await page.keyboard.press("Control+A").catch(()=>{});
        await page.keyboard.insertText(text);
      }
    }

    const method=await trySubmitPrompt(page,c,attempt);
    save("Scientist submit attempt",{
      status:"sending",
      sendAttempt:attempt,
      sendMethod:method,
      sendAck:false,
      pendingPromptPreview:cleanText(text,500)
    });

    const ack=await waitForSendAck(page,beforeUserCount,attempt);
    if(ack.rateLimited){
      save("Scientist send hit rate limit",{
        status:"rate-limited",
        sendAttempt:attempt,
        sendMethod:method,
        sendAck:false
      });
      return {submitted:false,acknowledged:false,rateLimited:true,uiRecovery:ack.uiRecovery,attempt,method,reason:ack.reason};
    }

    if(ack.ok){
      save("Scientist send acknowledged",{
        status:"thinking",
        sendAttempt:attempt,
        sendMethod:method,
        sendAck:true,
        sendAckReason:ack.reason,
        pendingPromptPreview:null
      });
      return {submitted:true,acknowledged:true,rateLimited:false,attempt,method,reason:ack.reason};
    }

    save("Scientist send not acknowledged; retrying",{
      status:"send-retry",
      sendAttempt:attempt,
      sendMethod:method,
      sendAck:false,
      sendAckReason:ack.reason
    });
    await sleep(400);
  }

  throw new Error("Scientist send failed: prompt was not acknowledged after "+MAX_SEND_ATTEMPTS+" attempts");
}

async function ask(page,prompt,contextSnapshot=null){
  const base=digest(await latest(page));
  const promptEpoch=contextSnapshot?materialSnapshotKey(contextSnapshot):null;
  let liveEpoch=promptEpoch;
  let contextStale=false;
  let rateRetries=0;

  save("Scientist preparing prompt context",{
    responseContextEpoch:promptEpoch,
    responseContextStale:false,
    staleResponseSuppressed:false
  });

  let sent=await send(page,prompt);
  while(sent&&sent.rateLimited&&rateRetries<MAX_RATE_LIMIT_RETRIES){
    rateRetries++;
    await waitRateLimitBackoff(page,sent.uiRecovery);
    sent=await send(page,prompt);
  }
  if(sent&&sent.rateLimited)throw new Error("Scientist rate-limited after retry budget");
  if(!sent||!sent.acknowledged)throw new Error("Scientist prompt not acknowledged");
  save("Scientist prompt sent",{status:"thinking",lastPromptAt:now(),sendAck:true,responseContextEpoch:promptEpoch});

  let last=base,stable="",since=0,start=Date.now(),lastLiveRefreshAt=0;
  while(Date.now()-start<RESPONSE_MS){
    if(Date.now()-lastLiveRefreshAt>=GPT_WAIT_LIVE_REFRESH_MS){
      lastLiveRefreshAt=Date.now();
      try{
        const live=await snapshot();
        liveEpoch=materialSnapshotKey(live);
        if(promptEpoch&&liveEpoch!==promptEpoch)contextStale=true;
        save("Scientist heartbeat",{
          status:"thinking",
          liveSnapshot:live,
          currentMode:live.mode,
          currentCdp9444Online:live.cdp9444Online,
          gptWaitLiveRefreshedAt:now(),
          responseContextEpoch:promptEpoch,
          currentRuntimeEpoch:liveEpoch,
          responseContextStale:contextStale
        });
      }catch(e){
        save("Scientist heartbeat",{status:"thinking",gptWaitProbeError:cleanText(e&&e.message||e,500)});
      }
    }

    const ui=await safeDismissChatGptUi(page).catch(()=>({dismissed:false,rateLimited:false}));
    if(ui.rateLimited){
      if(rateRetries>=MAX_RATE_LIMIT_RETRIES)throw new Error("Scientist rate-limited while waiting for response");
      rateRetries++;
      await waitRateLimitBackoff(page,ui);
      const retry=await send(page,prompt);
      if(retry&&retry.rateLimited)continue;
      if(!retry||!retry.acknowledged)throw new Error("Scientist retry prompt not acknowledged");
      save("Scientist prompt resent after rate-limit backoff",{status:"thinking",lastPromptAt:now(),sendAck:true});
    }

    const text=await latest(page),h=digest(text);
    if(h&&h!==last){
      last=h;stable=h;since=Date.now();
      if(contextStale){
        save("Scientist stale response progressing",{
          status:"refreshing",
          staleResponsePreview:cleanText(text,800),
          staleResponseSuppressed:true,
          responseContextStale:true
        });
      }else{
        save("Scientist response progressing",{
          status:"thinking",
          lastResponsePreview:cleanText(text,800),
          thoughtSummary:compactThought(text)
        });
      }
    }

    if(await busy(page)){await sleep(800);continue;}

    if(h&&h!==base){
      if(h!==stable){stable=h;since=Date.now();}
      if(Date.now()-since>1200){
        try{
          const live=await snapshot();
          liveEpoch=materialSnapshotKey(live);
          if(promptEpoch&&liveEpoch!==promptEpoch)contextStale=true;
        }catch{}

        const u=chatUrl(page.url());
        if(contextStale){
          save("Scientist response captured but stale",{
            status:"refreshing",
            chatUrl:u||state.chatUrl,
            staleResponse:text,
            staleResponseAt:now(),
            staleResponseSuppressed:true,
            responseContextStale:true,
            responseContextEpoch:promptEpoch,
            currentRuntimeEpoch:liveEpoch,
            lastResponsePreview:null
          });
        }else{
          save("Scientist response captured",{
            status:"online",
            chatUrl:u||state.chatUrl,
            lastResponse:text,
            lastResponseAt:now(),
            thoughtSummary:compactThought(text),
            lastThoughtSummary:compactThought(text),
            responseContextStale:false,
            staleResponseSuppressed:false,
            lastResponsePreview:null
          });
        }
        return text;
      }
    }
    await sleep(700);
  }
  throw new Error("Scientist response timeout");
}

async function askFresh(page,prompt,contextSnapshot,label="runtime analysis"){
  let baseSnapshot=contextSnapshot||await snapshot();
  let response=await ask(page,prompt,baseSnapshot);

  if(!state.responseContextStale){
    return {response,snapshot:baseSnapshot,refreshed:false};
  }

  const fresh=await snapshot();
  save("Scientist stale conclusion suppressed; refreshing",{
    status:"refreshing",
    staleResponseSuppressed:true,
    staleResponseReason:"material DAVID runtime changed while GPT was answering",
    staleResponseLabel:label,
    freshRuntimeMode:fresh.mode,
    freshRuntimeCdp9444Online:fresh.cdp9444Online
  });

  const refreshPrompt=
    "SF SCIENTIST CONTEXT REFRESH\\n\\n"+
    "Your immediately previous answer is stale because DAVID materially changed while you were answering. "+
    "Do NOT present the previous conclusion as current. Re-evaluate only from the fresh evidence below. "+
    "If the previous conclusion is still valid, prove it again from this snapshot.\\n\\n"+
    "FRESH DAVID SNAPSHOT:\\n"+JSON.stringify(fresh,null,2)+
    "\\n\\nReturn compactly in Bulgarian:\\nВИДЯХ: ...\\nРЕШИХ: ...\\nЗАЩО: ...\\nПРЕДЛАГАМ: ...\\nRISK: LOW|MEDIUM|HIGH\\nACTION: ...";

  response=await ask(page,refreshPrompt,fresh);
  return {response,snapshot:fresh,refreshed:true};
}


function redactToolOutput(value,max=MAX_TOOL_OUTPUT){
  return cleanText(String(value||""),max);
}
function quotePsLiteral(v){return "'"+String(v).replace(/'/g,"''")+"'";}
function classifyPowerShell(command){
  const c=String(command||"").trim();
  if(!c)return {allowed:false,reason:"empty-command"};
  if(c.length>6000)return {allowed:false,reason:"command-too-long"};
  const hardBlock=[
    /\bRemove-Item\b/i,/\bdel(?:ete)?\b/i,/\berase\b/i,/\brd\b/i,/\brmdir\b/i,
    /\bFormat-(?:Volume|Disk)\b/i,/\bClear-Disk\b/i,/\bInitialize-Disk\b/i,/\bdiskpart\b/i,
    /\bStop-Computer\b/i,/\bRestart-Computer\b/i,/\bshutdown(?:\.exe)?\b/i,/\bbcdedit\b/i,
    /\bSet-MpPreference\b/i,/\bSet-ExecutionPolicy\b/i,/\bDisable-WindowsOptionalFeature\b/i,
    /\bNew-LocalUser\b/i,/\bSet-LocalUser\b/i,/\bRemove-LocalUser\b/i,/\bnet\s+user\b/i,/\bnet\s+localgroup\b/i,
    /\bschtasks\b/i,/\bNew-ScheduledTask\b/i,/\bRegister-ScheduledTask\b/i,
    /\bsc(?:\.exe)?\s+(?:delete|config)\b/i,/\bStop-Service\b/i,/\bSet-Service\b/i,
    /\btakeown\b/i,/\bicacls\b.*(?:\/grant|\/deny|\/reset)/i,
    /\bmanage-bde\b/i,/\bcipher\b.*\/w/i,
    /\breg(?:\.exe)?\s+(?:add|delete)\b/i,
    /\bSet-ItemProperty\b.*\bHK(?:LM|CU|CR|U|CC)\b/i,
    /\bNew-ItemProperty\b.*\bHK(?:LM|CU|CR|U|CC)\b/i,
    /\bStart-Process\b[^\r\n;]*\b-Verb\s+RunAs\b/i,/\brunas(?:\.exe)?\b/i,
    /\bStop-Process\b/i,/\btaskkill(?:\.exe)?\b/i,/\bsc(?:\.exe)?\s+(?:stop|delete)\b/i,
    /\bInvoke-Expression\b/i,/(?:^|[\s;|])iex(?:\s|$)/i
  ];
  const hit=hardBlock.find(r=>r.test(c));
  if(hit)return {allowed:false,reason:"blocked-high-risk-pattern"};
  return {allowed:true,reason:"normal-user-operator"};
}
async function runPowerShell(command){
  const policy=classifyPowerShell(command);
  const startedAt=now();

  append(OPERATOR_LOG,{at:startedAt,kind:"tool-start",tool:"POWERSHELL",command:cleanText(command,2000)});
  save("Scientist PowerShell requested",{
    lastToolKind:"POWERSHELL",
    lastToolStatus:policy.allowed?"RUNNING":"BLOCKED",
    lastToolCommand:cleanText(command,2000),
    lastToolStartedAt:startedAt,
    lastToolFinishedAt:null,
    lastToolResult:null
  });

  if(!policy.allowed){
    const result={ok:false,blocked:true,reason:policy.reason,command:cleanText(command,1000)};
    append(OPERATOR_LOG,{at:now(),kind:"powershell-blocked",...result});
    save("Scientist PowerShell blocked",{
      lastToolKind:"POWERSHELL",
      lastToolStatus:"BLOCKED",
      lastToolFinishedAt:now(),
      lastToolResult:cleanText(JSON.stringify(result),5000)
    });
    return result;
  }

  const started=Date.now();
  try{
    const x=await execFileAsync(POWERSHELL_EXE,[
      "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",
      '$OutputEncoding=[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);'+command
    ],{windowsHide:true,timeout:POWERSHELL_TIMEOUT_MS,maxBuffer:4*1024*1024});

    const result={
      ok:true,blocked:false,exitCode:0,durationMs:Date.now()-started,
      stdout:redactToolOutput(x.stdout),stderr:redactToolOutput(x.stderr),
      command:cleanText(command,1000)
    };

    append(OPERATOR_LOG,{at:now(),kind:"powershell",...result});
    save("Scientist PowerShell complete",{
      lastToolKind:"POWERSHELL",
      lastToolStatus:"DONE",
      lastToolFinishedAt:now(),
      lastToolResult:cleanText(
        (result.stdout?"STDOUT:\\n"+result.stdout:"")+
        (result.stderr?"\\nSTDERR:\\n"+result.stderr:"")+
        (!result.stdout&&!result.stderr?"exitCode=0":""),
        6000
      )
    });
    return result;
  }catch(e){
    const result={
      ok:false,blocked:false,durationMs:Date.now()-started,
      stdout:redactToolOutput(e&&e.stdout),stderr:redactToolOutput(e&&e.stderr),
      error:redactToolOutput(e&&e.message||e,3000),command:cleanText(command,1000)
    };
    append(OPERATOR_LOG,{at:now(),kind:"powershell",...result});
    save("Scientist PowerShell failed",{
      lastToolKind:"POWERSHELL",
      lastToolStatus:"FAILED",
      lastToolFinishedAt:now(),
      lastToolResult:cleanText(
        (result.stdout?"STDOUT:\\n"+result.stdout:"")+
        (result.stderr?"\\nSTDERR:\\n"+result.stderr:"")+
        (result.error?"\\nERROR:\\n"+result.error:""),
        6000
      )
    });
    return result;
  }
}

async function captureDesktop(){
  ensureDir(CAPTURE_DIR);
  const file=path.join(CAPTURE_DIR,"screen-"+Date.now()+".png");
  const ps=[
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$b=[System.Windows.Forms.SystemInformation]::VirtualScreen",
    "$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height",
    "$g=[System.Drawing.Graphics]::FromImage($bmp)",
    "$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)",
    "$bmp.Save("+quotePsLiteral(file)+",[System.Drawing.Imaging.ImageFormat]::Png)",
    "$g.Dispose()",
    "$bmp.Dispose()"
  ].join(";");
  const r=await runPowerShell(ps);
  if(!r.ok||!fs.existsSync(file))throw new Error("desktop screenshot failed: "+(r.error||r.stderr||r.reason||"unknown"));
  try{
    const old=fs.readdirSync(CAPTURE_DIR).filter(x=>/\.png$/i.test(x)).map(x=>({x,p:path.join(CAPTURE_DIR,x),m:fs.statSync(path.join(CAPTURE_DIR,x)).mtimeMs})).sort((a,b)=>b.m-a.m).slice(20);
    for(const x of old)fs.unlinkSync(x.p);
  }catch{}
  append(OPERATOR_LOG,{at:now(),kind:"desktop-capture",file});
  return file;
}
async function attachFile(page,file){
  let input=page.locator('input[type="file"]').last();
  if(!await input.count().catch(()=>0)){
    for(const sel of ['button[aria-label*="Attach" i]','button[aria-label*="Upload" i]','button[data-testid*="attach" i]']){
      const b=page.locator(sel).last();
      if(await b.count().catch(()=>0)&&await b.isVisible().catch(()=>false)){
        await b.click({timeout:2000}).catch(()=>{});
        await sleep(400);
        input=page.locator('input[type="file"]').last();
        if(await input.count().catch(()=>0))break;
      }
    }
  }
  if(!await input.count().catch(()=>0))throw new Error("ChatGPT file input not available");
  await input.setInputFiles(file);
  await sleep(700);
}
async function inspectScreen(page,question,snapshot){
  const file=await captureDesktop();
  await attachFile(page,file);
  const answer=await ask(page,
    "SF SCIENTIST SCREEN INSPECTION\\n"+
    "Inspect the attached current Windows desktop screenshot. Question: "+(question||"What is visibly happening and is there evidence of an error?")+
    "\\nCross-check against this DAVID telemetry and do not infer hidden facts:\\n"+JSON.stringify(snapshot,null,2)+
    "\\nReturn visible evidence, likely interpretation, uncertainty, and next low-risk action. End with ACTION: NONE."
  );
  append(MEMORY,{at:now(),kind:"screen-inspection",file,question,answer});
  return "SCREEN INSPECTION:\\n"+answer;
}
async function consultProjectConnectors(page,question,snapshot){
  const answer=await ask(page,
    "@GitHub @Vercel @Supabase\\n\\nSF SCIENTIST PROJECT CHECK\\n"+
    String(question||"Inspect the current project state relevant to the observed DAVID event.")+
    "\\n\\nUse connected tools when available. Never invent connector evidence, and do not bypass login/MFA/CAPTCHA/permissions. "+
    "Do not make destructive or production changes. Compare findings to this local snapshot:\\n"+JSON.stringify(snapshot,null,2)+
    "\\nReturn exact evidence and what remains uncertain. End with ACTION: NONE."
  );
  append(MEMORY,{at:now(),kind:"project-connector-check",question,answer});
  return "PROJECT CONNECTOR CHECK:\\n"+answer;
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
    if(await composer(page)){
      await ensureScientistChatMedium(page).catch(()=>null);
      return page;
    }
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
async function requestSupervisorAction(type,target,reason,snapshot){
  const action=String(type||"").toUpperCase(),worker=String(target||"").toUpperCase();
  if(!["REFRESH","RESTART"].includes(action))throw new Error("DAVID_RECOVER allows REFRESH or RESTART only");
  if(!SUPERVISOR_WORKERS.has(worker))throw new Error("DAVID_RECOVER target must be SYSTEM|DESIGN|APP2|APK");
  const id="sci-"+Date.now()+"-"+crypto.randomBytes(4).toString("hex");
  const command={id,createdAt:now(),source:"SF_SCIENTIST",actions:[{type:action,target:worker}],reason:cleanText(reason||"Scientist evidence-based recovery request",600),evidenceEpoch:materialSnapshotKey(snapshot||{})};
  writeJson(SUPERVISOR_COMMAND,command);
  append(OPERATOR_LOG,{at:now(),kind:"supervisor-request",...command});
  save("Scientist Supervisor recovery requested",{lastSupervisorRequest:command,lastSupervisorResult:null});
  const until=Date.now()+SUPERVISOR_RESULT_WAIT_MS;
  while(Date.now()<until){
    const result=readJson(SUPERVISOR_RESULT,null);
    if(result&&result.id===id){
      append(OPERATOR_LOG,{at:now(),kind:"supervisor-result",result});
      save("Scientist Supervisor recovery result",{lastSupervisorRequest:command,lastSupervisorResult:result});
      return result;
    }
    await sleep(300);
  }
  const pending={id,ok:false,pending:true,detail:"Supervisor result not observed inside bounded wait; do not bypass the gate"};
  save("Scientist Supervisor recovery pending",{lastSupervisorRequest:command,lastSupervisorResult:pending});
  return pending;
}
async function requestDuplicateCleanup(reason,snapshot){
  const id="sci-"+Date.now()+"-"+crypto.randomBytes(4).toString("hex");
  const command={id,createdAt:now(),source:"SF_SCIENTIST",actions:[{type:"CLEAN_DUPLICATES"}],reason:cleanText(reason||"Scientist duplicate-tab cleanup",600),evidenceEpoch:materialSnapshotKey(snapshot||{})};
  writeJson(SUPERVISOR_COMMAND,command);
  append(OPERATOR_LOG,{at:now(),kind:"supervisor-request",...command});
  const until=Date.now()+SUPERVISOR_RESULT_WAIT_MS;
  while(Date.now()<until){
    const result=readJson(SUPERVISOR_RESULT,null);
    if(result&&result.id===id){
      append(OPERATOR_LOG,{at:now(),kind:"supervisor-result",result});
      save("Scientist Supervisor duplicate cleanup result",{lastSupervisorRequest:command,lastSupervisorResult:result});
      return result;
    }
    await sleep(300);
  }
  return {id,ok:false,pending:true,detail:"Supervisor result pending; no direct cleanup fallback"};
}

async function executeScientistAction(context,chief,text,s){
  const a=parseAction(text);
  let result="no action";
  if(a.kind==="NONE")return result;
  if(a.kind!=="POWERSHELL"){
    append(OPERATOR_LOG,{at:now(),kind:"tool-start",tool:a.kind,arg:cleanText(a.arg||"",2000)});
    save("Scientist tool action started",{
      lastToolKind:a.kind,
      lastToolStatus:"RUNNING",
      lastToolCommand:cleanText(a.arg||"",2000),
      lastToolStartedAt:now(),
      lastToolFinishedAt:null,
      lastToolResult:null
    });
  }
  if(a.kind==="OPEN_POWERSHELL")result=openDetached(POWERSHELL_EXE,["-NoProfile","-NoExit"]);
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
    result=JSON.stringify(await runPowerShell("& git -C 'D:\\ASI\\enchev-auctions' status --short --branch"));
  }else if(a.kind==="POWERSHELL"){
    result=JSON.stringify(await runPowerShell(a.arg));
  }else if(a.kind==="INSPECT_SCREEN"){
    result=await inspectScreen(chief,a.arg,s);
  }else if(a.kind==="CHECK_PROJECT"){
    result=await consultProjectConnectors(chief,a.arg,s);
  }else if(a.kind==="CONSULT_AB"){
    const q=a.arg||("Investigate current DAVID event and decide the best next scientific test.");
    result=await consultAB(context,chief,q,s);
  }else if(a.kind==="DAVID_RECOVER"){
    const m=String(a.arg||"").match(/^(REFRESH|RESTART)\s+(SYSTEM|DESIGN|APP2|APK)\b\s*(.*)$/i);
    if(!m)throw new Error("DAVID_RECOVER syntax: REFRESH|RESTART SYSTEM|DESIGN|APP2|APK [reason]");
    result=JSON.stringify(await requestSupervisorAction(m[1],m[2],m[3]||"Scientist evidence-based recovery",s));
  }else if(a.kind==="DAVID_CLEAN_DUPLICATES"){
    result=JSON.stringify(await requestDuplicateCleanup(a.arg||"Scientist observed duplicate managed tabs",s));
  }else if(a.kind==="DAVID_SUPERVISOR_RESULT"){
    result=JSON.stringify(readJson(SUPERVISOR_RESULT,{status:"no-supervisor-result-yet"}));
  }else{
    result="rejected unsupported action: "+a.kind;
  }
  append(MEMORY,{at:now(),kind:"scientist-tool-action",action:a,result:cleanText(result,5000)});
  append(OPERATOR_LOG,{at:now(),kind:"tool-finish",tool:a.kind,result:cleanText(result,5000)});
  save("Scientist autonomous tool action",{
    lastToolAction:a,
    lastToolKind:a.kind,
    lastToolStatus:String(result||"").startsWith("action failed:")?"FAILED":"DONE",
    lastToolFinishedAt:now(),
    lastToolResult:cleanText(result,5000)
  });
  return result;
}

async function reasonActLoop(context,page,initialPrompt,s,maxSteps=MAX_AUTONOMOUS_STEPS){
  const first=await askFresh(page,initialPrompt,s,"initial Scientist analysis");
  let response=first.response;
  s=first.snapshot;
  const actions=[];

  for(let step=0;step<maxSteps;step++){
    const parsed=parseAction(response);
    if(parsed.kind==="NONE")break;

    const result=await executeScientistAction(context,page,response,s).catch(e=>"action failed: "+String(e&&e.message||e));
    actions.push({step:step+1,action:parsed,result:cleanText(result,5000)});

    const latest=await snapshot();
    const follow=await askFresh(page,
      "SF SCIENTIST TOOL RESULT\\n"+
      "Previous action: "+parsed.kind+" "+cleanText(parsed.arg,1200)+"\\n"+
      "Verified tool result:\\n"+cleanText(result,9000)+"\\n\\n"+
      "Fresh DAVID snapshot:\\n"+JSON.stringify(latest,null,2)+"\\n\\n"+
      "Continue the investigation autonomously only if another low-risk action is useful. "+
      "Do not repeat a failed action without new evidence. Return ВИДЯХ/РЕШИХ/ЗАЩО/ПРЕДЛАГАМ/RISK and exactly one ACTION.",
      latest,
      "Scientist tool-result analysis"
    );

    response=follow.response;
    s=follow.snapshot;
  }

  return {response,actions,snapshot:s};
}


function toolMenu(){
  return [
    "ACTION: NONE",
    "ACTION: POWERSHELL <normal-user PowerShell command>",
    "ACTION: INSPECT_SCREEN <what to inspect visually>",
    "ACTION: CHECK_PROJECT <question for @GitHub @Vercel @Supabase>",
    "ACTION: CONSULT_AB <question>",
    "ACTION: DAVID_HEALTH_CHECK",
    "ACTION: DAVID_RECOVER REFRESH|RESTART SYSTEM|DESIGN|APP2|APK <evidence-based reason>",
    "ACTION: DAVID_CLEAN_DUPLICATES <reason>",
    "ACTION: DAVID_SUPERVISOR_RESULT",
    "ACTION: GIT_STATUS",
    "ACTION: SEARCH_WEB <query>",
    "ACTION: OPEN_URL <https-url>",
    "ACTION: OPEN_POWERSHELL",
    "ACTION: OPEN_CMD",
    "ACTION: OPEN_CHATGPT"
  ].join("\n");
}
function operatorLaw(){
  return "You are running as SF AI Scientist in the normal Chat experience using GPT-5.6 Sol at Medium reasoning, never ChatGPT Work. You are an autonomous SF AI Scientist/Operator. Minimize human intervention, but maximize evidence quality. "+
    "Use tools yourself when a low-risk check can resolve uncertainty. Normal-user PowerShell is available and every command/result is audited. "+
    "Never request or attempt UAC bypass, elevation bypass, credential extraction, destructive disk/file/account/security operations, or production-critical mutation. "+
    "High-risk/admin/destructive actions require a future explicit human approval path and are not available in this tool broker. "+
    "All DAVID lifecycle recovery must use DAVID_RECOVER or DAVID_CLEAN_DUPLICATES so the unified Supervisor can re-check active-work protection; never use PowerShell Stop-Process/taskkill to bypass that gate. "+
    "A real active Stop/generating signal always means WAIT even when text progress is slow. "+
    "Preserve DAVID architecture and distinguish observations from hypotheses.";
}
function boot(s){return "SF CORPORATION / AI SCIENTIST BOOTSTRAP\n\n"+operatorLaw()+
  "\n\nYou are OUTSIDE DAVID. Observe, form hypotheses, test claims against evidence, detect regressions, investigate with your own tools and record what you learn. "+
  "The snapshot includes LIVE TELEMETRY with active PowerShell/CMD/Node processes, DAVID runtime-state summaries, recent log tails and error alerts. "+
  "Recent persistent Scientist memory:\n"+JSON.stringify(recentScientistMemory(),null,2)+
  "\n\nFor this bootstrap only, do not take an action. Answer compactly in Bulgarian:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH\nACTION: NONE"+
  "\n\nCurrent DAVID snapshot:\n"+JSON.stringify(s,null,2);}
function observe(reason,s){return "SF SCIENTIST AUTONOMOUS OBSERVATION\nEVENT: "+reason+
  "\n\n"+operatorLaw()+
  "\n\nInspect liveTelemetry.scientistAudit first, then shells, davidStates, recentLogs, logAlerts and probeErrors before concluding. "+
  "activeNoProgress means investigate and WAIT while the real active response signal remains; it is never permission to interrupt GPT. "+
  "Treat empty telemetry as absence of evidence only when the corresponding probeErrors field is null. "+
  "Distinguish a process start/stop from a real script failure. If useful, investigate autonomously with PowerShell, a desktop screenshot, connected project tools or SCI-A/SCI-B. "+
  "Do not take an action merely to look busy. Prefer the cheapest discriminating check."+
  "\n\nRECENT SCIENTIST MEMORY:\n"+JSON.stringify(recentScientistMemory(),null,2)+
  "\n\nDAVID SNAPSHOT:\n"+JSON.stringify(s,null,2)+
  "\n\nAVAILABLE ACTIONS (choose exactly one; the operator loop may give you another turn after the verified result):\n"+toolMenu()+
  "\n\nReturn:\nВИДЯХ: ...\nРЕШИХ: ...\nЗАЩО: ...\nПРЕДЛАГАМ: ...\nRISK: LOW|MEDIUM|HIGH\nACTION: ...";}
function user(text,s){return "MITKO -> SF AI SCIENTIST\n"+text+
  "\n\n"+operatorLaw()+
  "\n\nYou may investigate the request autonomously for up to "+MAX_AUTONOMOUS_STEPS+" verified tool steps. "+
  "When relevant, cite the exact PID/script, state file, log line, PowerShell output, screen evidence, or connector evidence supporting the conclusion."+
  "\n\nRECENT SCIENTIST MEMORY:\n"+JSON.stringify(recentScientistMemory(),null,2)+
  "\n\nLive DAVID snapshot:\n"+JSON.stringify(s,null,2)+
  "\n\nAVAILABLE ACTIONS:\n"+toolMenu()+
  "\n\nReturn ВИДЯХ/РЕШИХ/ЗАЩО/ПРЕДЛАГАМ/RISK and exactly one ACTION.";}
async function command(context,page,s){
  const c=readJson(COMMAND,null);
  if(!c?.id||c.id===state.lastCommandId||!String(c.text||"").trim())return;
  save("Processing Scientist chat command",{lastCommandId:c.id});
  const loop=await reasonActLoop(context,page,user(String(c.text).trim(),s),s);
  const actionResult=loop.actions.length?JSON.stringify(loop.actions):"no action";
  const summary=compactThought(loop.response);
  const o={id:c.id,createdAt:now(),request:String(c.text).trim(),response:loop.response,summary,actions:loop.actions,actionResult};
  writeJson(RESPONSE,o);
  append(MEMORY,{at:o.createdAt,kind:"mitko-chat",request:o.request,response:loop.response,actionResult});
  save("Scientist chat complete",{
    lastResponse:loop.response,
    lastThoughtSummary:summary,
    thoughtSummary:summary,
    lastToolResult:cleanText(actionResult,5000)
  });
}
async function main(){
  save("Connecting to Scientist Edge",{status:"starting",scientistCdp:SCI_CDP,davidCdp:DAVID_CDP});
  const browser=await chromium.connectOverCDP(SCI_CDP,{timeout:30000}),contexts=browser.contexts();if(!contexts.length)throw new Error("Scientist Edge has no browser context");
  const context=contexts[0];let page=await pageFor(context),prev=null,booted=false;
  let pendingEvent=null;
  let pendingStartedAt=0;
  let lastMaterialChangeAt=0;
  let lastSessionAnalysisAt=0;
  while(true){
    try{
      if(!page||page.isClosed())page=await pageFor(context);
      const s=await snapshot();
      await safeDismissChatGptUi(page).catch(()=>null);
      save("Scientist heartbeat",{
        status:state.status==="rate-limited"?"rate-limited":(state.loginRequired?"login-required":"online"),
        liveSnapshot:s,
        currentMode:s.mode,
        currentCdp9444Online:s.cdp9444Online
      });
      if(!booted&&!state.loginRequired){
        const bootResult=await askFresh(page,boot(s),s,"Scientist bootstrap");
        const r=bootResult.response;
        append(DECISIONS,{type:"bootstrap",at:now(),snapshot:bootResult.snapshot,response:r});
        save("Scientist bootstrap complete",{
          bootstrappedAt:now(),
          lastDecision:r,
          lastObservation:"Scientist attached",
          lastThoughtSummary:compactThought(r),
          thoughtSummary:compactThought(r),
          staleResponseSuppressed:false,
          responseContextStale:false
        });
        booted=true;
        lastSessionAnalysisAt=Date.now();
      }
      await command(context,page,s);
      const e=event(prev,s);
      if(e.important){
        const nowMs=Date.now();
        if(!pendingEvent){
          pendingEvent={reasons:[e.reason],queuedAt:now()};
          pendingStartedAt=nowMs;
        }else if(!pendingEvent.reasons.includes(e.reason)){
          pendingEvent.reasons.push(e.reason);
        }
        lastMaterialChangeAt=nowMs;
        save("Scientist waiting for stable live telemetry",{
          lastObservation:e.reason,
          pendingObservation:true,
          pendingObservationReasons:pendingEvent.reasons,
          pendingObservationAgeMs:nowMs-pendingStartedAt
        });
      }
      const nowMs=Date.now();
      const quietSettled=Boolean(pendingEvent)&&nowMs-lastMaterialChangeAt>=SETTLE_MS;
      const burstExpired=Boolean(pendingEvent)&&nowMs-pendingStartedAt>=MAX_EVENT_BURST_MS;
      const settled=quietSettled||burstExpired;
      const cooldownReady=nowMs-lastSessionAnalysisAt>=AUTO_MIN;
      if(booted&&settled&&cooldownReady){
        const latest=await snapshot();
        const reason=(pendingEvent.reasons||[]).join(" | ")+(burstExpired?" (max burst snapshot)":" (stable snapshot after event burst)");

        pendingEvent=null;
        pendingStartedAt=0;
        save("Autonomous Scientist analysis in flight",{
          status:"sending",
          pendingObservation:false,
          pendingObservationReasons:[],
          inFlightObservation:reason,
          inFlightStartedAt:now()
        });

        let loop;
        try{
          loop=await reasonActLoop(context,page,observe(reason,latest),latest);
        }catch(e){
          save("Autonomous Scientist analysis failed",{
            status:"degraded",
            inFlightObservation:null,
            inFlightStartedAt:null,
            lastError:String(e&&e.stack||e)
          });
          throw e;
        }

        const actionResult=loop.actions.length?JSON.stringify(loop.actions):"no action";
        append(DECISIONS,{type:"autonomous-decision",at:now(),event:reason,snapshot:latest,response:loop.response,actions:loop.actions,actionResult});
        append(MEMORY,{at:now(),kind:"observed-system-event",event:reason,response:loop.response,actionResult});
        const analysisAt=Date.now();
        save("Autonomous Scientist decision recorded",{
          lastObservation:reason,
          lastDecision:loop.response,
          lastThoughtSummary:compactThought(loop.response),
          thoughtSummary:compactThought(loop.response),
          lastAutoAnalysisAt:now(),
          lastToolResult:cleanText(actionResult,5000),
          pendingObservation:false,
          pendingObservationReasons:[],
          inFlightObservation:null,
          inFlightStartedAt:null,
          staleResponseSuppressed:false,
          responseContextStale:false
        });
        lastSessionAnalysisAt=analysisAt;
      }
      prev=s;
    }catch(err){save("Scientist loop error",{status:"degraded",lastError:String(err?.stack||err)});}
    await sleep(POLL);
  }
}
process.on("unhandledRejection",e=>save("Unhandled rejection",{status:"degraded",lastError:String(e?.stack||e)}));
process.on("uncaughtException",e=>{save("Uncaught exception",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
main().catch(e=>{save("Scientist fatal",{status:"offline",lastError:String(e?.stack||e)});process.exit(1);});
