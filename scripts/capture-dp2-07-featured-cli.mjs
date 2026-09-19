import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const baseUrl=process.argv[2]||"http://127.0.0.1:3011";
const outputDir=process.argv[3]||"artifacts/dp2-07-featured";
const widths=[360,390,430,1366,1440,1920];
const heights={360:1100,390:1100,430:1100,1366:1200,1440:1200,1920:1200};

function fail(message){ throw new Error("DP2_07_FEATURED_VISUAL FAIL: "+message); }
function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
function findBrowser(){
  const candidates=[process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean);
  for(const candidate of candidates){
    if(candidate.startsWith("/")&&fs.existsSync(candidate))return candidate;
    const probe=spawnSync("which",[candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  fail("browser executable not found");
}
async function waitForDevTools(port,browser,stderrRef){
  for(let attempt=0;attempt<100;attempt++){
    if(browser.exitCode!==null)fail("browser exited before DevTools ready: "+stderrRef.value.slice(-1200));
    try{
      const response=await fetch("http://127.0.0.1:"+port+"/json/version");
      if(response.ok)return;
    }catch{}
    await sleep(100);
  }
  fail("DevTools endpoint did not become ready");
}
async function openTarget(port){
  const response=await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"});
  if(!response.ok)fail("cannot open browser target HTTP "+response.status);
  const target=await response.json();
  if(!target.webSocketDebuggerUrl)fail("browser target has no websocket URL");
  return target;
}
async function closeTarget(port,id){
  try{ await fetch("http://127.0.0.1:"+port+"/json/close/"+id); }catch{}
}
async function createClient(wsUrl){
  const ws=new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("websocket open timeout")),5000);
    ws.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("websocket error"));},{once:true});
  });
  let nextId=1;
  const pending=new Map();
  ws.addEventListener("message",event=>{
    const message=JSON.parse(String(event.data));
    const waiter=pending.get(message.id);
    if(!waiter)return;
    pending.delete(message.id);
    if(message.error)waiter.reject(new Error(waiter.method+": "+message.error.message));
    else waiter.resolve(message.result||{});
  });
  function call(method,params={}){
    const id=nextId++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+" timed out"));},15000);
      pending.set(id,{method,resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  return {ws,call};
}
async function waitForFeatured(call){
  for(let attempt=0;attempt<100;attempt++){
    const state=await call("Runtime.evaluate",{
      expression:"document.readyState==='complete' && document.querySelectorAll('.eaFeaturedV2Card[data-auction-state]').length===4",
      returnByValue:true,
    });
    if(state?.result?.value===true)break;
    if(attempt===99)fail("featured DOM did not become ready");
    await sleep(100);
  }
  await call("Runtime.evaluate",{
    awaitPromise:true,
    expression:"(async()=>{if(document.fonts?.ready){try{await document.fonts.ready}catch{}};await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,2500)})));const section=document.querySelector('.eaFeaturedV2Section');if(!section)throw new Error('featured section missing before scroll');section.scrollIntoView({block:'start',inline:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()",
    returnByValue:true,
  });
}
function validatePng(buffer,width,height){
  if(buffer.length<1000||buffer[0]!==0x89||buffer[1]!==0x50||buffer[2]!==0x4e||buffer[3]!==0x47)fail("invalid PNG "+width+"px");
  const actualWidth=buffer.readUInt32BE(16);
  const actualHeight=buffer.readUInt32BE(20);
  if(actualWidth!==width||actualHeight!==height)fail("PNG dimensions mismatch requested="+width+"x"+height+" actual="+actualWidth+"x"+actualHeight);
}

const browserExecutable=findBrowser();
const port=9237;
const profileDir=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-dp2-07-"));
const stderrRef={value:""};
fs.mkdirSync(outputDir,{recursive:true});
const browser=spawn(browserExecutable,[
  "--headless=new","--disable-gpu","--disable-dev-shm-usage","--no-sandbox","--hide-scrollbars",
  "--force-device-scale-factor=1","--remote-debugging-address=127.0.0.1","--remote-debugging-port="+port,
  "--user-data-dir="+profileDir,"--window-size=1920,1200","about:blank",
],{stdio:["ignore","ignore","pipe"]});
browser.stderr.setEncoding("utf8");
browser.stderr.on("data",chunk=>{stderrRef.value+=chunk;});

const entries=[];
try{
  await waitForDevTools(port,browser,stderrRef);
  for(const width of widths){
    const height=heights[width];
    const target=await openTarget(port);
    const {ws,call}=await createClient(target.webSocketDebuggerUrl);
    try{
      await call("Page.enable");
      await call("Runtime.enable");
      await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=430,screenWidth:width,screenHeight:height});
      const navigation=await call("Page.navigate",{url:new URL("/",baseUrl).toString()});
      if(navigation.errorText)fail("navigation failed "+navigation.errorText);
      await waitForFeatured(call);
      const runtime=await call("Runtime.evaluate",{
        expression:"(()=>{const cards=[...document.querySelectorAll('.eaFeaturedV2Card[data-auction-state]')];const section=document.querySelector('.eaFeaturedV2Section');if(!section)return null;const shell=document.querySelector('.eaAppShell');const sr=section.getBoundingClientRect();const shellBottom=shell?.getBoundingClientRect().bottom||0;return {scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,scrollY,sectionTop:sr.top,sectionBottom:sr.bottom,shellBottom,states:cards.map(c=>c.getAttribute('data-auction-state')),visible:cards.map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})}})()",
        returnByValue:true,
      });
      const snapshot=runtime?.result?.value;
      if(!snapshot||snapshot.scrollWidth>snapshot.viewportWidth+3)fail("responsive overflow width="+width);
      if(snapshot.states.join(",")!=="upcoming,buy-now,live,sold")fail("auction state order mismatch width="+width);
      const anchorCeiling=Math.max(4,(snapshot.shellBottom||0)+4);\n      if(snapshot.sectionTop<-4||snapshot.sectionTop>anchorCeiling)fail("featured section did not anchor near viewport top width="+width+" top="+snapshot.sectionTop+" shellBottom="+snapshot.shellBottom+" scrollY="+snapshot.scrollY);\n      if(snapshot.sectionBottom<=anchorCeiling)fail("featured section is not visible after anchor width="+width);
      for(const card of snapshot.visible){
        if(card.left<-3||card.right>width+3)fail("card escapes viewport width="+width);
      }
      const shot=await call("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
      if(!shot.data)fail("browser returned no PNG width="+width);
      const png=Buffer.from(shot.data,"base64");
      validatePng(png,width,height);
      const filename="home-featured--"+width+".png";
      fs.writeFileSync(path.resolve(outputDir,filename),png);
      entries.push({width,height,file:filename,bytes:png.length,states:snapshot.states});
    }finally{
      try{ws.close()}catch{}
      await closeTarget(port,target.id);
    }
  }
  fs.writeFileSync(path.join(outputDir,"manifest.json"),JSON.stringify({version:2,browserExecutable,baseUrl,count:entries.length,entries},null,2)+"\n");
  console.log("DP2_07_FEATURED_VISUAL PASS browser="+browserExecutable+" screenshots="+entries.length+" widths="+widths.join(","));
}finally{
  if(browser.exitCode===null)browser.kill("SIGTERM");
  await sleep(120);
  try{fs.rmSync(profileDir,{recursive:true,force:true})}catch{}
}
