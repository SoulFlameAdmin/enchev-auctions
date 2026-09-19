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
  {name:"phone-360",width:360,height:800,mobile:true},
  {name:"phone-390",width:390,height:844,mobile:true},
  {name:"phone-430",width:430,height:932,mobile:true},
  {name:"desktop-1366",width:1366,height:960,mobile:false},
  {name:"desktop-1440",width:1440,height:1200,mobile:false},
  {name:"desktop-1920",width:1920,height:1200,mobile:false},
];

function fail(message){
  throw new Error(`VISUAL_REGRESSION_CAPTURE FAIL: ${message}`);
}

export function validateMatrix(routes=ROUTES,viewports=VIEWPORTS){
  if(routes.length!==5)fail(`expected 5 routes, got ${routes.length}`);
  if(viewports.length!==6)fail(`expected 6 viewports, got ${viewports.length}`);
  const routeNames=new Set(routes.map(route=>route.name));
  const paths=new Set(routes.map(route=>route.path));
  if(routeNames.size!==routes.length)fail("route names must be unique");
  if(paths.size!==routes.length)fail("route paths must be unique");
  if(!paths.has("/")||!paths.has("/inventory")||!paths.has("/lot/EA-10539")||!paths.has("/live-auctions")||!paths.has("/profile"))fail("core route matrix incomplete");
  for(const viewport of viewports){
    if(!Number.isInteger(viewport.width)||!Number.isInteger(viewport.height)||viewport.width<320||viewport.height<600)fail(`invalid viewport ${viewport.name}`);
  }
  const widths=new Set(viewports.map(v=>v.width));
  for(const required of [360,390,430,1366,1440,1920]){
    if(!widths.has(required))fail(`required DP2 acceptance viewport missing: ${required}px`);
  }
  if(!viewports.filter(v=>v.mobile).every(v=>v.width<=430))fail("phone viewport classification invalid");
  if(!viewports.filter(v=>!v.mobile).every(v=>v.width>=1366))fail("desktop viewport classification invalid");
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

async function verifyDP204AppShell(call,viewport){
  const read=async()=>{const r=await call("Runtime.evaluate",{expression:`(()=>{const shell=document.querySelector('.eaAppShell');const desktop=document.querySelector('.eaAppDesktopNav');const menu=document.querySelector('.eaAppMenuButton');const account=document.querySelector('.eaAppAccount');const search=document.querySelector('.eaAppSearch');const layer=document.querySelector('.eaAppMobileLayer');const drawer=document.querySelector('.eaAppMobileDrawer');const links=[...document.querySelectorAll('.eaAppDesktopNav a')];const mobileLinks=[...document.querySelectorAll('.eaAppMobileNav a')];const mr=menu?.getBoundingClientRect();const dr=drawer?.getBoundingClientRect();return {viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,shellPosition:shell?getComputedStyle(shell).position:'',desktopDisplay:desktop?getComputedStyle(desktop).display:'none',menuDisplay:menu?getComputedStyle(menu).display:'none',accountDisplay:account?getComputedStyle(account).display:'none',searchDisplay:search?getComputedStyle(search).display:'none',layerVisibility:layer?getComputedStyle(layer).visibility:'hidden',shellOpen:shell?.getAttribute('data-shell-open')||'',expanded:menu?.getAttribute('aria-expanded')||'',navLinks:links.length,mobileLinks:mobileLinks.length,menu:{width:mr?.width||0,height:mr?.height||0},drawer:{left:dr?.left||0,right:dr?.right||0,width:dr?.width||0},focusedClass:document.activeElement?.className||''};})()`,returnByValue:true});return r?.result?.value;};
  const before=await read();
  if(!before)fail("DP2-04 app shell snapshot missing");
  if(before.scrollWidth>before.viewportWidth+3)fail(`DP2-04 ${viewport.name} horizontal overflow`);
  if(before.shellPosition!=="sticky")fail(`DP2-04 shell must be sticky, got ${before.shellPosition}`);
  if(before.navLinks!==6||before.mobileLinks!==6)fail(`DP2-04 navigation link count mismatch desktop=${before.navLinks} mobile=${before.mobileLinks}`);
  if(viewport.mobile){
    if(before.desktopDisplay!=="none")fail(`DP2-04 ${viewport.name} desktop nav must be hidden`);
    if(before.menuDisplay==="none"||before.menu.width<44||before.menu.height<44)fail(`DP2-04 ${viewport.name} menu trigger is not visible/touch sized`);
    await call("Runtime.evaluate",{expression:"document.querySelector('.eaAppMenuButton')?.click()"});
    await sleep(120);
    const open=await read();
    if(open.shellOpen!=="true"||open.expanded!=="true"||open.layerVisibility!=="visible")fail(`DP2-04 ${viewport.name} mobile drawer did not open`);
    if(open.drawer.left<0||open.drawer.right>open.viewportWidth+3||open.drawer.width<280)fail(`DP2-04 ${viewport.name} drawer escapes viewport`);
    if(!String(open.focusedClass).includes("eaAppMobileClose"))fail(`DP2-04 ${viewport.name} drawer close control did not receive focus`);
    await call("Runtime.evaluate",{expression:"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))"});
    await sleep(100);
    const closed=await read();
    if(closed.shellOpen!=="false"||closed.expanded!=="false")fail(`DP2-04 ${viewport.name} Escape did not close drawer`);
  }else{
    if(before.desktopDisplay==="none")fail(`DP2-04 ${viewport.name} desktop nav missing`);
    if(before.menuDisplay!=="none")fail(`DP2-04 ${viewport.name} mobile trigger must be hidden`);
    if(before.accountDisplay==="none"||before.searchDisplay==="none")fail(`DP2-04 ${viewport.name} desktop account/search actions missing`);
  }
  return true;
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



async function verifyD25ServerClock(call,viewport){
  const read=async()=>{
    const result=await call("Runtime.evaluate",{expression:`(()=>{const hero=document.querySelector('.liveHeroClock[data-design-task="D25"]');const ring=document.querySelector('.liveRing');const current=document.querySelector('.liveVisual[data-live-slot="current"]');const price=document.querySelector('.liveBidTop b');if(!hero||!ring||!current||!price)return null;const remaining=Number((hero.querySelector('b')?.textContent||'').split(':').pop());const bid=Number((price.textContent||'').replace(/\\D/g,''));return {mode:hero.getAttribute('data-clock-mode')||'',ringMode:ring.getAttribute('data-clock-mode')||'',authority:hero.getAttribute('data-auction-authority')||'',lotId:current.getAttribute('data-lot-id')||'',remaining,bid,viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth};})()`,returnByValue:true});
    return result?.result?.value;
  };

  let initial=null;
  for(let attempt=0;attempt<30;attempt++){
    initial=await read();
    if(initial?.mode==="server"&&initial?.ringMode==="server"&&initial?.lotId)break;
    await sleep(100);
  }
  if(!initial||initial.mode!=="server"||initial.ringMode!=="server")fail(`D25 ${viewport.name} did not enter server clock mode`);
  if(initial.authority!=="false")fail(`D25 ${viewport.name} must declare auctionAuthority=false`);
  if(initial.scrollWidth>initial.viewportWidth+3)fail(`D25 ${viewport.name} horizontal overflow`);
  if(!Number.isFinite(initial.remaining)||initial.remaining<0||initial.remaining>10)fail(`D25 ${viewport.name} remaining out of range: ${initial.remaining}`);
  if(!Number.isFinite(initial.bid)||initial.bid<=0)fail(`D25 ${viewport.name} current bid missing`);

  let after=initial;
  for(let clickAttempt=0;clickAttempt<2&&after.bid===initial.bid;clickAttempt++){
    await call("Runtime.evaluate",{expression:"document.querySelector('.liveBidButton')?.click()"});
    for(let poll=0;poll<10;poll++){
      await sleep(100);
      after=await read();
      if(after?.bid===initial.bid+100&&after?.mode==="server")break;
    }
  }
  if(!after||after.bid!==initial.bid+100)fail(`D25 ${viewport.name} demo bid was not applied after server response`);
  if(after.remaining<7||after.remaining>10)fail(`D25 ${viewport.name} server-reset countdown not near 10s: ${after.remaining}`);

  const endpoint=await call("Runtime.evaluate",{
    expression:"fetch('/api/live-auction-clock',{cache:'no-store'}).then(async r=>({status:r.status,body:await r.json()}))",
    awaitPromise:true,
    returnByValue:true,
  });
  const response=endpoint?.result?.value;
  const body=response?.body;
  if(response?.status!==200||!body)fail(`D25 ${viewport.name} clock endpoint unavailable`);
  if(body.scope!=="server-issued-browser-session-demo")fail(`D25 ${viewport.name} clock scope mismatch`);
  if(body.auctionAuthority!==false)fail(`D25 ${viewport.name} endpoint must remain non-authoritative`);
  if(body.durationMs!==10000)fail(`D25 ${viewport.name} server duration must be 10000ms`);
  if(body.lotId!==after.lotId)fail(`D25 ${viewport.name} DOM/server lot mismatch: ${after.lotId}/${body.lotId}`);
  const remainingMs=body.roundEndsAt-body.serverNow;
  if(remainingMs<6500||remainingMs>10000)fail(`D25 ${viewport.name} server deadline window invalid: ${remainingMs}ms`);
}


async function verifyD26SoldAdvance(call,viewport){
  await call("Network.enable");
  const originResult=await call("Runtime.evaluate",{expression:"location.origin",returnByValue:true});
  const origin=originResult?.result?.value;
  if(typeof origin!=="string"||!origin.startsWith("http"))fail(`D26 ${viewport.name} origin missing`);

  const seededState=encodeURIComponent(JSON.stringify({lotIndex:0,roundEndsAt:Date.now()+2200}));
  const cookie=await call("Network.setCookie",{
    name:"enchev_live_demo_v2",
    value:seededState,
    url:origin,
    path:"/",
    httpOnly:true,
    secure:false,
    sameSite:"Lax",
  });
  if(cookie?.success!==true)fail(`D26 ${viewport.name} could not seed server-session state`);

  await call("Page.reload",{ignoreCache:true});
  await sleep(250);

  const read=async()=>{
    const result=await call("Runtime.evaluate",{expression:`(()=>{const stage=document.querySelector('.liveStage[data-auto-advance-task="D26"]');const current=document.querySelector('.liveVisual[data-live-slot="current"]');const next=document.querySelector('.liveNextPreview[data-live-slot="next"]');const notice=document.querySelector('.liveSoldTransition[data-design-task="D26"]');const timer=document.querySelector('.liveHeroClock[data-design-task="D25"]');if(!stage||!current||!next||!timer)return null;const nr=notice?.getBoundingClientRect();return {currentLot:current.getAttribute('data-lot-id')||'',nextLot:next.getAttribute('data-lot-id')||'',clockMode:timer.getAttribute('data-clock-mode')||'',soldLot:notice?.getAttribute('data-sold-lot')||'',noticeText:notice?.textContent||'',noticeVisible:Boolean(notice&&nr&&nr.width>0&&nr.height>0),scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};})()`,returnByValue:true});
    return result?.result?.value;
  };

  let before=null;
  for(let attempt=0;attempt<20;attempt++){
    before=await read();
    if(before?.clockMode==="server"&&before.currentLot==="EA-10511")break;
    await sleep(100);
  }
  if(!before||before.clockMode!=="server"||before.currentLot!=="EA-10511")fail(`D26 ${viewport.name} seeded lot did not become active`);
  if(before.nextLot!=="EA-10539")fail(`D26 ${viewport.name} seeded next lot mismatch: ${before.nextLot}`);

  let after=null;
  for(let attempt=0;attempt<45;attempt++){
    after=await read();
    if(after?.currentLot==="EA-10539"&&after?.soldLot==="EA-10511"&&after?.noticeVisible)break;
    await sleep(100);
  }
  if(!after)fail(`D26 ${viewport.name} post-expiry state missing`);
  if(after.currentLot!=="EA-10539")fail(`D26 ${viewport.name} did not auto-advance to next lot: ${after.currentLot}`);
  if(after.nextLot!=="EA-10603")fail(`D26 ${viewport.name} next-lot preview did not advance: ${after.nextLot}`);
  if(after.soldLot!=="EA-10511"||!after.noticeVisible||!after.noticeText.includes("SOLD"))fail(`D26 ${viewport.name} SOLD transition notice missing`);
  if(after.scrollWidth>after.viewportWidth+3)fail(`D26 ${viewport.name} horizontal overflow after transition`);

  const endpoint=await call("Runtime.evaluate",{
    expression:"fetch('/api/live-auction-clock',{cache:'no-store'}).then(async r=>({status:r.status,body:await r.json()}))",
    awaitPromise:true,
    returnByValue:true,
  });
  const response=endpoint?.result?.value;
  if(response?.status!==200||response?.body?.lotId!=="EA-10539")fail(`D26 ${viewport.name} DOM/server lot mismatch after auto-advance`);
  if(response?.body?.auctionAuthority!==false)fail(`D26 ${viewport.name} must remain auctionAuthority=false`);
}

async function verifyD27BidFeedback(call,viewport){
  await call("Network.enable");
  const originResult=await call("Runtime.evaluate",{expression:"location.origin",returnByValue:true});
  const origin=originResult?.result?.value;
  if(typeof origin!=="string"||!origin.startsWith("http"))fail(`D27 ${viewport.name} origin missing`);

  const seededState=encodeURIComponent(JSON.stringify({lotIndex:0,roundEndsAt:Date.now()+30_000,bidSequence:0}));
  const cookie=await call("Network.setCookie",{
    name:"enchev_live_demo_v2",
    value:seededState,
    url:origin,
    path:"/",
    httpOnly:true,
    secure:false,
    sameSite:"Lax",
  });
  if(cookie?.success!==true)fail(`D27 ${viewport.name} could not seed server-session state`);

  await call("Page.reload",{ignoreCache:true});
  await sleep(250);

  const read=async()=>{
    const result=await call("Runtime.evaluate",{expression:`(()=>{const timer=document.querySelector('.liveHeroClock[data-design-task="D25"]');const current=document.querySelector('.liveVisual[data-live-slot="current"]');const feedback=document.querySelector('.liveBidFeedback[data-design-task="D27"]');const bid=document.querySelector('.liveBidButton');const price=document.querySelector('.liveBidTop b');if(!timer||!current||!feedback||!bid||!price)return null;const fr=feedback.getBoundingClientRect();return {clockMode:timer.getAttribute('data-clock-mode')||'',auctionAuthority:feedback.getAttribute('data-auction-authority')||'',lotId:current.getAttribute('data-lot-id')||'',feedback:feedback.getAttribute('data-bid-feedback')||'',text:feedback.textContent||'',priceText:price.textContent||'',visible:fr.width>0&&fr.height>0,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,bidDisabled:bid.disabled===true};})()`,returnByValue:true});
    return result?.result?.value;
  };

  let initial=null;
  for(let attempt=0;attempt<25;attempt++){
    initial=await read();
    if(initial?.clockMode==="server"&&initial.lotId==="EA-10511")break;
    await sleep(100);
  }
  if(!initial||initial.clockMode!=="server"||initial.lotId!=="EA-10511")fail(`D27 ${viewport.name} seeded lot did not reach server mode`);
  if(initial.feedback!=="idle"||initial.auctionAuthority!=="false"||!initial.visible)fail(`D27 ${viewport.name} initial feedback contract invalid`);
  if(initial.scrollWidth>initial.viewportWidth+3)fail(`D27 ${viewport.name} horizontal overflow before feedback test`);

  const expected=[
    ["accepted","ОФЕРТАТА Е ПРИЕТА",100],
    ["leading","ВОДИШ В ТЪРГА",100],
    ["outbid","НАДДАВАН СИ",100],
    ["rejected","ОФЕРТАТА Е ОТХВЪРЛЕНА",0],
  ];

  let previousPrice=Number((initial.priceText.match(/[0-9\s]+/)?.[0]||"0").replace(/\s/g,""));
  for(const [feedbackState,label,delta] of expected){
    await call("Runtime.evaluate",{expression:"document.querySelector('.liveBidButton')?.click()"});
    let state=null;
    for(let attempt=0;attempt<30;attempt++){
      await sleep(80);
      state=await read();
      if(state?.feedback===feedbackState)break;
    }
    if(!state||state.feedback!==feedbackState)fail(`D27 ${viewport.name} expected ${feedbackState}, got ${state?.feedback||"missing"}`);
    if(!state.text.includes(label))fail(`D27 ${viewport.name} ${feedbackState} label mismatch`);
    if(state.auctionAuthority!=="false")fail(`D27 ${viewport.name} must remain auctionAuthority=false`);
    if(state.lotId!=="EA-10511")fail(`D27 ${viewport.name} lot changed during feedback cycle`);
    if(state.scrollWidth>state.viewportWidth+3)fail(`D27 ${viewport.name} horizontal overflow in ${feedbackState} state`);

    const nextPrice=Number((state.priceText.match(/[0-9\s]+/)?.[0]||"0").replace(/\s/g,""));
    if(nextPrice!==previousPrice+delta)fail(`D27 ${viewport.name} ${feedbackState} price delta mismatch: ${previousPrice} -> ${nextPrice}`);
    previousPrice=nextPrice;
  }

  const endpoint=await call("Runtime.evaluate",{
    expression:"fetch('/api/live-auction-clock',{cache:'no-store'}).then(async r=>({status:r.status,body:await r.json()}))",
    awaitPromise:true,
    returnByValue:true,
  });
  const response=endpoint?.result?.value;
  if(response?.status!==200||response?.body?.auctionAuthority!==false||response?.body?.scope!=="server-issued-browser-session-demo")fail(`D27 ${viewport.name} endpoint authority/scope contract mismatch`);
}

async function verifyD29Watchlist(call,viewport){
  const before=await call("Runtime.evaluate",{expression:`(()=>{const s=document.querySelector('.profileWatchlist[data-design-task="D29"]');const summary=s?.querySelector('.profileWatchlistSummary');const grid=s?.querySelector('.profileWatchlistGrid');const cards=[...(s?.querySelectorAll('.profileWatchlistCard')||[])];const first=cards[0];const remove=first?.querySelector('.profileWatchlistRemove');if(!s||!summary||!grid||!first||!remove)return null;remove.focus({preventScroll:true});const rr=remove.getBoundingClientRect();const states=cards.map(x=>x.getAttribute('data-auction-state')||'');const ids=cards.map(x=>x.getAttribute('data-lot-id')||'');return {viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,count:cards.length,saved:Number(summary.getAttribute('data-saved-count')),live:Number(summary.getAttribute('data-live-count')),states,ids,focused:document.activeElement===remove,removeWidth:rr.width,removeHeight:rr.height,lotLinks:cards.every((x,i)=>x.querySelector('.profileWatchlistActions a:first-child')?.getAttribute('href')==='/lot/'+ids[i]),liveLinks:cards.every(x=>x.querySelector('.profileWatchlistActions a:last-child')?.getAttribute('href')==='/live-auctions')};})()`,returnByValue:true});
  const b=before?.result?.value;
  if(!b)fail("D29 watchlist runtime elements missing");
  if(b.scrollWidth>b.viewportWidth+3)fail(`D29 ${viewport.name} horizontal overflow`);
  if(b.count!==3||b.saved!==3||b.live!==1)fail(`D29 ${viewport.name} initial count mismatch`);
  if(!["live","upcoming","buy-now"].every(state=>b.states.includes(state)))fail(`D29 ${viewport.name} missing saved-vehicle state`);
  if(!b.focused||!b.lotLinks||!b.liveLinks)fail(`D29 ${viewport.name} focus or action-link contract failed`);
  if(viewport.mobile){
    if(b.columns!==1)fail(`D29 mobile grid expected 1 column, got ${b.columns}`);
    if(b.removeWidth<43||b.removeHeight<43)fail("D29 mobile remove target below 44px");
  }else if(b.columns!==3){
    fail(`D29 desktop grid expected 3 columns, got ${b.columns}`);
  }

  const removedLot=b.ids[0];
  await call("Runtime.evaluate",{expression:"document.querySelector('.profileWatchlistCard .profileWatchlistRemove')?.click()"});
  await sleep(120);
  const after=await call("Runtime.evaluate",{expression:`(()=>{const s=document.querySelector('.profileWatchlist[data-design-task="D29"]');const summary=s?.querySelector('.profileWatchlistSummary');const cards=[...(s?.querySelectorAll('.profileWatchlistCard')||[])];return {count:cards.length,saved:Number(summary?.getAttribute('data-saved-count')),live:Number(summary?.getAttribute('data-live-count')),ids:cards.map(x=>x.getAttribute('data-lot-id')||'')};})()`,returnByValue:true});
  const a=after?.result?.value;
  if(!a||a.count!==2||a.saved!==2||a.live!==0||a.ids.includes(removedLot))fail(`D29 ${viewport.name} remove interaction did not update watchlist state`);
}


async function verifyD30MyAuctions(call,viewport){
  const read=async()=> {
    const result=await call("Runtime.evaluate",{expression:`(()=>{const section=document.querySelector('.myAuctions[data-design-task="D30"]');const list=section?.querySelector('.myAuctionsList');const tabs=[...(section?.querySelectorAll('.myAuctionsTabs [role="tab"]')||[])];const rows=[...(section?.querySelectorAll('.myAuctionRow')||[])];if(!section||!list||tabs.length!==5)return null;const sr=section.getBoundingClientRect();const tr=tabs[0].getBoundingClientRect();const states=rows.map(row=>row.getAttribute('data-auction-state')||'');const ids=rows.map(row=>row.getAttribute('data-lot-id')||'');return {viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,active:list.getAttribute('data-active-tab')||'',visible:Number(list.getAttribute('data-visible-count')||-1),selected:tabs.filter(tab=>tab.getAttribute('aria-selected')==='true').map(tab=>tab.getAttribute('data-tab-key')||''),tabKeys:tabs.map(tab=>tab.getAttribute('data-tab-key')||''),tabCounts:tabs.map(tab=>Number(tab.querySelector('span')?.textContent||-1)),states,ids,rowsContained:rows.every(row=>{const r=row.getBoundingClientRect();return r.left>=sr.left-3&&r.right<=sr.right+3;}),actionLinks:rows.map(row=>row.querySelector('.myAuctionAction a')?.getAttribute('href')||''),mediaLinks:rows.map(row=>row.querySelector('.myAuctionMedia')?.getAttribute('href')||''),tabHeight:tr.height};})()`,returnByValue:true});
    return result?.result?.value;
  };

  const initial=await read();
  if(!initial)fail("D30 my-auctions runtime elements missing");
  if(initial.scrollWidth>initial.viewportWidth+3)fail(`D30 ${viewport.name} horizontal overflow`);
  if(initial.active!=="all"||initial.visible!==4||initial.selected.length!==1||initial.selected[0]!=="all")fail(`D30 ${viewport.name} initial all-tab state invalid`);
  if(initial.tabKeys.join(",")!=="all,watching,bidding,leading,ended")fail("D30 tab key order mismatch");
  if(initial.tabCounts.join(",")!=="4,1,1,1,1")fail(`D30 ${viewport.name} tab counts mismatch`);
  if(!["watching","bidding","leading","ended"].every(state=>initial.states.includes(state)))fail(`D30 ${viewport.name} missing auction visual state`);
  if(!initial.rowsContained)fail(`D30 ${viewport.name} auction row escapes section bounds`);
  if(viewport.mobile&&initial.tabHeight<43)fail(`D30 mobile tab target below 44px: ${initial.tabHeight}`);

  for(const key of ["watching","bidding","leading","ended"]){
    await call("Runtime.evaluate",{expression:`document.querySelector('.myAuctionsTabs [data-tab-key="${key}"]')?.click()`});
    await sleep(90);
    const state=await read();
    if(!state||state.active!==key||state.visible!==1||state.selected.length!==1||state.selected[0]!==key)fail(`D30 ${viewport.name} ${key} tab did not activate correctly`);
    if(state.states.length!==1||state.states[0]!==key)fail(`D30 ${viewport.name} ${key} filter returned wrong row state`);
    if(state.ids.length!==1||!state.ids[0].startsWith("EA-"))fail(`D30 ${viewport.name} ${key} row lot id missing`);
    if(state.mediaLinks[0]!==`/lot/${state.ids[0]}`)fail(`D30 ${viewport.name} ${key} media link mismatch`);
    const expectedAction=key==="ended"?`/lot/${state.ids[0]}`:"/live-auctions";
    if(state.actionLinks[0]!==expectedAction)fail(`D30 ${viewport.name} ${key} action link mismatch`);
  }

  await call("Runtime.evaluate",{expression:"document.querySelector('.myAuctionsTabs [data-tab-key=\"all\"]')?.click()"});
  await sleep(90);
  const restored=await read();
  if(!restored||restored.active!=="all"||restored.visible!==4||restored.states.length!==4)fail(`D30 ${viewport.name} all tab did not restore four rows`);
}


async function d28ConnectionSnapshot(call){
  const result=await call("Runtime.evaluate",{expression:`(()=>{const el=document.querySelector('.liveConnectionState[data-design-task="D28"]');if(!el)return null;const r=el.getBoundingClientRect();return {state:el.getAttribute('data-connection-state')||'',authority:el.getAttribute('data-auction-authority')||'',text:el.textContent||'',viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},display:getComputedStyle(el).display};})()`,returnByValue:true});
  return result?.result?.value;
}

async function waitForD28State(call,expected,attempts=40,delay=100){
  let snapshot=null;
  for(let attempt=0;attempt<attempts;attempt++){
    snapshot=await d28ConnectionSnapshot(call);
    if(snapshot?.state===expected)return snapshot;
    await sleep(delay);
  }
  fail(`D28 connection state did not reach ${expected}; last=${snapshot?.state||"missing"}`);
}

async function verifyD28ConnectionState(call,viewport){
  const connected=await waitForD28State(call,"connected",40,100);
  if(connected.authority!=="false")fail(`D28 ${viewport.name} must declare auctionAuthority=false`);
  if(connected.scrollWidth>connected.viewportWidth+3)fail(`D28 ${viewport.name} horizontal overflow`);
  if(connected.display==="none"||connected.rect.width<140||connected.rect.height<44)fail(`D28 ${viewport.name} status indicator is not meaningfully visible`);
  if(connected.rect.left<-3||connected.rect.right>connected.viewportWidth+3)fail(`D28 ${viewport.name} status indicator escapes viewport`);
  if(!connected.text.includes("СВЪРЗАН"))fail(`D28 ${viewport.name} connected label missing`);

  if(viewport.mobile)return;

  await call("Network.enable");
  try{
    await call("Network.emulateNetworkConditions",{
      offline:true,
      latency:0,
      downloadThroughput:0,
      uploadThroughput:0,
      connectionType:"none",
    });
    await call("Runtime.evaluate",{expression:"window.dispatchEvent(new Event('offline'))"});
    const reconnecting=await waitForD28State(call,"reconnecting",20,100);
    if(!reconnecting.text.includes("ПОВТОРНО СВЪРЗВАНЕ"))fail("D28 reconnecting label missing");

    const stale=await waitForD28State(call,"stale",60,100);
    if(!stale.text.includes("ОСТАРЕЛИ"))fail("D28 stale label missing");

    await call("Network.emulateNetworkConditions",{
      offline:false,
      latency:0,
      downloadThroughput:-1,
      uploadThroughput:-1,
      connectionType:"wifi",
    });
    await call("Runtime.evaluate",{expression:"window.dispatchEvent(new Event('online'))"});
    const recovered=await waitForD28State(call,"connected",40,100);
    if(!recovered.text.includes("СВЪРЗАН"))fail("D28 recovery label missing");
  }finally{
    try{
      await call("Network.emulateNetworkConditions",{
        offline:false,
        latency:0,
        downloadThroughput:-1,
        uploadThroughput:-1,
        connectionType:"wifi",
      });
      await call("Runtime.evaluate",{expression:"window.dispatchEvent(new Event('online'))"});
      await sleep(120);
      await call("Network.disable");
    }catch{}
  }
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
    await verifyDP204AppShell(call,viewport);

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

    if(route.name==="live-auctions"){
      await verifyD25ServerClock(call,viewport);
      await verifyD26SoldAdvance(call,viewport);
      await verifyD27BidFeedback(call,viewport);
      await verifyD28ConnectionState(call,viewport);
    }
    if(route.name==="profile"){
      await verifyD29Watchlist(call,viewport);
      await verifyD30MyAuctions(call,viewport);
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

    if(entries.length!==30)fail(`expected 30 screenshots, got ${entries.length}`);

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

  console.log("VISUAL_REGRESSION_CAPTURE_SELF_TEST PASS matrix=5x6 widths=360,390,430,1366,1440,1920 negative_cases=6 d23_runtime=desktop+mobile d24_runtime=desktop+mobile protocol=cdp");
}else{
  const baseUrl=process.argv[2]||"http://127.0.0.1:3011";
  await captureScreenshots(baseUrl);
}
