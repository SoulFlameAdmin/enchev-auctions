"use client";

import { useMemo, useState } from "react";
import "./my-auctions.css";

type AuctionState = "watching" | "bidding" | "leading" | "ended";

type AuctionItem = {
  lot: string;
  title: string;
  location: string;
  state: AuctionState;
  stateLabel: string;
  bid: number;
  note: string;
  image: string;
};

const tabs: { key: "all" | AuctionState; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "watching", label: "Следя" },
  { key: "bidding", label: "Наддавам" },
  { key: "leading", label: "Водя" },
  { key: "ended", label: "Приключили" },
];

const items: AuctionItem[] = [
  {
    lot: "EA-10539",
    title: "2022 Audi RS3 Sportback",
    location: "Crewe, UK",
    state: "leading",
    stateLabel: "ВОДИШ",
    bid: 21900,
    note: "Твоята оферта е най-висока",
    image: "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1000&q=84",
  },
  {
    lot: "EA-10511",
    title: "2021 Mercedes-Benz GLC",
    location: "Munich, DE",
    state: "bidding",
    stateLabel: "НАДДАВАШ",
    bid: 18500,
    note: "Нужна е по-висока оферта",
    image: "https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1000&q=84",
  },
  {
    lot: "EA-10627",
    title: "2020 BMW X5 xDrive40i",
    location: "Texas, USA",
    state: "watching",
    stateLabel: "СЛЕДИШ",
    bid: 15100,
    note: "Още не си наддавал",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1000&q=84",
  },
  {
    lot: "EA-10488",
    title: "2019 Porsche Macan S",
    location: "Rotterdam, NL",
    state: "ended",
    stateLabel: "ПРИКЛЮЧИЛ",
    bid: 24700,
    note: "Търгът е приключил",
    image: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1000&q=84",
  },
];

export default function MyAuctionsPanel(){
  const [active,setActive]=useState<"all" | AuctionState>("all");
  const visible=useMemo(()=>active==="all" ? items : items.filter(item=>item.state===active),[active]);

  return <section className="myAuctions" data-design-task="D30" aria-labelledby="my-auctions-heading">
    <div className="myAuctionsHead">
      <div>
        <span className="myAuctionsKicker">MY AUCTIONS</span>
        <h2 id="my-auctions-heading">Моите търгове</h2>
        <p>Единен изглед за лотовете, които следиш, за които наддаваш, водиш или вече са приключили.</p>
      </div>
      <a href="/live-auctions" className="myAuctionsLiveLink">Отвори LIVE залата →</a>
    </div>

    <div className="myAuctionsTabs" role="group" aria-label="Филтър на моите търгове">
      {tabs.map(tab=><button
        key={tab.key}
        type="button"
        aria-pressed={active===tab.key}
        aria-controls="my-auctions-results"
        className={active===tab.key ? "active" : ""}
        onClick={()=>setActive(tab.key)}
      >
        {tab.label}
        <span>{tab.key==="all" ? items.length : items.filter(item=>item.state===tab.key).length}</span>
      </button>)}
    </div>

    <p className="myAuctionsResultStatus" id="my-auctions-result-status" role="status" aria-live="polite">{visible.length} {visible.length===1 ? "лот" : "лота"} в избрания изглед</p>
    <div className="myAuctionsList" id="my-auctions-results" aria-describedby="my-auctions-result-status">
      {visible.map(item=><article className="myAuctionRow" data-auction-state={item.state} key={item.lot}>
        <a className="myAuctionMedia" href={`/lot/${item.lot}`} aria-label={`Отвори ${item.title}`}>
          <img src={item.image} alt={item.title}/>
        </a>
        <div className="myAuctionMain">
          <span className="myAuctionLot">LOT {item.lot}</span>
          <h3><a href={`/lot/${item.lot}`}>{item.title}</a></h3>
          <p>{item.location}</p>
        </div>
        <div className="myAuctionState">
          <span>{item.stateLabel}</span>
          <small>{item.note}</small>
        </div>
        <div className="myAuctionBid">
          <span>{item.state==="ended" ? "Финална цена" : "Текуща ставка"}</span>
          <strong>€{item.bid.toLocaleString("bg-BG")}</strong>
        </div>
        <div className="myAuctionAction">
          <a href={item.state==="ended" ? `/lot/${item.lot}` : "/live-auctions"}>
            {item.state==="ended" ? "Детайли" : "Към търга"}
          </a>
        </div>
      </article>)}
    </div>
  </section>;
}
