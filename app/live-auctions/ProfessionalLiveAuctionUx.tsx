"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BidFeedback="accepted"|"leading"|"outbid"|"rejected";
type ConnectionState="syncing"|"connected"|"reconnecting"|"stale";
type Lot=Readonly<{lot:string;title:string;price:number}>;

type Props=Readonly<{
  lots:readonly Lot[];
  active:number;
  remaining:number;
  prices:Readonly<Record<string,number>>;
  bidFeedback:BidFeedback|null;
  connectionState:ConnectionState;
  connectionAgeSeconds:number;
  lastRttMs:number|null;
  onBid:()=>Promise<void>;
  onResync:()=>Promise<void>;
}>;

const TAB_LEASE_KEY="enchev-live-auction-active-tab-v1";
const TAB_LEASE_TTL_MS=5000;

function feedbackReason(feedback:BidFeedback|null){
  if(feedback==="accepted")return "Authoritative demo state accepted the bid.";
  if(feedback==="leading")return "Accepted — this tab is currently leading.";
  if(feedback==="outbid")return "A higher authoritative demo bid is now active.";
  if(feedback==="rejected")return "Rejected by authoritative demo state; the price was not changed.";
  return "No bid result yet.";
}

export default function ProfessionalLiveAuctionUx(props:Props){
  const current=props.lots[props.active];
  const next=props.lots[(props.active+1)%props.lots.length];
  const [focus,setFocus]=useState(false);
  const [armed,setArmed]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [readOnlyTab,setReadOnlyTab]=useState(false);
  const [tabId,setTabId]=useState("");
  const [lateExtension,setLateExtension]=useState(false);
  const previousRemainingRef=useRef(props.remaining);

  const dashboard=useMemo(()=>props.lots.map((lot,index)=>({
    ...lot,
    relation:index===props.active?"current":index<props.active?"passed":"upcoming",
    lotsAway:index>props.active?index-props.active:0,
  })),[props.lots,props.active]);

  const networkQuality=props.connectionState!=="connected"
    ? "OFFLINE / DEGRADED"
    : props.lastRttMs===null
      ? "SYNCING"
      : props.lastRttMs<=250?"EXCELLENT":props.lastRttMs<=750?"GOOD":"DEGRADED";

  useEffect(()=>{
    const previous=previousRemainingRef.current;
    if(previous<=3&&props.remaining>=6&&props.bidFeedback!==null&&props.bidFeedback!=="rejected"){
      setLateExtension(true);
      const id=window.setTimeout(()=>setLateExtension(false),3000);
      previousRemainingRef.current=props.remaining;
      return()=>window.clearTimeout(id);
    }
    previousRemainingRef.current=props.remaining;
  },[props.remaining,props.bidFeedback]);

  useEffect(()=>{
    const id=sessionStorage.getItem("enchev-live-tab-id")??crypto.randomUUID();
    sessionStorage.setItem("enchev-live-tab-id",id);
    setTabId(id);
    const beat=()=>{
      const now=Date.now();
      let owner:{tabId:string;heartbeat:number}|null=null;
      try{owner=JSON.parse(localStorage.getItem(TAB_LEASE_KEY)??"null") as {tabId:string;heartbeat:number}|null;}catch{owner=null;}
      if(!owner||now-owner.heartbeat>TAB_LEASE_TTL_MS||owner.tabId===id){
        localStorage.setItem(TAB_LEASE_KEY,JSON.stringify({tabId:id,heartbeat:now}));
        setReadOnlyTab(false);
      }else{
        setReadOnlyTab(true);
      }
    };
    beat();
    const interval=window.setInterval(beat,1500);
    const storage=()=>beat();
    window.addEventListener("storage",storage);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener("storage",storage);
      try{
        const owner=JSON.parse(localStorage.getItem(TAB_LEASE_KEY)??"null") as {tabId:string}|null;
        if(owner?.tabId===id)localStorage.removeItem(TAB_LEASE_KEY);
      }catch{}
    };
  },[]);

  const safeToBid=props.connectionState==="connected"&&!readOnlyTab&&!submitting;
  const confirmBid=async()=>{
    if(!safeToBid)return;
    if(!armed){setArmed(true);return;}
    setSubmitting(true);
    try{await props.onBid();}
    finally{setSubmitting(false);setArmed(false);}
  };

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(!focus||readOnlyTab)return;
      const tag=(event.target as HTMLElement|null)?.tagName?.toLowerCase();
      if(tag==="input"||tag==="textarea"||tag==="select")return;
      if((event.key.toLowerCase()==="b"||event.key===" ")&&!armed&&safeToBid){
        event.preventDefault();setArmed(true);
      }else if(event.key==="Enter"&&armed&&safeToBid){
        event.preventDefault();void confirmBid();
      }else if(event.key==="Escape"&&armed){
        event.preventDefault();setArmed(false);
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[focus,readOnlyTab,armed,safeToBid]);

  const connectionBanner=props.connectionState==="connected"
    ? null
    : props.connectionState==="stale"
      ? "STALE STATE — authoritative resync required before bidding."
      : props.connectionState==="reconnecting"
        ? "CONNECTION LOST — automatic reconnect in progress; bidding paused."
        : "Synchronizing authoritative server state.";

  return <section className={`proLiveUx ${focus?"is-focus":""}`} aria-label="Professional live-auction controls" data-phase="36">
    <div className="proLiveTop" data-phase-task="36.01">
      <div><span>PRO BIDDER MODE</span><b>{focus?"FOCUS ACTIVE":"STANDARD VIEW"}</b></div>
      <button type="button" onClick={()=>setFocus(x=>!x)} aria-pressed={focus}>{focus?"Exit focus":"Enter focus"}</button>
    </div>

    {connectionBanner&&<div className={`proLiveBanner is-${props.connectionState}`} role="alert" data-phase-task="36.08">
      <b>{connectionBanner}</b>
      <button type="button" onClick={()=>void props.onResync()} data-phase-task="36.11">Hard resync</button>
    </div>}

    <div className="proLiveStatusGrid">
      <div data-phase-task="36.06"><span>SERVER TIME</span><b>{props.connectionState==="connected"?"SYNCED":"VERIFYING"}</b><small>{props.lastRttMs===null?"RTT pending":`RTT ${props.lastRttMs} ms`}</small></div>
      <div data-phase-task="36.07"><span>NETWORK</span><b>{networkQuality}</b><small>sync age {props.connectionAgeSeconds}s</small></div>
      <div data-phase-task="36.09"><span>RECONNECT</span><b>{props.connectionState==="reconnecting"?"RETRYING":props.connectionState==="stale"?"RESYNC REQUIRED":"READY"}</b><progress max={5} value={Math.min(5,props.connectionAgeSeconds)} /></div>
      <div data-phase-task="36.10"><span>AUTHORITY</span><b>SERVER SNAPSHOT</b><small>client display only</small></div>
      <div data-phase-task="36.16"><span>TAB OWNERSHIP</span><b>{readOnlyTab?"READ ONLY":"ACTIVE BIDDER"}</b><small>{tabId?tabId.slice(0,8):"initializing"}</small></div>
    </div>

    <div className="proLiveNowNext" data-phase-task="36.03">
      <article><span>CURRENT LOT</span><b>{current.lot}</b><strong>{current.title}</strong></article>
      <article><span>NEXT LOT</span><b>{next.lot}</b><strong>{next.title}</strong></article>
    </div>

    <div className="proLiveDashboard" data-phase-task="36.02">
      {dashboard.map((lot,index)=><article key={lot.lot} className={`is-${lot.relation}`}>
        <span>{lot.relation.toUpperCase()}</span>
        <b>{lot.lot}</b>
        <strong>{lot.title}</strong>
        <small data-phase-task="36.04">LANE {index+1}</small>
        <small data-phase-task="36.05">{lot.relation==="upcoming"?`${lot.lotsAway} LOTS AWAY`:lot.relation==="current"?"NOW":"PASSED"}</small>
        <em>€{(props.prices[lot.lot]??lot.price).toLocaleString("bg-BG")}</em>
      </article>)}
    </div>

    <div className="proLiveBidDock" data-phase-task="36.12">
      <div>
        <span>{armed?"CONFIRM BID":"NEXT BID"}</span>
        <b>€{((props.prices[current.lot]??current.price)+100).toLocaleString("bg-BG")}</b>
        <small>{readOnlyTab?"Another tab owns bidding":props.connectionState!=="connected"?"Waiting for safe server state":armed?"Press Enter or confirm again":"B / Space arms · Enter confirms"}</small>
      </div>
      <button type="button" disabled={!safeToBid} onClick={()=>void confirmBid()}>
        {submitting?"Submitting…":armed?"Confirm bid":"Arm bid"}
      </button>
    </div>

    <div className={`proLiveResult is-${props.bidFeedback??"idle"}`} role="status" aria-live="polite" data-phase-task="36.13">
      <b>{props.bidFeedback?.toUpperCase()??"READY"}</b><span>{feedbackReason(props.bidFeedback)}</span>
    </div>
    {props.bidFeedback==="outbid"&&<div className="proLiveOutbid" role="alert" data-phase-task="36.14">OUTBID — review the new authoritative price before bidding again.</div>}
    {lateExtension&&<div className="proLiveExtension" role="status" aria-live="assertive" data-phase-task="36.15">LATE BID EXTENSION — timer extended by server state.</div>}

    <div className="proLiveKeyboard" data-phase-task="36.17">Keyboard: <kbd>B</kbd>/<kbd>Space</kbd> arm · <kbd>Enter</kbd> confirm · <kbd>Esc</kbd> cancel</div>
    <div className="proLiveMobileMarker" data-phase-task="36.18">Responsive bidder layout enabled</div>
    <div className="srOnly" aria-live="polite" aria-atomic="true" data-phase-task="36.19">
      {connectionBanner??`Connected. Current lot ${current.lot}. ${props.remaining} seconds remaining. ${feedbackReason(props.bidFeedback)}`}
    </div>
    <div className="srOnly" data-phase-task="36.20">Same-account devices must converge to authoritative snapshot sequence.</div>
  </section>;
}
