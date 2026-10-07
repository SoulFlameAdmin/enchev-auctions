"use client";

import { useEffect, useState } from "react";
import { getHomeHeroCopy, HOME_HERO_KEYS } from "../home-hero-messages";

const LIVE_SECONDS = 10;

export default function HomeLiveSpotlight(){
  const [remaining,setRemaining]=useState(LIVE_SECONDS);
  const copy=getHomeHeroCopy("bg-BG");

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setRemaining(value=>value<=1?LIVE_SECONDS:value-1);
    },1000);
    return()=>window.clearInterval(timer);
  },[]);

  const formattedTime=`00:${String(remaining).padStart(2,"0")}`;

  return <aside className="eaLiveCard" aria-label={copy.spotlightAria} data-i18n-key={HOME_HERO_KEYS.spotlightAria}>
    <div className="eaLiveTop">
      <span className="eaLivePill" role="status" data-i18n-key={HOME_HERO_KEYS.spotlightStatus}><i/>{copy.spotlightStatus}</span>
      <small>LOT EA-10539</small>
    </div>
    <div className="eaLiveImage">
      <img src="https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=86" alt="2022 Audi RS3 Sportback"/>
      <div className="eaLiveOrb" aria-label={`${copy.spotlightTimer} ${formattedTime}`} data-i18n-key={HOME_HERO_KEYS.spotlightTimer}>
        <b>LIVE<br/>LOT</b>
        <small aria-live="polite">{formattedTime}</small>
      </div>
    </div>
    <div className="eaLiveBody">
      <div className="eaLiveMeta"><span>LOT EA-10539</span><span data-i18n-key={HOME_HERO_KEYS.spotlightMeta}>● {copy.spotlightMeta}</span></div>
      <h3>2022 Audi RS3 Sportback</h3>
      <p data-i18n-key={HOME_HERO_KEYS.spotlightDetail}>{copy.spotlightDetail}</p>
      <div className="eaLiveBid eaLiveBid--context">
        <div><small>VIN / LOT</small><strong>EA-10539</strong></div>
        <a href="/live-auctions" data-i18n-key={HOME_HERO_KEYS.spotlightCta}>{copy.spotlightCta} →</a>
      </div>
    </div>
  </aside>;
}
