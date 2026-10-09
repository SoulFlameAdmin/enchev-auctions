"use client";

import { GOLF_GTI_DEMO_IMAGE, GOLF_GTI_DEMO_PHOTO_CREDIT } from "../data/demo-vehicle-media";
import { useEffect, useMemo, useRef, useState } from "react";
import "./live-auctions.css";
import "./live-d24.css";
import ProfessionalLiveAuctionUx from "./ProfessionalLiveAuctionUx";

const LOT_SECONDS=10;
const RESYNC_INTERVAL_MS=3000;
const STALE_AFTER_MS=4500;
const lots=[
  {lot:"EA-10511",title:"2021 Mercedes-Benz GLC",location:"Munich, DE",damage:"Front end",mileage:"64 900 km",price:18400,image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1500&q=86"},
  {lot:"EA-10539",title:"2022 Audi RS3 Sportback",location:"Crewe, UK",damage:"Minor scratches",mileage:"41 280 km",price:21900,image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1500&q=86"},
  {lot:"EA-10603",title:"2026 Volkswagen Golf GTI",location:"London, UK",damage:"Clean title",mileage:"9 870 km",price:16250,image:GOLF_GTI_DEMO_IMAGE},
  {lot:"EA-10627",title:"2020 BMW X5 xDrive40i",location:"Texas, USA",damage:"Rear end",mileage:"96 210 km",price:15100,image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1500&q=86"},
];

type BidFeedback="accepted"|"leading"|"outbid"|"rejected";
type ConnectionState="syncing"|"connected"|"reconnecting"|"stale";

type LiveClockPayload={
  serverNow:number;
  roundEndsAt:number;
  durationMs:number;
  lotIndex:number;
  lotId:string;
  scope:string;
  auctionAuthority:boolean;
  bidFeedback?:BidFeedback|null;
  priceDelta?:number;
};

export default function LiveAuctionsPage(){
  const [active,setActive]=useState(0);
  const [remaining,setRemaining]=useState(LOT_SECONDS);
  const [prices,setPrices]=useState<Record<string,number>>(()=>Object.fromEntries(lots.map(x=>[x.lot,x.price])));
  const [bidFlash,setBidFlash]=useState(false);
  const [clockMode,setClockMode]=useState<"syncing"|"server">("syncing");
  const [soldNotice,setSoldNotice]=useState<string|null>(null);
  const [bidFeedback,setBidFeedback]=useState<BidFeedback|null>(null);
  const [connectionState,setConnectionState]=useState<ConnectionState>("syncing");
  const [connectionAgeSeconds,setConnectionAgeSeconds]=useState(0);
  const [lastRttMs,setLastRttMs]=useState<number|null>(null);

  const deadlineRef=useRef<number|null>(null);
  const serverOffsetRef=useRef(0);
  const lastServerNowRef=useRef(0);
  const syncInFlightRef=useRef(false);
  const activeRef=useRef(0);
  const soldNoticeTimerRef=useRef<number|null>(null);
  const lastSuccessfulSyncRef=useRef(0);

  const markConnectionFailure=(now=Date.now())=>{
    const lastSuccess=lastSuccessfulSyncRef.current;
    setConnectionState(lastSuccess>0&&now-lastSuccess>=STALE_AFTER_MS?"stale":"reconnecting");
  };

  const applyClock=(data:LiveClockPayload,sentAt:number,receivedAt:number)=>{
    if(
      !Number.isFinite(data.serverNow)||
      !Number.isFinite(data.roundEndsAt)||
      !Number.isInteger(data.lotIndex)||
      data.lotIndex<0||
      data.lotIndex>=lots.length||
      data.serverNow<lastServerNowRef.current||
      data.scope!=="server-issued-browser-session-demo"||
      data.auctionAuthority!==false
    )return false;

    const midpoint=sentAt+(receivedAt-sentAt)/2;
    const offset=data.serverNow-midpoint;
    setLastRttMs(receivedAt-sentAt);
    const previousIndex=activeRef.current;
    const hadServerState=lastServerNowRef.current>0;

    if(hadServerState&&data.lotIndex!==previousIndex){
      setSoldNotice(lots[previousIndex].lot);
      if(soldNoticeTimerRef.current!==null)window.clearTimeout(soldNoticeTimerRef.current);
      soldNoticeTimerRef.current=window.setTimeout(()=>setSoldNotice(null),1800);
    }

    lastServerNowRef.current=data.serverNow;
    serverOffsetRef.current=offset;
    deadlineRef.current=data.roundEndsAt;
    activeRef.current=data.lotIndex;
    setActive(data.lotIndex);
    setRemaining(Math.max(0,Math.ceil((data.roundEndsAt-(Date.now()+offset))/1000)));
    setClockMode("server");
    lastSuccessfulSyncRef.current=receivedAt;
    setConnectionAgeSeconds(0);
    setConnectionState("connected");
    return true;
  };

  const syncClock=async()=>{
    if(syncInFlightRef.current)return;
    syncInFlightRef.current=true;
    const sentAt=Date.now();
    try{
      const response=await fetch("/api/live-auction-clock",{cache:"no-store"});
      if(!response.ok)throw new Error(`live-clock-http-${response.status}`);
      const data=await response.json() as LiveClockPayload;
      if(!applyClock(data,sentAt,Date.now()))throw new Error("live-clock-invalid-payload");
    }catch{
      markConnectionFailure();
    }finally{
      syncInFlightRef.current=false;
    }
  };

  useEffect(()=>{
    if(deadlineRef.current===null)deadlineRef.current=Date.now()+LOT_SECONDS*1000;
    void syncClock();

    const tickId=window.setInterval(()=>{
      const deadline=deadlineRef.current;
      if(deadline===null)return;
      const serverAlignedNow=Date.now()+serverOffsetRef.current;
      const nextRemaining=Math.max(0,Math.ceil((deadline-serverAlignedNow)/1000));
      setRemaining(nextRemaining);
      if(nextRemaining===0)void syncClock();
    },200);

    const resyncId=window.setInterval(()=>void syncClock(),RESYNC_INTERVAL_MS);
    const connectionMonitorId=window.setInterval(()=>{
      const lastSuccess=lastSuccessfulSyncRef.current;
      if(lastSuccess===0)return;
      const age=Date.now()-lastSuccess;
      setConnectionAgeSeconds(Math.floor(age/1000));
      if(age>=STALE_AFTER_MS)setConnectionState("stale");
    },250);
    const handleOffline=()=>markConnectionFailure();
    const handleOnline=()=>{
      setConnectionState("reconnecting");
      void syncClock();
    };
    window.addEventListener("offline",handleOffline);
    window.addEventListener("online",handleOnline);

    return()=>{
      window.clearInterval(tickId);
      window.clearInterval(resyncId);
      window.clearInterval(connectionMonitorId);
      window.removeEventListener("offline",handleOffline);
      window.removeEventListener("online",handleOnline);
      if(soldNoticeTimerRef.current!==null)window.clearTimeout(soldNoticeTimerRef.current);
    };
  // D25-D28 use only the server-issued browser-session demo endpoint; auctionAuthority remains false.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const current=lots[active];
  const next=lots[(active+1)%lots.length];
  const sold=useMemo(()=>lots.filter((_,i)=>i<active),[active]);
  const price=prices[current.lot]??current.price;
  const bid=async()=>{
    if(connectionState!=="connected")return;
    const TAB_LEASE_KEY="enchev-live-auction-active-tab-v1";
    try{
      const lease=JSON.parse(localStorage.getItem(TAB_LEASE_KEY)??"null") as {tabId?:string;heartbeat?:number}|null;
      const mine=sessionStorage.getItem("enchev-live-tab-id");
      if(lease?.tabId&&mine&&lease.tabId!==mine&&typeof lease.heartbeat==="number"&&Date.now()-lease.heartbeat<5000)return;
    }catch{return;}
    const bidLot=current;
    const sentAt=Date.now();
    try{
      const response=await fetch("/api/live-auction-clock",{
        method:"POST",
        cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"bid"}),
      });
      if(!response.ok)return;
      const data=await response.json() as LiveClockPayload;
      const applied=applyClock(data,sentAt,Date.now());
      if(!applied||data.lotId!==bidLot.lot)return;

      const feedback=data.bidFeedback??null;
      const delta=Number.isFinite(data.priceDelta)?Number(data.priceDelta):0;
      setBidFeedback(feedback);
      if(delta!==0){
        setPrices(p=>({...p,[bidLot.lot]:(p[bidLot.lot]??bidLot.price)+delta}));
        setBidFlash(true);
        window.setTimeout(()=>setBidFlash(false),650);
      }
    }catch{
      markConnectionFailure();
    }
  };
  const connectionLabel=connectionState==="connected"?"CONNECTED":connectionState==="reconnecting"?"RECONNECTING":connectionState==="stale"?"STALE DATA":"SYNCING";
  const connectionDetail=connectionState==="connected"?`Synced ${connectionAgeSeconds}s ago`:connectionState==="reconnecting"?"Restoring demo server connection":connectionState==="stale"?`No fresh demo snapshot for ${connectionAgeSeconds}s`:"Waiting for demo server";
  const fmt=(v:number)=>`00:${String(v).padStart(2,"0")}`;

  return <main id="main-content" className="livePage">
    <div className="liveUtility"><span><i/> ENCHEV LIVE NETWORK</span><span>Server-session demo · 10 sec per lot</span></div>
    <header className="liveHeader">
      <a href="/" className="liveLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav><a href="/inventory">Inventory</a><a className="active" href="/live-auctions">Live auctions</a><a href="/transport">Transport</a><a href="/platform#how">How to buy</a></nav>
      <div><button type="button">Log in</button><button type="button" className="liveRegister">Register</button></div>
    </header>

    <section className="liveHero">
      <div><span className="liveEyebrow">● LIVE AUCTION ROOM</span><h1>Live auctions</h1><span className="liveHeroMobileLead">Vehicle previews · Live demo timer · Two-step demo bids</span><p>Demo-only auction: the server-session clock controls each 10-second lot round. A confirmed demo bid updates the session state; prices and outcomes are illustrative, not real-money transactions.</p></div>
      <div className="liveHeroStatusStack">
        <div
          className={`liveConnectionState is-${connectionState}`}
          data-design-task="D28"
          data-connection-state={connectionState}
          data-auction-authority="false"
          role="status"
          aria-live="polite"
        >
          <i aria-hidden="true"/>
          <div><b>{connectionLabel}</b><small>{connectionDetail}</small></div>
        </div>
        <div className="liveHeroClock" data-design-task="D25" data-clock-mode={clockMode} data-auction-authority="false" role="timer" aria-label={`Remaining ${remaining} seconds for lot ${current.lot}`}><small>{clockMode==="server"?"SERVER SYNC":"SYNCING"}</small><b>{fmt(remaining)}</b><span>LOT {current.lot}</span></div>
      </div>
    </section>

    <ProfessionalLiveAuctionUx
      lots={lots}
      active={active}
      remaining={remaining}
      prices={prices}
      bidFeedback={bidFeedback}
      connectionState={connectionState}
      connectionAgeSeconds={connectionAgeSeconds}
      lastRttMs={lastRttMs}
      onBid={bid}
      onResync={syncClock}
    />

    <section className="liveStage" data-design-task="D24" data-auto-advance-task="D26" aria-label="Live auction room: current and next demo lots">
      <div className="liveVisual" data-live-slot="current" data-lot-id={current.lot} aria-labelledby="live-current-lot-title">
        <img src={current.image} alt={current.title}/>
        {current.lot==="EA-10603"&&<a className="liveDemoPhotoCredit" href={GOLF_GTI_DEMO_PHOTO_CREDIT} target="_blank" rel="noopener noreferrer">Illustrative GTI photo · David Moffatt / Unsplash ↗</a>}

        <div className="liveVisualShade"/>
        <span className="liveStatus"><i/> LIVE</span>
        {soldNotice&&<div className="liveSoldTransition" data-design-task="D26" data-sold-lot={soldNotice} role="status" aria-live="polite"><b>SOLD · LOT {soldNotice}</b><span>Next demo lot active</span></div>}
        {bidFlash&&<div className="liveNewBid">NEW BID</div>}
        <div className="liveRing" data-clock-mode={clockMode}><strong>{remaining}</strong><small>SEC</small></div>
        <div className="liveVisualInfo"><span>CURRENT LOT · {current.lot}</span><h2 id="live-current-lot-title">{current.title}</h2><p>{current.location} · {current.damage} · {current.mileage}</p></div>
      </div>

      <aside className="liveBidPanel" aria-label="Demo bidding and next lot">
        <div className="liveBidTop"><span>CURRENT BID</span><b>€{price.toLocaleString("bg-BG")}</b></div>
        <div className="liveBidMeta"><div><span>Next bid</span><b>€{(price+100).toLocaleString("bg-BG")}</b></div><div><span>Remaining</span><b>{fmt(remaining)}</b></div></div>
        <div
          className={`liveBidFeedback ${bidFeedback?`is-${bidFeedback}`:"is-idle"}`}
          data-design-task="D27"
          data-bid-feedback={bidFeedback??"idle"}
          data-auction-authority="false"
          role="status"
          aria-live="polite"
        >
          <b>{bidFeedback==="accepted"?"DEMO BID ACCEPTED":bidFeedback==="leading"?"LEADING (DEMO)":bidFeedback==="outbid"?"OUTBID (DEMO)":bidFeedback==="rejected"?"DEMO BID REJECTED":"READY FOR DEMO BID"}</b>
          <span>{bidFeedback==="accepted"?"Demo server accepted this bid.":bidFeedback==="leading"?"Demo server confirms the leading bid.":bidFeedback==="outbid"?"A higher demo bid is active.":bidFeedback==="rejected"?"Demo server rejected the bid without changing the price.":"Demo results come from server session state."}</span>
        </div>
        <button className="liveBidButton" type="button" onClick={()=>document.querySelector(".proLiveBidDock")?.scrollIntoView({behavior:"smooth",block:"center"})}>Go to demo bidding <span>↓</span></button>
        <a className="liveLotLink" href={`/lot/${current.lot}`}>Open lot details</a>
        <span className="liveMobileDemoDisclaimer">DEMO MODE · No real-money bidding or payments</span>

        <section className="liveNextPreview" data-live-slot="next" data-lot-id={next.lot} aria-labelledby="live-next-lot-title">
          <div className="liveNextPreviewHead"><span>NEXT LOT</span><small>Starts after current lot</small></div>
          <a className="liveNextPreviewCard" href={`/lot/${next.lot}`}>
            <img src={next.image} alt=""/>
            <div>
              <span>LOT {next.lot}</span>
              <h3 id="live-next-lot-title">{next.title}</h3>
              <p>{next.location} · {next.damage}</p>
              <b>Starts €{(prices[next.lot]??next.price).toLocaleString("bg-BG")}</b>
            </div>
          </a>
        </section>

        <div className="liveRule"><b>How it works</b><p>Demo the bid is confirmed through the server-session endpoint. The server returns accepted / leading / outbid / rejected feedback and a price change, while the interface only displays the result. This remains an auctionAuthority=false demo state.</p></div>
      </aside>
    </section>

    <section className="liveQueue">
      <div className="liveSectionHead"><div><span>AUCTION QUEUE</span><h2>Upcoming lots</h2></div><a href="/inventory">All vehicles →</a></div>
      <div className="liveQueueGrid">
        <article className="liveQueueCard next"><img src={next.image} alt={next.title}/><div><span>NEXT LOT · {next.lot}</span><h3>{next.title}</h3><p>{next.location}</p><b>Starts €{(prices[next.lot]??next.price).toLocaleString("bg-BG")}</b></div></article>
        {lots.filter((_,i)=>i!==active&&i!==(active+1)%lots.length).slice(0,2).map(x=><article className="liveQueueCard" key={x.lot}><img src={x.image} alt={x.title}/><div><span>UPCOMING · {x.lot}</span><h3>{x.title}</h3><p>{x.location}</p><b>€{(prices[x.lot]??x.price).toLocaleString("bg-BG")}</b></div></article>)}
      </div>
    </section>

    <div className="liveMobileActionBar" aria-label="Demo bid quick access">
      <div className="liveMobileActionPrice"><span>CURRENT DEMO BID</span><strong>€{price.toLocaleString("bg-BG")}</strong></div>
      <button type="button" onClick={()=>document.querySelector(".proLiveBidDock")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"})}>Bid options <span aria-hidden="true">↓</span></button>
    </div>

    {sold.length>0&&<section className="liveSold"><div className="liveSectionHead"><div><span>ENDED</span><h2>Completed demo lots</h2></div></div><div className="liveSoldGrid">{sold.map(x=><a href={`/lot/${x.lot}`} key={x.lot}><img src={x.image} alt={x.title}/><div><span>SOLD · {x.lot}</span><b>{x.title}</b></div></a>)}</div></section>}
  </main>;
}
