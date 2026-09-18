"use client";

import { useMemo, useState } from "react";
import "./watchlist.css";

type SavedVehicle = {
  lot: string;
  title: string;
  location: string;
  damage: string;
  bid: number;
  state: "LIVE" | "UPCOMING" | "BUY NOW";
  image: string;
};

const initialVehicles: SavedVehicle[] = [
  {
    lot: "EA-10539",
    title: "2022 Audi RS3 Sportback",
    location: "Crewe, UK",
    damage: "Minor scratches",
    bid: 21900,
    state: "LIVE",
    image: "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1100&q=84",
  },
  {
    lot: "EA-10627",
    title: "2020 BMW X5 xDrive40i",
    location: "Texas, USA",
    damage: "Rear end",
    bid: 15100,
    state: "UPCOMING",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1100&q=84",
  },
  {
    lot: "EA-10603",
    title: "2026 Volkswagen Golf GTI",
    location: "London, UK",
    damage: "Clean title",
    bid: 16250,
    state: "BUY NOW",
    image: "https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1100&q=84",
  },
];

export default function WatchlistPanel(){
  const [saved,setSaved]=useState(initialVehicles);
  const liveCount=useMemo(()=>saved.filter(vehicle=>vehicle.state==="LIVE").length,[saved]);

  const remove=(lot:string)=>{
    setSaved(current=>current.filter(vehicle=>vehicle.lot!==lot));
  };

  return <section id="watchlist" className="profileWatchlist" data-design-task="D29" aria-labelledby="watchlist-heading">
    <div className="profileWatchlistHead">
      <div>
        <span className="profileWatchlistKicker">WATCHLIST</span>
        <h2 id="watchlist-heading">Запазени автомобили</h2>
        <p>Следи лотовете, които искаш да сравниш или да отвориш отново преди търга.</p>
      </div>
      <div className="profileWatchlistSummary" aria-live="polite">
        <strong>{saved.length}</strong>
        <span>запазени</span>
        <small>{liveCount} LIVE</small>
      </div>
    </div>

    {saved.length>0 ? <div className="profileWatchlistGrid">
      {saved.map(vehicle=><article className="profileWatchlistCard" key={vehicle.lot} data-auction-state={vehicle.state.toLowerCase().replace(" ","-")}>
        <div className="profileWatchlistMedia">
          <img src={vehicle.image} alt={vehicle.title}/>
          <span className="profileWatchlistState">{vehicle.state}</span>
          <button
            type="button"
            className="profileWatchlistRemove"
            aria-label={`Премахни ${vehicle.title} от запазени`}
            onClick={()=>remove(vehicle.lot)}
          >
            ×
          </button>
        </div>
        <div className="profileWatchlistBody">
          <span className="profileWatchlistLot">LOT {vehicle.lot}</span>
          <h3>{vehicle.title}</h3>
          <dl className="profileWatchlistFacts">
            <div><dt>Локация</dt><dd>{vehicle.location}</dd></div>
            <div><dt>Състояние</dt><dd>{vehicle.damage}</dd></div>
          </dl>
          <div className="profileWatchlistBid">
            <span>{vehicle.state==="BUY NOW" ? "Цена" : "Текуща ставка"}</span>
            <strong>€{vehicle.bid.toLocaleString("bg-BG")}</strong>
          </div>
          <div className="profileWatchlistActions">
            <a href={`/lot/${vehicle.lot}`}>Отвори лота</a>
            <a href="/live-auctions">LIVE зала</a>
          </div>
        </div>
      </article>)}
    </div> : <div className="profileWatchlistEmpty" role="status">
      <span>☆</span>
      <h3>Няма запазени автомобили</h3>
      <p>Добави лотове от инвентара и те ще се появяват тук.</p>
      <a href="/inventory">Отвори инвентара</a>
    </div>}
  </section>;
}
