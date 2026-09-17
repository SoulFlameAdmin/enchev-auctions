"use client";

import { useEffect, useState } from "react";

const LIVE_SECONDS = 10;
const CURRENT_BID = 21900;

export default function HomeLiveSpotlight(){
  const [remaining,setRemaining]=useState(LIVE_SECONDS);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setRemaining(value=>value<=1?LIVE_SECONDS:value-1);
    },1000);
    return()=>window.clearInterval(timer);
  },[]);

  const formattedTime=`00:${String(remaining).padStart(2,"0")}`;

  return <aside className="eaLiveCard" aria-label="LIVE търг spotlight">
    <div className="eaLiveTop">
      <span className="eaLivePill" role="status"><i/>ПРОДАВА СЕ НА ЖИВО</span>
      <small>LOT EA-10539</small>
    </div>
    <div className="eaLiveImage">
      <img src="https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=86" alt="2022 Audi RS3 Sportback"/>
      <div className="eaLiveOrb" aria-label={`LIVE таймер ${formattedTime}`}>
        <b>LIVE<br/>BID</b>
        <small aria-live="polite">{formattedTime}</small>
      </div>
    </div>
    <div className="eaLiveBody">
      <div className="eaLiveMeta"><span>LOT EA-10539</span><span>● LIVE · VERIFIED</span></div>
      <h3>2022 Audi RS3 Sportback</h3>
      <p>41 280 км · Minor scratches · Crewe, UK</p>
      <div className="eaLiveBid">
        <div><small>Текуща ставка</small><strong>€{CURRENT_BID.toLocaleString("bg-BG")}</strong></div>
        <a href="/live-auctions">Влез в търга →</a>
      </div>
    </div>
  </aside>;
}
