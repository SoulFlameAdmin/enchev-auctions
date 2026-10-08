"use client";

import { useMemo, useState } from "react";
import "./transport.css";

const baseByOrigin:Record<string,number>={"Europe":780,"East Coast USA":1650,"West Coast USA":2150,"Canada":1850};
const typeExtra:Record<string,number>={"Sedan":0,"SUV":180,"Pickup":260,"EV":120};

export default function TransportPage(){
  const [origin,setOrigin]=useState("East Coast USA");
  const [vehicle,setVehicle]=useState("Sedan");
  const [destination,setDestination]=useState("София");
  const estimate=useMemo(()=>baseByOrigin[origin]+typeExtra[vehicle]+(destination==="Варна"?120:destination==="Сливен"?90:0),[origin,vehicle,destination]);

  return <main id="main-content" className="transportPage">
    <header className="transportHeader"><a href="/" className="transportLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a><nav><a href="/inventory">Inventory</a><a href="/live-auctions">Live auctions</a><a className="active" href="/transport">Transport</a><a href="/platform#how">How to Buy</a></nav><div><button>Вход</button><button className="transportGreen">Register</button></div></header>

    <section className="transportHero"><div><span>ENCHEV SHIPPING</span><h1>Transport from the auction to Bulgaria</h1><p>One flow for yard pickup, inland transport, port handling, international shipping and delivery to your selected city.</p><div className="transportHeroActions"><a href="#calculator">Calculate estimate</a><a className="ghost" href="/inventory">Select vehicle</a></div></div><div className="transportRouteCard"><div><span>01</span><b>Auction yard</b></div><i>→</i><div><span>02</span><b>Port / terminal</b></div><i>→</i><div><span>03</span><b>Bulgaria</b></div><i>→</i><div><span>04</span><b>To address</b></div></div></section>

    <section className="transportTrust"><div><b>Tracking</b><span>Delivery stage status</span></div><div><b>Documents</b><span>Centralized transport documents</span></div><div><b>Insurance</b><span>Option based on route and carrier</span></div><div><b>Поддръжка</b><span>One client contact point</span></div></section>

    <section className="transportCalculator" id="calculator"><div className="transportCalcCopy"><span>ESTIMATE CALCULATOR</span><h2>Check route and budget</h2><p>This is a demo calculator for the interface. The final quote will come from real transport partners and the specific LOT.</p><div className="transportSteps"><div><b>1</b><span>Choose a vehicle</span></div><div><b>2</b><span>We receive the pickup location</span></div><div><b>3</b><span>We calculate the real route</span></div><div><b>4</b><span>You confirm transport</span></div></div></div><div className="transportCalcCard"><label>Origin<select value={origin} onChange={e=>setOrigin(e.target.value)}>{Object.keys(baseByOrigin).map(x=><option key={x}>{x}</option>)}</select></label><label>Vehicle type<select value={vehicle} onChange={e=>setVehicle(e.target.value)}>{Object.keys(typeExtra).map(x=><option key={x}>{x}</option>)}</select></label><label>Destination<select value={destination} onChange={e=>setDestination(e.target.value)}><option>София</option><option>Варна</option><option>Сливен</option></select></label><div className="transportEstimate"><span>Demo estimate</span><b>от €{estimate.toLocaleString("bg-BG")}</b><small>Без мита, местни такси и специфични LOT разходи.</small></div><a href="/inventory">Намери автомобил →</a></div></section>

    <section className="transportFlow"><div className="transportSectionHead"><span>VEHICLE JOURNEY</span><h2>From yard to customer</h2></div><div className="transportFlowGrid"><article><span>01</span><h3>Pickup</h3><p>The vehicle is collected from the auction yard after lot release.</p></article><article><span>02</span><h3>Inland transport</h3><p>Transport to a port, terminal or European hub depending on the country.</p></article><article><span>03</span><h3>International shipping</h3><p>Container, RoRo or road transport depending on the vehicle and route.</p></article><article><span>04</span><h3>Delivery</h3><p>Arrival in Bulgaria and final-mile delivery to the selected city or address.</p></article></div></section>

    <section className="transportFaq"><div className="transportSectionHead"><span>FAQ</span><h2>What you need to know</h2></div><div className="transportFaqGrid"><details open><summary>How long does it take?</summary><p>It depends on the country, yard, transport type and schedule. The real ETA will be shown for the specific LOT.</p></details><details><summary>Is the price fixed?</summary><p>No. Demo the calculator is an estimate. The final price depends on pickup location, dimensions, port, carrier and additional fees.</p></details><details><summary>Will I see the status?</summary><p>Yes — the planned ENCHEV flow includes pickup, transit, port, shipped, arrived and delivered statuses.</p></details></div></section>
  </main>;
}
