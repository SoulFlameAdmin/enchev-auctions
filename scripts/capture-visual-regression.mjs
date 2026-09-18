import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const ROUTES=[
  {name:"home",path:"/",ready:"document.querySelector('.eaHero') && document.querySelector('.eaFeaturedCard')"},
  {name:"inventory",path:"/inventory",ready:"document.querySelector('.inventoryPage') && !document.querySelector('.inv18RouteState') && document.querySelectorAll('.inventoryCard').length >= 1 && getComputedStyle(document.querySelector('.inventoryGrid')).display === 'grid' && getComputedStyle(document.querySelector('.inventoryCard')).borderRadius !== '0px'"},
  {name:"lot-ea-10539",path:"/lot/EA-10539",ready:"document.querySelector('.lotPage') && document.querySelector('.lotMainImage img')"},
  {name:"live-auctions",path:"/live-auctions",ready:"document.querySelector('.liveStage') && document.querySelector('.liveBidPanel')"},
  {name:"profile",path:"/profile",ready:"document.querySelector('.profileDashboardShell') && document.querySelector('.profileOverview')"},
];

const VIEWPORTS=[
  {name:"desktop",width:1440,height:1200,mobile:false},
  {name:"mobile",width:390,height:844,mobile:true},
];

function fail(message){
  throw new Error(`VISUAL_REGRESSION_CAPTURE FAIL: ${message}`);
}

export function validateMatrix(routes=ROUTES,viewports=VIEWPORTS){
  if(routes.length!==5)fail(`expected 5 routes, got ${routes.length}`);
  if(viewports.length!==2)fail(`expected 2 viewports, got ${viewports.length}`);
  const routeNames=new Set(routes.map(route=>route.name));
  const paths=new Set(routes.map(route=>route.path));
  if(routeNames.size!==routes.length)fail("route names must be unique");
  if(paths.size!==routes.length)fail("route paths must be unique");
  if(!paths.has("/")||!paths.has("/inventory")||!paths.has("/lot/EA-10539")||!paths.has("/live-auctions")||!paths.has("/profile"))fail("core route matrix incomplete");
  for(const viewport of viewports){
    if(!Number.isInteger(viewport.width)||!Number.isInteger(viewport.height)||viewport.width<320||viewport.height<600)fail(`invalid viewport ${viewport.name}`);
  }
  if(!viewports.some(v=>v.name==="desktop"&&v.width>=1280))fail("desktop viewport missing");
  if(!viewports.some(v=>v.name==="mobile"&&v.width<=430))fail("mobile viewport missing");
  return true;
}


