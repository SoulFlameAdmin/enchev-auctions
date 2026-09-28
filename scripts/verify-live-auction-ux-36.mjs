import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-live-auction-ux-36.json";
const DOMAIN_PATH="packages/domain/src/live-auction-ux.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const UI_PATH="app/live-auctions/ProfessionalLiveAuctionUx.tsx";
const PAGE_PATH="app/live-auctions/page.tsx";

function fail(message){throw new Error("LIVE_AUCTION_UX_36 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTasks(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function('"use strict"; return ('+source.slice(start+startMarker.length,end).trim().replace(/;$/,"")+');')();
  const phase=raw.find(x=>x[0]==="36");
  if(!phase) fail("phase 36 missing");
  return phase[2].map((entry,index)=>{
    const [name,statusRaw,kindRaw]=String(entry).split("|");
    void statusRaw;
    return {id:"36."+String(index+1).padStart(2,"0"),name,kind:kindRaw==="security"?"security":kindRaw==="test"?"test":"feature"};
  });
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-live-ux-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("domain TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"live-auction-ux.js")).href+"?v="+Date.now());
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

const config=readJson(CONFIG_PATH);
const expected=frozenTasks();
if(JSON.stringify(config.tasks)!==JSON.stringify(expected)) fail("frozen Phase 36 task identity drift");
if(expected.length!==20) fail("Phase 36 must contain 20 tasks");

const indexSource=fs.readFileSync(INDEX_PATH,"utf8");
if(!indexSource.includes('export * from "./live-auction-ux";')) fail("domain export missing");
const uiSource=fs.readFileSync(UI_PATH,"utf8");
const pageSource=fs.readFileSync(PAGE_PATH,"utf8");
for(const task of expected){
  if(!uiSource.includes(`data-phase-task="${task.id}"`)) fail("UI marker missing for "+task.id);
}
if(!pageSource.includes("ProfessionalLiveAuctionUx")) fail("professional live UX component not mounted");
if(!pageSource.includes("lastRttMs")) fail("server RTT not wired to professional live UX");

const d=await loadDomain();
const lots=[
  {auctionId:"a1",lotId:"l1",title:"Lot 1",queueOrder:1,state:"live",currentBidCents:100000,sequence:10,updatedAt:"2026-09-28T12:00:00Z",endsAt:"2026-09-28T12:00:10Z"},
  {auctionId:"a1",lotId:"l2",title:"Lot 2",queueOrder:2,state:"upcoming",currentBidCents:110000,sequence:7,updatedAt:"2026-09-28T12:00:00Z",endsAt:null},
  {auctionId:"a1",lotId:"l3",title:"Lot 3",queueOrder:3,state:"upcoming",currentBidCents:120000,sequence:4,updatedAt:"2026-09-28T12:00:00Z",endsAt:null},
];

const focus=d.buildBidderFocusMode("u1","a1","l1",true);
if(!focus.enabled||!focus.distractionGuard||focus.focusedLotId!=="l1") fail("36.01 focus mode drift");

const dashboard=d.buildMultiLotDashboard(lots,"a1","l1",["l3"]);
if(dashboard.length!==3||dashboard[1].lotsAway!==1||dashboard[1].lanePosition!==2) fail("36.02/36.04/36.05 dashboard drift");
if(!dashboard[2].stale) fail("36.02 stale dashboard marker drift");

const panel=d.buildCurrentNextLotPanel(lots,"a1","l1");
if(panel.current?.lotId!=="l1"||panel.next?.lotId!=="l2") fail("36.03 current/next panel drift");

const sync=d.buildServerTimeSyncIndicator(1000,1200,1125);
if(sync.rttMs!==200||sync.offsetMs!==25||sync.quality!=="synced") fail("36.06 server-time sync drift");

const network=d.buildNetworkQualityIndicator({online:true,rttMs:200,lastServerSyncAtMs:1000,nowMs:1200});
if(network.quality!=="excellent") fail("36.07 network quality drift");

const banner=d.connectionLossBanner("reconnecting");
if(!banner.visible||banner.tone!=="warning") fail("36.08 connection banner drift");

const reconnect=d.buildReconnectProgress(2,5,500);
if(reconnect.state!=="retrying"||reconnect.progressPct!==40||reconnect.nextRetryMs!==1000) fail("36.09 reconnect progress drift");

const replica={accountId:"acct1",auctionId:"a1",deviceId:"dev1",tabId:"tab1",sequence:8,updatedAt:"2026-09-28T11:59:55Z",stale:true,currentLotId:"l1"};
const snapshot={accountId:"acct1",auctionId:"a1",deviceId:"server",tabId:"server",sequence:10,serverNow:"2026-09-28T12:00:00Z",currentLotId:"l1",lots};
const resynced=d.authoritativeResync(replica,snapshot);
if(resynced.sequence!==10||resynced.stale||resynced.currentLotId!=="l1") fail("36.10 authoritative resync drift");

const stale=d.staleStateDecision({...replica,updatedAt:"2026-09-28T11:59:50Z"},Date.parse("2026-09-28T12:00:00Z"),4500);
if(!stale.stale||!stale.hardRefreshRequired) fail("36.11 stale hard-refresh drift");

let bid=d.armBidAction({auctionId:"a1",lotId:"l1",amountCents:100100,connectionState:"connected",readOnly:false});
if(bid.state!=="armed") fail("36.12 bid arm drift");
bid=d.submitArmedBid(bid);
const accepted=d.resolveBidAction(bid,"accepted",null);
if(accepted.state!=="accepted"||!accepted.reasonText) fail("36.13 accepted reason UX drift");
const rejected=d.resolveBidAction(bid,"rejected","minimum-increment");
if(rejected.state!=="rejected"||rejected.reasonCode!=="minimum-increment") fail("36.13 rejected reason UX drift");
const outbid=d.applyOutbidRealtime(accepted,100200);
if(outbid.state!=="outbid") fail("36.14 outbid realtime drift");

const extension=d.detectLateExtension({previousEndsAtMs:10_000,nextEndsAtMs:18_000,bidOccurredAtMs:9_000,lateWindowMs:3_000});
if(!extension.extended||!extension.late||extension.extensionMs!==8_000) fail("36.15 late-extension drift");

const tabs=d.resolveMultiTabConflict([
  {accountId:"acct1",auctionId:"a1",tabId:"tab-a",leaseSequence:2,heartbeatAt:"2026-09-28T12:00:00Z"},
  {accountId:"acct1",auctionId:"a1",tabId:"tab-b",leaseSequence:3,heartbeatAt:"2026-09-28T12:00:00Z"},
],Date.parse("2026-09-28T12:00:01Z"));
if(tabs.ownerTabId!=="tab-b"||tabs.readOnlyTabIds[0]!=="tab-a") fail("36.16 multi-tab drift");

if(d.keyboardBidCommand({key:"b",focusEnabled:true,bidState:"idle",readOnly:false})!=="arm") fail("36.17 keyboard arm drift");
if(d.keyboardBidCommand({key:"Enter",focusEnabled:true,bidState:"armed",readOnly:false})!=="submit") fail("36.17 keyboard submit drift");

const mobile=d.mobileLiveRoomLayout(390);
if(mobile.mode!=="mobile"||!mobile.stickyBidBar||mobile.dashboardColumns!==1) fail("36.18 mobile layout drift");

const announcement=d.accessibleLiveAnnouncement("outbid","Lot l1 now has a higher bid");
if(!announcement.startsWith("Outbid alert:")) fail("36.19 accessible announcement drift");

const devices=d.reconcileSameAccountDevices([
  {accountId:"acct1",deviceId:"phone",auctionId:"a1",sequence:8,currentLotId:"l1",stale:true},
  {accountId:"acct1",deviceId:"desktop",auctionId:"a1",sequence:9,currentLotId:"l1",stale:false},
],snapshot);
if(devices.length!==2||devices.some(x=>x.sequence!==10||x.stale||x.currentLotId!=="l1")) fail("36.20 same-account device convergence drift");

if(process.argv.includes("--self-test")){
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail("negative self-test not rejected: "+label);};
  await reject("cross auction dashboard",()=>d.buildMultiLotDashboard([{...lots[0],auctionId:"other"}],"a1","l1"));
  await reject("multiple current lots",()=>d.buildMultiLotDashboard([lots[0],{...lots[1],state:"live"}],"a1","l1"));
  await reject("unsafe disconnected bid",()=>d.armBidAction({auctionId:"a1",lotId:"l1",amountCents:100100,connectionState:"stale",readOnly:false}));
  await reject("read-only tab bid",()=>d.armBidAction({auctionId:"a1",lotId:"l1",amountCents:100100,connectionState:"connected",readOnly:true}));
  await reject("rejected without reason",()=>d.resolveBidAction(bid,"rejected",null));
  await reject("resync sequence regression",()=>d.authoritativeResync({...replica,sequence:11},snapshot));
  await reject("cross-account tab",()=>d.resolveMultiTabConflict([
    {accountId:"acct1",auctionId:"a1",tabId:"a",leaseSequence:1,heartbeatAt:"2026-09-28T12:00:00Z"},
    {accountId:"acct2",auctionId:"a1",tabId:"b",leaseSequence:2,heartbeatAt:"2026-09-28T12:00:00Z"},
  ],Date.parse("2026-09-28T12:00:01Z")));
  await reject("device ahead of authority",()=>d.reconcileSameAccountDevices([{accountId:"acct1",deviceId:"x",auctionId:"a1",sequence:11,currentLotId:"l1",stale:false}],snapshot));
  console.log("LIVE_AUCTION_UX_36_SELF_TEST PASS tasks=20 negative_cases=8 e2e_model=true ui_markers=20");
}else{
  console.log("LIVE_AUCTION_UX_36 PASS tasks=20 e2e_model=true ui_markers=20");
}
