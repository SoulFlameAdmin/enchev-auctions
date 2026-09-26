import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-buyer-auction-workspace-33-06-10.json";
const DOMAIN_PATH="packages/domain/src/buyer-auction-workspace.ts";
const INDEX_PATH="packages/domain/src/index.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const WS_REGISTRY_PATH="config/enchev-websocket-event-registry.json";
const BINDING_PATH="config/enchev-supabase-project.json";

function fail(message){throw new Error(`BUYER_AUCTION_WORKSPACE_33_06_10 FAIL: ${message}`);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}

function frozenTaskMap(){
  const source=fs.readFileSync(MASTER_PATH,"utf8");
  const startMarker="const raw: RawPhase[] = ";
  const endMarker="\n\nconst WAVE_LABELS";
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start===-1||end===-1) fail("unable to locate frozen master plan");
  const raw=Function(`"use strict"; return (${source.slice(start+startMarker.length,end).trim().replace(/;$/,"")});`)();
  const map=new Map();
  for(const [phaseId,,items] of raw){
    items.forEach((entry,index)=>map.set(`${phaseId}.${String(index+1).padStart(2,"0")}`,String(entry).split("|")[0]));
  }
  return map;
}

function verifyTaskIdentity(config){
  const expected=[
    ["33.06","My Auctions: Bidding"],
    ["33.07","My Auctions: Leading"],
    ["33.08","My Auctions: Ended"],
    ["33.09","Realtime multi-auction action panel"],
    ["33.10","Auction schedule / calendar"]
  ];
  const actual=config.tasks?.map(x=>[x.id,x.name]);
  if(JSON.stringify(actual)!==JSON.stringify(expected)) fail("task contract drift");
  const frozen=frozenTaskMap();
  for(const [id,label] of expected) if(frozen.get(id)!==label) fail(`frozen task identity drift: ${id}`);
}

async function loadDomain(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-buyer-auction-workspace-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,DOMAIN_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail(`domain TypeScript compile failed: ${(r.stderr||r.stdout||"").trim()}`);
  const compiled=path.join(tmp,"buyer-auction-workspace.js");
  const mod=await import(`${pathToFileURL(compiled).href}?v=${Date.now()}`);
  setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
  return mod;
}

function verifyAuthority(config){
  const binding=readJson(BINDING_PATH);
  if(binding.scope!=="development-governance"||binding.auction_authority!==false) fail("Supabase authority boundary drift");
  if(config.persistence?.newBusinessTableRequired!==false) fail("projection block must not invent duplicate persistence");
  if(config.authority?.auctionState!=="postgresql") fail("PostgreSQL authority drift");
  if(config.authority?.realtimeTransportAuthoritative!==false) fail("realtime transport became authoritative");
  const registry=readJson(WS_REGISTRY_PATH);
  if(registry.transportAuthority!==false||!String(registry.gapPolicy).toLowerCase().includes("resync")) fail("realtime registry authority/gap policy drift");
}