export function validateD23Runtime(snapshot,viewport){
  if(!snapshot||!viewport)fail("D23 runtime snapshot missing");
  const tolerance=2;
  if(snapshot.scrollWidth>snapshot.viewportWidth+tolerance)fail(`D23 ${viewport.name} horizontal overflow: ${snapshot.scrollWidth} > ${snapshot.viewportWidth}`);

  if(viewport.mobile){
    if(snapshot.panelPosition!=="relative")fail(`D23 mobile bid panel must be relative, got ${snapshot.panelPosition}`);
    if(snapshot.dockPosition!=="fixed"||snapshot.dockDisplay==="none")fail(`D23 mobile dock must be fixed and visible, got ${snapshot.dockPosition}/${snapshot.dockDisplay}`);
    if(snapshot.dock.left<-tolerance||snapshot.dock.right>snapshot.viewportWidth+tolerance)fail("D23 mobile dock escapes viewport horizontally");
    if(snapshot.dock.top<0||snapshot.dock.bottom>snapshot.viewportHeight+tolerance)fail("D23 mobile dock escapes viewport vertically");
    if(snapshot.pagePaddingBottom+1<snapshot.dock.height)fail(`D23 mobile page padding ${snapshot.pagePaddingBottom}px is smaller than dock height ${snapshot.dock.height}px`);
    if(snapshot.contentBottomAtPageEnd>snapshot.dock.top+tolerance)fail(`D23 mobile dock overlaps final lot content: contentBottom=${snapshot.contentBottomAtPageEnd}, dockTop=${snapshot.dock.top}`);
    if(snapshot.focusedId!=="lot-bid-input")fail(`D23 mobile action did not focus bid input, active=${snapshot.focusedId||"none"}`);
    if(snapshot.focusedInputBottom>snapshot.dock.top+tolerance)fail(`D23 focused bid input is hidden behind dock: inputBottom=${snapshot.focusedInputBottom}, dockTop=${snapshot.dock.top}`);
  }else{
    if(snapshot.panelPosition!=="sticky")fail(`D23 desktop bid panel must be sticky, got ${snapshot.panelPosition}`);
    if(snapshot.dockDisplay!=="none")fail(`D23 desktop mobile dock must be hidden, got ${snapshot.dockDisplay}`);
    if(snapshot.panel.top<snapshot.headerBottom-tolerance)fail(`D23 desktop sticky panel overlaps header: panelTop=${snapshot.panel.top}, headerBottom=${snapshot.headerBottom}`);
    if(snapshot.panel.bottom>snapshot.viewportHeight+tolerance)fail(`D23 desktop sticky panel escapes viewport: panelBottom=${snapshot.panel.bottom}, viewport=${snapshot.viewportHeight}`);
    if(snapshot.panel.left<-tolerance||snapshot.panel.right>snapshot.viewportWidth+tolerance)fail("D23 desktop sticky panel escapes viewport horizontally");
  }
  return true;
}

async function d23Snapshot(call){
  const expression=`(()=>{const panel=document.querySelector('#lot-bid-panel');const dock=document.querySelector('.lotMobileBidDock');const page=document.querySelector('.lotPage');const wrap=document.querySelector('.lotWrap');const header=document.querySelector('.lotHeader');if(!panel||!dock||!page||!wrap) return null;const pr=panel.getBoundingClientRect();const dr=dock.getBoundingClientRect();const hr=header?.getBoundingClientRect();return {viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,scrollWidth:document.documentElement.scrollWidth,panelPosition:getComputedStyle(panel).position,dockPosition:getComputedStyle(dock).position,dockDisplay:getComputedStyle(dock).display,pagePaddingBottom:parseFloat(getComputedStyle(page).paddingBottom)||0,panel:{top:pr.top,bottom:pr.bottom,left:pr.left,right:pr.right,height:pr.height},dock:{top:dr.top,bottom:dr.bottom,left:dr.left,right:dr.right,height:dr.height},headerBottom:hr?.bottom||0,contentBottomAtPageEnd:wrap.getBoundingClientRect().bottom,focusedId:document.activeElement?.id||"",focusedInputBottom:document.querySelector('#lot-bid-input')?.getBoundingClientRect().bottom??Infinity};})()`;
  const result=await call("Runtime.evaluate",{expression,returnByValue:true});
  return result?.result?.value;
}

async function verifyD23StickyActions(call,viewport){
  if(viewport.mobile){
    await call("Runtime.evaluate",{expression:"document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.documentElement.scrollHeight)"});
    await sleep(180);
    const endSnapshot=await d23Snapshot(call);
    if(!endSnapshot)fail("D23 mobile runtime elements missing");

    await call("Runtime.evaluate",{expression:"document.querySelector('.lotMobileBidAction')?.click()"});
    await sleep(520);
    const actionSnapshot=await d23Snapshot(call);
    if(!actionSnapshot)fail("D23 mobile action snapshot missing");
    actionSnapshot.contentBottomAtPageEnd=endSnapshot.contentBottomAtPageEnd;
    validateD23Runtime(actionSnapshot,viewport);
  }else{
    await call("Runtime.evaluate",{expression:"window.scrollTo(0,900)"});
    await sleep(120);
    const snapshot=await d23Snapshot(call);
    if(!snapshot)fail("D23 desktop runtime elements missing");
    validateD23Runtime(snapshot,viewport);
  }

  await call("Runtime.evaluate",{expression:"document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);document.documentElement.style.scrollBehavior=''"});
  await sleep(80);
}


