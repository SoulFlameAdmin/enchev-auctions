"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_WATCHLIST_EVENT, getDemoWatchlist, setDemoWatchlist, type DemoSavedVehicle } from "../components/demo-watchlist";
import "./watchlist.css";

export default function WatchlistPanel(){
  const [saved,setSaved]=useState<DemoSavedVehicle[]>([]);
  // Browser-local preview only: authenticated cross-device sync is still missing.
  useEffect(()=>{
    const sync=()=>setSaved(getDemoWatchlist());
    sync();
    window.addEventListener(DEMO_WATCHLIST_EVENT,sync);
    window.addEventListener("storage",sync);
    return()=>{
      window.removeEventListener(DEMO_WATCHLIST_EVENT,sync);
      window.removeEventListener("storage",sync);
    };
  },[]);
  const liveCount=useMemo(()=>saved.filter(vehicle=>vehicle.state==="LIVE").length,[saved]);

  const remove=(lot:string)=>{
    setSaved(current=>setDemoWatchlist(current.filter(vehicle=>vehicle.lot!==lot)));
  };

  return <section id="watchlist" className="profileWatchlist" data-design-task="D29" aria-labelledby="watchlist-heading">
    <div className="profileWatchlistHead">
      <div>
        <span className="profileWatchlistKicker">WATCHLIST</span>
        <h2 id="watchlist-heading">Saved vehicles</h2>
        <p>Track lots you want to compare or reopen before the auction. Preview watchlist saved on this device only.</p>
      </div>
      <div className="profileWatchlistSummary" aria-live="polite" data-saved-count={saved.length} data-live-count={liveCount}>
        <strong>{saved.length}</strong>
        <span>saved</span>
        <small>{liveCount} LIVE</small>
      </div>
    </div>

    {saved.length>0 ? <div className="profileWatchlistGrid">
      {saved.map(vehicle=><article className="profileWatchlistCard" key={vehicle.lot} data-lot-id={vehicle.lot} data-auction-state={vehicle.state.toLowerCase().replace(" ","-")}>
        <div className="profileWatchlistMedia">
          <img src={vehicle.image} alt={vehicle.title}/>
          <span className="profileWatchlistState">{vehicle.state}</span>
          <button
            type="button"
            className="profileWatchlistRemove"
            aria-label={`Премахни ${vehicle.title} от saved`}
            onClick={()=>remove(vehicle.lot)}
          >
            ×
          </button>
        </div>
        <div className="profileWatchlistBody">
          <span className="profileWatchlistLot">LOT {vehicle.lot}</span>
          <h3>{vehicle.title}</h3>
          <dl className="profileWatchlistFacts">
            <div><dt>Location</dt><dd>{vehicle.location}</dd></div>
            <div><dt>Condition</dt><dd>{vehicle.damage}</dd></div>
          </dl>
          <div className="profileWatchlistBid">
            <span>{vehicle.state==="BUY NOW" ? "Price" : "Current bid"}</span>
            <strong>€{vehicle.bid.toLocaleString("bg-BG")}</strong>
          </div>
          <div className="profileWatchlistActions">
            <a href={`/lot/${vehicle.lot}`}>Open lot</a>
            <a href="/live-auctions">LIVE room</a>
          </div>
        </div>
      </article>)}
    </div> : <div className="profileWatchlistEmpty" role="status">
      <span>☆</span>
      <h3>Няма saved автомобили</h3>
      <p>Добави лотове от инвентара и те ще се появяват тук.</p>
      <a href="/inventory">Open inventory</a>
    </div>}
  </section>;
}