async function verifyDomain(config){
  const d=await loadDomain();
  const rows=[
    {userId:"u1",auctionId:"a1",hasAcceptedBid:true,isCurrentLeader:false,auctionStatus:"live",updatedAt:"2026-09-26T18:00:00Z"},
    {userId:"u1",auctionId:"a2",hasAcceptedBid:true,isCurrentLeader:true,auctionStatus:"live",updatedAt:"2026-09-26T18:00:01Z"},
    {userId:"u1",auctionId:"a3",hasAcceptedBid:true,isCurrentLeader:false,auctionStatus:"closed",updatedAt:"2026-09-26T18:00:02Z"},
    {userId:"u2",auctionId:"foreign",hasAcceptedBid:true,isCurrentLeader:true,auctionStatus:"live",updatedAt:"2026-09-26T18:00:03Z"}
  ];
  if(JSON.stringify(d.biddingAuctionsForUser(rows,"u1"))!==JSON.stringify(["a1","a2"])) fail("Bidding projection drift/leak");
  if(JSON.stringify(d.leadingAuctionsForUser(rows,"u1"))!==JSON.stringify(["a2"])) fail("Leading projection drift/leak");
  if(JSON.stringify(d.endedAuctionsForUser(rows,"u1"))!==JSON.stringify(["a3"])) fail("Ended projection drift/leak");

  const panel=d.buildMultiAuctionPanel(rows,"u1",{a1:4,a2:9,a3:12},["a1"],config.limits.realtimePanelMaxAuctions);
  if(panel.length!==3) fail("panel cardinality drift");
  if(panel.find(x=>x.auctionId==="a1")?.stale!==true) fail("panel stale flag missing");
  if(panel.find(x=>x.auctionId==="a2")?.actionState!=="leading") fail("panel leading action drift");
  if(panel.some(x=>x.auctionId==="foreign")) fail("panel cross-user leak");

  const calendar=d.auctionCalendar([
    {auctionId:"b",startsAt:"2026-09-27T12:00:00Z",endsAt:"2026-09-27T13:00:00Z",title:"B",status:"scheduled"},
    {auctionId:"a",startsAt:"2026-09-27T10:00:00Z",endsAt:null,title:"A",status:"scheduled"},
    {auctionId:"a",startsAt:"2026-09-27T11:00:00Z",endsAt:null,title:"A updated",status:"scheduled"}
  ],config.limits.calendarMaxEntries);
  if(JSON.stringify(calendar.map(x=>x.auctionId))!==JSON.stringify(["a","b"])) fail("calendar ordering/dedup drift");
  if(calendar[0].title!=="A updated") fail("calendar latest duplicate not retained");

  return {bidding:2,leading:1,ended:1,panel:3,calendar:2};
}

const config=readJson(CONFIG_PATH);
verifyTaskIdentity(config);
verifyAuthority(config);
const indexSource=fs.readFileSync(INDEX_PATH,"utf8");
if(!indexSource.includes('export * from "./buyer-auction-workspace";')) fail("buyer-auction-workspace export missing");
const result=await verifyDomain(config);

if(process.argv.includes("--self-test")){
  const d=await loadDomain();
  const reject=async(label,fn)=>{let ok=false;try{await fn();}catch{ok=true;}if(!ok)fail(`negative self-test not rejected: ${label}`);};
  await reject("blank user",()=>d.biddingAuctionsForUser([]," "));
  await reject("bad panel limit",()=>d.buildMultiAuctionPanel([],"u",{},[],0));
  await reject("missing panel sequence",()=>d.buildMultiAuctionPanel([{userId:"u",auctionId:"a",hasAcceptedBid:false,isCurrentLeader:false,auctionStatus:"live",updatedAt:"2026-01-01T00:00:00Z"}],"u",{}));
  await reject("bad calendar interval",()=>d.auctionCalendar([{auctionId:"a",startsAt:"2026-01-02T00:00:00Z",endsAt:"2026-01-01T00:00:00Z",title:"A",status:"scheduled"}]));
  await reject("bad calendar timestamp",()=>d.auctionCalendar([{auctionId:"a",startsAt:"nope",endsAt:null,title:"A",status:"scheduled"}]));
  const mutated=structuredClone(config);mutated.tasks[0].name="Mutable Bidding";let rejected=false;try{verifyTaskIdentity(mutated);}catch{rejected=true;}if(!rejected)fail("frozen identity mutation accepted");
  console.log("BUYER_AUCTION_WORKSPACE_33_06_10_SELF_TEST PASS negative_cases=6");
}else{
  console.log(`BUYER_AUCTION_WORKSPACE_33_06_10 PASS tasks=5 bidding=${result.bidding} leading=${result.leading} ended=${result.ended} panel=${result.panel} calendar=${result.calendar} authority=postgresql realtime_authority=false`);
}