export function validateD24Runtime(snapshot,viewport){
  if(!snapshot||!viewport)fail("D24 runtime snapshot missing");
  const tolerance=3;
  if(snapshot.scrollWidth>snapshot.viewportWidth+tolerance)fail(`D24 ${viewport.name} horizontal overflow: ${snapshot.scrollWidth} > ${snapshot.viewportWidth}`);
  if(snapshot.stageDisplay!=="grid")fail(`D24 stage must remain grid, got ${snapshot.stageDisplay}`);
  if(snapshot.visual.width<120||snapshot.visual.height<180)fail("D24 current-lot visual is not meaningfully visible");
  if(snapshot.panel.width<120||snapshot.panel.height<180)fail("D24 bid/next panel is not meaningfully visible");
  if(snapshot.next.width<120||snapshot.next.height<70)fail("D24 next-lot preview is not meaningfully visible");
  if(!snapshot.currentLot||!snapshot.nextLot||snapshot.currentLot===snapshot.nextLot)fail(`D24 current/next lots must be distinct: ${snapshot.currentLot||"missing"} / ${snapshot.nextLot||"missing"}`);
  if(snapshot.nextHref!==`/lot/${snapshot.nextLot}`)fail(`D24 next-lot link mismatch: href=${snapshot.nextHref} next=${snapshot.nextLot}`);
  if(snapshot.focusedClass!=="liveNextPreviewCard")fail(`D24 next-lot card did not accept keyboard focus: ${snapshot.focusedClass||"none"}`);
  if(snapshot.next.left<snapshot.panel.left-tolerance||snapshot.next.right>snapshot.panel.right+tolerance)fail("D24 next-lot preview escapes bid panel horizontally");

  if(viewport.mobile){
    if(snapshot.panel.top<snapshot.visual.bottom-tolerance)fail(`D24 mobile panel must stack below current lot: panelTop=${snapshot.panel.top}, visualBottom=${snapshot.visual.bottom}`);
    if(snapshot.visual.left<-tolerance||snapshot.visual.right>snapshot.viewportWidth+tolerance)fail("D24 mobile current lot escapes viewport horizontally");
    if(snapshot.panel.left<-tolerance||snapshot.panel.right>snapshot.viewportWidth+tolerance)fail("D24 mobile bid/next panel escapes viewport horizontally");
  }else{
    if(snapshot.visual.right>snapshot.panel.left+tolerance)fail(`D24 desktop current/next columns overlap: visualRight=${snapshot.visual.right}, panelLeft=${snapshot.panel.left}`);
    if(snapshot.panel.right>snapshot.viewportWidth+tolerance)fail("D24 desktop bid/next panel escapes viewport horizontally");
  }
  return true;
}

async function d24Snapshot(call){
  const result=await call("Runtime.evaluate",{
    expression:`(()=>{const stage=document.querySelector('.liveStage[data-design-task="D24"]');const visual=stage?.querySelector('[data-live-slot="current"]');const panel=stage?.querySelector('.liveBidPanel');const next=stage?.querySelector('[data-live-slot="next"]');const nextLink=next?.querySelector('.liveNextPreviewCard');if(!stage||!visual||!panel||!next||!nextLink)return null;nextLink.focus({preventScroll:true});const vr=visual.getBoundingClientRect();const pr=panel.getBoundingClientRect();const nr=next.getBoundingClientRect();return {viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,scrollWidth:document.documentElement.scrollWidth,stageDisplay:getComputedStyle(stage).display,visual:{top:vr.top,bottom:vr.bottom,left:vr.left,right:vr.right,width:vr.width,height:vr.height},panel:{top:pr.top,bottom:pr.bottom,left:pr.left,right:pr.right,width:pr.width,height:pr.height},next:{top:nr.top,bottom:nr.bottom,left:nr.left,right:nr.right,width:nr.width,height:nr.height},currentLot:visual.getAttribute('data-lot-id')||"",nextLot:next.getAttribute('data-lot-id')||"",nextHref:nextLink.getAttribute('href')||"",focusedClass:document.activeElement?.className||""};})()`,
    returnByValue:true,
  });
  return result?.result?.value;
}

