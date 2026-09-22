import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const HERE=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,"$1"));
const MANIFEST=path.join(HERE,".david-control-panel-tasks.json");
const COMMAND=path.join(HERE,".david-control-panel-command.json");
const MONITOR=path.join(HERE,".david-tab-monitor.json");
const PREVIEW_DIR=path.join(HERE,".david-control-panel-previews");
const DAVID_CDP=process.env.DAVID_CDP_URL||"http://127.0.0.1:9444";
const SCIENTIST_CDP=process.env.SF_SCIENTIST_CDP_URL||"http://127.0.0.1:9555";
const REFRESH_MS=Math.max(1500,Number(process.env.DAVID_CONTROL_PANEL_PREVIEW_MS||3000));
const MAX_TASKS=Math.max(2,Math.min(12,Number(process.env.DAVID_CONTROL_PANEL_MAX_TASKS||8)));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toISOString();
const clean=v=>String(v||"").replace(/\s+/g," ").trim().slice(0,500);
const safe=v=>String(v||"task").replace(/[^a-z0-9_-]+/ig,"_").slice(0,80);
function readJson(p,f=null){try{return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));}catch{return f;}}
function writeJson(p,v){const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(v,null,2),"utf8");fs.renameSync(t,p);}
function conversationUrl(u){const m=String(u||"").match(/^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+/i);return m?m[0]:String(u||"");}
function ensureDir(){fs.mkdirSync(PREVIEW_DIR,{recursive:true});}

let davidBrowser=null,scientistBrowser=null,lastCommandId=null;

async function connect(url,current){
  if(current){
    try{if(current.isConnected())return current;}catch{}
    try{await current.close();}catch{}
  }
  try{return await chromium.connectOverCDP(url,{timeout:4000});}catch{return null;}
}

function roleForDavid(url,monitor,index){
  const u=conversationUrl(url);
  const managed=monitor&&monitor.managed||{};
  for(const [role,urls] of Object.entries(managed)){
    if(!Array.isArray(urls))continue;
    if(urls.some(x=>conversationUrl(x)===u))return role;
  }
  return "DAVID_TAB_"+(index+1);
}

async function pageStatus(page){
  try{
    const stop=page.locator('[data-testid="stop-button"],[data-testid*="stop" i],button[aria-label*="Stop"]').last();
    if(await stop.count().catch(()=>0) && await stop.isVisible().catch(()=>false))return "THINKING";
  }catch{}
  return "READY";
}

async function collect(browser,source,monitor){
  if(!browser)return [];
  const out=[];
  let idx=0;
  for(const context of browser.contexts()){
    for(const page of context.pages()){
      if(!page||page.isClosed())continue;
      const url=page.url();
      if(!/^https:\/\/chatgpt\.com\//i.test(url))continue;
      const role=source==="DAVID"?roleForDavid(url,monitor,idx):(idx===0?"SCIENTIST":"SCIENTIST_"+(idx+1));
      const key=source+":"+role+":"+idx;
      const preview=path.join(PREVIEW_DIR,safe(key)+".png");
      let title="";
      try{title=clean(await page.title());}catch{}
      const status=await pageStatus(page);
      let screenshotOk=false;
      try{
        await page.screenshot({path:preview,type:"png",timeout:6000,animations:"disabled"});
        screenshotOk=true;
      }catch{}
      out.push({
        key,source,role,cdp:source==="DAVID"?9444:9555,
        title:title||role,url:conversationUrl(url),status,
        preview:screenshotOk?preview:null,updatedAt:now()
      });
      idx++;
      if(out.length>=MAX_TASKS)return out;
    }
  }
  return out;
}

async function processCommand(tasks){
  const cmd=readJson(COMMAND,null);
  if(!cmd||!cmd.id||cmd.id===lastCommandId)return;
  lastCommandId=cmd.id;
  const target=tasks.find(x=>x.key===cmd.taskKey);
  const result={id:cmd.id,at:now(),ok:false,action:cmd.action||null,taskKey:cmd.taskKey||null};
  if(cmd.action==="FOCUS"&&target){
    const browser=target.source==="DAVID"?davidBrowser:scientistBrowser;
    try{
      for(const context of browser?.contexts?.()||[]){
        for(const page of context.pages()){
          if(page.isClosed())continue;
          if(conversationUrl(page.url())===target.url){
            await page.bringToFront();
            result.ok=true;
            result.message="focused";
            break;
          }
        }
        if(result.ok)break;
      }
    }catch(e){result.error=String(e?.message||e);}
  }else if(!target){
    result.error="task-not-found";
  }else{
    result.error="unsupported-action";
  }
  writeJson(path.join(HERE,".david-control-panel-command-result.json"),result);
}

async function cycle(){
  ensureDir();
  davidBrowser=await connect(DAVID_CDP,davidBrowser);
  scientistBrowser=await connect(SCIENTIST_CDP,scientistBrowser);
  const monitor=readJson(MONITOR,null);
  const [david,scientist]=await Promise.all([
    collect(davidBrowser,"DAVID",monitor),
    collect(scientistBrowser,"SCIENTIST",monitor)
  ]);
  const tasks=[...david,...scientist].slice(0,MAX_TASKS);
  writeJson(MANIFEST,{
    version:1,updatedAt:now(),
    davidCdpOnline:Boolean(davidBrowser),
    scientistCdpOnline:Boolean(scientistBrowser),
    tasks
  });
  await processCommand(tasks);
}

async function main(){
  ensureDir();
  while(true){
    try{await cycle();}catch(e){
      writeJson(MANIFEST,{version:1,updatedAt:now(),error:String(e?.stack||e),tasks:[]});
    }
    await sleep(REFRESH_MS);
  }
}

process.on("SIGINT",async()=>{try{await davidBrowser?.close();}catch{};try{await scientistBrowser?.close();}catch{};process.exit(0);});
process.on("SIGTERM",async()=>{try{await davidBrowser?.close();}catch{};try{await scientistBrowser?.close();}catch{};process.exit(0);});
main().catch(e=>{writeJson(MANIFEST,{version:1,updatedAt:now(),error:String(e?.stack||e),tasks:[]});process.exit(1);});