async function verifyD24LiveRoom(call,viewport){
  const snapshot=await d24Snapshot(call);
  if(!snapshot)fail("D24 live-room runtime elements missing");
  validateD24Runtime(snapshot,viewport);
  await call("Runtime.evaluate",{expression:"document.activeElement?.blur();window.scrollTo(0,0)"});
  await sleep(80);
}

async function d29Snapshot(call,focusFirstRemove=false){
  const result=await call("Runtime.evaluate",{
    expression:`(()=>{const section=document.querySelector('.profileWatchlist[data-design-task="D29"]');const summary=section?.querySelector('.profileWatchlistSummary');const grid=section?.querySelector('.profileWatchlistGrid');const cards=[...(section?.querySelectorAll('.profileWatchlistCard')||[])];const first=cards[0];const remove=first?.querySelector('.profileWatchlistRemove');if(!section||!summary||!grid||!first||!remove)return null;if(${focusFirstRemove?"true":"false"})remove.focus({preventScroll:true});const sr=section.getBoundingClientRect();const rr=remove.getBoundingClientRect();const rects=cards.map(card=>card.getBoundingClientRect());return {viewportWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,gridColumns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length,cardCount:cards.length,savedCount:Number(summary.getAttribute('data-saved-count')||-1),liveCount:Number(summary.getAttribute('data-live-count')||-1),states:cards.map(card=>card.getAttribute('data-auction-state')||""),lotIds:cards.map(card=>card.getAttribute('data-lot-id')||""),focusedClass:document.activeElement?.className||"",removeWidth:rr.width,removeHeight:rr.height,cardsContained:rects.every(rect=>rect.left>=sr.left-3&&rect.right<=sr.right+3)};})()`,
    returnByValue:true,
  });
  return result?.result?.value;
}

async function verifyD29Watchlist(call,viewport){
  const before=await d29Snapshot(call,true);
  if(!before)fail("D29 watchlist runtime elements missing");
  if(before.scrollWidth>before.viewportWidth+3)fail(`D29 ${viewport.name} horizontal overflow`);
  if(before.cardCount!==3||before.savedCount!==3||before.liveCount!==1)fail(`D29 ${viewport.name} initial counts mismatch`);
  for(const state of ["live","upcoming","buy-now"]){
    if(!before.states.includes(state))fail(`D29 ${viewport.name} missing state ${state}`);
  }
  if(before.lotIds.some(id=>id.length!==8||!id.startsWith("EA-")))fail(`D29 ${viewport.name} semantic lot id missing`);
  if(!before.cardsContained)fail(`D29 ${viewport.name} card escapes watchlist bounds`);
  if(before.focusedClass!=="profileWatchlistRemove")fail(`D29 ${viewport.name} remove control did not accept focus`);
  if(viewport.mobile){
    if(before.gridColumns!==1)fail(`D29 mobile grid columns=${before.gridColumns}`);
    if(before.removeWidth+1<44||before.removeHeight+1<44)fail(`D29 mobile remove target ${before.removeWidth}x${before.removeHeight}`);
  }else if(before.gridColumns!==3){
    fail(`D29 desktop grid columns=${before.gridColumns}`);
  }

  await call("Runtime.evaluate",{expression:"document.querySelector('.profileWatchlistCard .profileWatchlistRemove')?.click()"});
  await sleep(140);
  const after=await d29Snapshot(call,false);
  if(!after)fail("D29 post-remove snapshot missing");
  if(after.cardCount!==2||after.savedCount!==2||after.liveCount!==0)fail(`D29 ${viewport.name} remove interaction did not update counts`);
  if(after.lotIds.includes(before.lotIds[0]))fail(`D29 ${viewport.name} removed lot is still present`);
}

function findChrome(){
  const candidates=[
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for(const candidate of candidates){
    if(candidate.startsWith("/")&&fs.existsSync(candidate))return candidate;
    const probe=spawnSync("which",[candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  fail("Chrome/Chromium executable not found");
}

function sha256(file){
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function waitForDevTools(port,browser,stderrRef){
  for(let attempt=0;attempt<100;attempt++){
    if(browser.exitCode!==null){
      fail(`Chrome exited before DevTools became ready: ${stderrRef.value.slice(-3000)}`);
    }
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/version`);
      if(response.ok)return response.json();
    }catch{}
    await sleep(100);
  }
  fail(`Chrome DevTools endpoint did not become ready: ${stderrRef.value.slice(-3000)}`);
}

async function openTarget(port){
  const response=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:"PUT"});
  if(!response.ok)fail(`cannot open Chrome target: HTTP ${response.status}`);
  const target=await response.json();
  if(!target.webSocketDebuggerUrl)fail("Chrome target has no debugger URL");
  return target;
}

async function closeTarget(port,targetId){
  try{
    await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`);
  }catch{}
}

async function createCdpClient(wsUrl){
  const ws=new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("CDP websocket open timeout")),5000);
    ws.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("CDP websocket error"));},{once:true});
  });

  let nextId=1;
  const pending=new Map();

  ws.addEventListener("message",event=>{
    const message=JSON.parse(String(event.data));
    if(!message.id)return;
    const waiter=pending.get(message.id);
    if(!waiter)return;
    pending.delete(message.id);
    if(message.error)waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
    else waiter.resolve(message.result||{});
  });

  function call(method,params={}){
    const id=nextId++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      },15000);
      pending.set(id,{
        method,
        resolve:value=>{clearTimeout(timer);resolve(value);},
        reject:error=>{clearTimeout(timer);reject(error);},
      });
      ws.send(JSON.stringify({id,method,params}));
    });
  }

  return {ws,call};
}

async function settlePage(call,route){
  for(let attempt=0;attempt<80;attempt++){
    const state=await call("Runtime.evaluate",{expression:"document.readyState",returnByValue:true});
    if(state?.result?.value==="complete")break;
    await sleep(100);
  }

  for(let attempt=0;attempt<100;attempt++){
    const ready=await call("Runtime.evaluate",{
      expression:`Boolean(${route.ready})`,
      returnByValue:true,
    });
    if(ready?.result?.value===true)break;
    if(attempt===99)fail(`${route.name} did not reach stable visual DOM`);
    await sleep(100);
  }

  await call("Runtime.evaluate",{
    awaitPromise:true,
    expression:`(async()=>{
      if(document.fonts?.ready){try{await document.fonts.ready;}catch{}}
      const pending=[...document.images].filter(img=>!img.complete);
      await Promise.all(pending.map(img=>new Promise(resolve=>{
        const done=()=>resolve();
        img.addEventListener("load",done,{once:true});
        img.addEventListener("error",done,{once:true});
        setTimeout(done,2500);
      })));
      const style=document.createElement("style");
      style.setAttribute("data-visual-regression","true");
      style.textContent="*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}";
      document.head.appendChild(style);
      window.scrollTo(0,0);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {ready:document.readyState,images:document.images.length,title:document.title};
    })()`,
    returnByValue:true,
  });
}

async function captureOne({port,baseUrl,route,viewport,outputDir}){
  const target=await openTarget(port);
  const {ws,call}=await createCdpClient(target.webSocketDebuggerUrl);

  try{
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride",{
      width:viewport.width,
      height:viewport.height,
      deviceScaleFactor:1,
      mobile:viewport.mobile,
      screenWidth:viewport.width,
      screenHeight:viewport.height,
    });
    await call("Emulation.setTouchEmulationEnabled",{
      enabled:viewport.mobile,
      maxTouchPoints:viewport.mobile?5:1,
    });

    const url=new URL(route.path,baseUrl).toString();
    const navigation=await call("Page.navigate",{url});
    if(navigation.errorText)fail(`${route.name} navigation failed: ${navigation.errorText}`);

    await settlePage(call,route);

    if(route.name==="lot-ea-10539"){
      await verifyD23StickyActions(call,viewport);
    }
    if(route.name==="live-auctions"){
      await verifyD24LiveRoom(call,viewport);
    }

    const result=await call("Page.captureScreenshot",{
      format:"png",
      fromSurface:true,
      captureBeyondViewport:false,
    });
    if(!result.data)fail(`${route.name} ${viewport.name} returned no PNG data`);

    const png=Buffer.from(result.data,"base64");
    if(png.length<5000)fail(`${route.name} ${viewport.name} PNG is unexpectedly small (${png.length} bytes)`);
    if(!(png[0]===0x89&&png[1]===0x50&&png[2]===0x4e&&png[3]===0x47))fail(`${route.name} ${viewport.name} is not a PNG`);

    const filename=`${route.name}--${viewport.name}.png`;
    const filepath=path.resolve(outputDir,filename);
    fs.writeFileSync(filepath,png);

    if(route.name==="profile"){
      await verifyD29Watchlist(call,viewport);
    }

    return {
      route:route.path,
      name:route.name,
      viewport:viewport.name,
      width:viewport.width,
      height:viewport.height,
      file:filename,
      bytes:png.length,
      sha256:sha256(filepath),
    };
  }finally{
    try{ws.close();}catch{}
    await closeTarget(port,target.id);
  }
}

export async function captureScreenshots(baseUrl,outputDir="artifacts/visual-regression"){
  validateMatrix();
  if(!/^https?:\/\//.test(baseUrl))fail("base URL must be http(s)");

  const chrome=findChrome();
  const port=9222;
  const profileDir=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-d35-chrome-"));
  const stderrRef={value:""};
  fs.mkdirSync(outputDir,{recursive:true});

  const browser=spawn(chrome,[
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ],{stdio:["ignore","ignore","pipe"]});

  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data",chunk=>{stderrRef.value+=chunk;});

  try{
    await waitForDevTools(port,browser,stderrRef);
    const entries=[];
    for(const route of ROUTES){
      for(const viewport of VIEWPORTS){
        entries.push(await captureOne({port,baseUrl,route,viewport,outputDir}));
      }
    }

    if(entries.length!==10)fail(`expected 10 screenshots, got ${entries.length}`);

    const manifest={
      version:2,
      generatedAt:new Date().toISOString(),
      baseUrl,
      browserExecutable:chrome,
      captureProtocol:"Chrome DevTools Protocol Page.captureScreenshot",
      count:entries.length,
      entries,
    };
    fs.writeFileSync(path.join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
    console.log(`VISUAL_REGRESSION_CAPTURE PASS screenshots=${entries.length} protocol=cdp output=${outputDir}`);
    return manifest;
  }finally{
    if(browser.exitCode===null)browser.kill("SIGTERM");
    await sleep(150);
    try{fs.rmSync(profileDir,{recursive:true,force:true});}catch{}
  }
}

if(process.argv.includes("--self-test")){
  validateMatrix();
  let rejected=false;
  try{validateMatrix(ROUTES.slice(0,4),VIEWPORTS);}catch{rejected=true;}
  if(!rejected)fail("negative self-test did not reject incomplete routes");

  rejected=false;
  try{validateMatrix(ROUTES,[{name:"mobile",width:200,height:400,mobile:true}]);}catch{rejected=true;}
  if(!rejected)fail("negative self-test did not reject invalid viewport");


  const desktopSnapshot={viewportWidth:1440,viewportHeight:1200,scrollWidth:1440,panelPosition:"sticky",dockPosition:"static",dockDisplay:"none",pagePaddingBottom:70,panel:{top:96,bottom:1180,left:1000,right:1420,height:1084},dock:{top:0,bottom:0,left:0,right:0,height:0},headerBottom:78,contentBottomAtPageEnd:700,focusedId:"",focusedInputBottom:500};
  const mobileSnapshot={viewportWidth:390,viewportHeight:844,scrollWidth:390,panelPosition:"relative",dockPosition:"fixed",dockDisplay:"grid",pagePaddingBottom:116,panel:{top:180,bottom:720,left:12,right:378,height:540},dock:{top:754,bottom:836,left:8,right:382,height:82},headerBottom:72,contentBottomAtPageEnd:720,focusedId:"lot-bid-input",focusedInputBottom:500};
  validateD23Runtime(desktopSnapshot,{name:"desktop",mobile:false});
  validateD23Runtime(mobileSnapshot,{name:"mobile",mobile:true});

  rejected=false;
  try{validateD23Runtime({...mobileSnapshot,focusedId:""},{name:"mobile",mobile:true});}catch{rejected=true;}
  if(!rejected)fail("D23 negative self-test did not reject missing focus handoff");

  rejected=false;
  try{validateD23Runtime({...mobileSnapshot,contentBottomAtPageEnd:800},{name:"mobile",mobile:true});}catch{rejected=true;}
  if(!rejected)fail("D23 negative self-test did not reject dock overlap");


  const d24Desktop={viewportWidth:1440,viewportHeight:1200,scrollWidth:1440,stageDisplay:"grid",visual:{top:250,bottom:870,left:24,right:1010,width:986,height:620},panel:{top:250,bottom:1000,left:1028,right:1416,width:388,height:750},next:{top:650,bottom:790,left:1052,right:1392,width:340,height:140},currentLot:"EA-10511",nextLot:"EA-10539",nextHref:"/lot/EA-10539",focusedClass:"liveNextPreviewCard"};
  const d24Mobile={viewportWidth:390,viewportHeight:844,scrollWidth:390,stageDisplay:"grid",visual:{top:300,bottom:800,left:24,right:366,width:342,height:500},panel:{top:818,bottom:1500,left:24,right:366,width:342,height:682},next:{top:1120,bottom:1240,left:48,right:342,width:294,height:120},currentLot:"EA-10511",nextLot:"EA-10539",nextHref:"/lot/EA-10539",focusedClass:"liveNextPreviewCard"};
  validateD24Runtime(d24Desktop,{name:"desktop",mobile:false});
  validateD24Runtime(d24Mobile,{name:"mobile",mobile:true});

  rejected=false;
  try{validateD24Runtime({...d24Desktop,nextLot:"EA-10511",nextHref:"/lot/EA-10511"},{name:"desktop",mobile:false});}catch{rejected=true;}
  if(!rejected)fail("D24 negative self-test did not reject identical current/next lot");

  rejected=false;
  try{validateD24Runtime({...d24Mobile,panel:{...d24Mobile.panel,top:760}},{name:"mobile",mobile:true});}catch{rejected=true;}
  if(!rejected)fail("D24 negative self-test did not reject mobile current/next overlap");

  console.log("VISUAL_REGRESSION_CAPTURE_SELF_TEST PASS matrix=5x2 negative_cases=6 d23_runtime=desktop+mobile d24_runtime=desktop+mobile protocol=cdp");
}else{
  const baseUrl=process.argv[2]||"http://127.0.0.1:3011";
  await captureScreenshots(baseUrl);
}
