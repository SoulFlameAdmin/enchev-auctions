"use client";

import { FormEvent, useState } from "react";
import "./vehicle-history.css";

export default function VehicleHistoryPage(){
  const [vin,setVin]=useState("");
  const [checkedVin,setCheckedVin]=useState("");
  const submit=(e:FormEvent)=>{e.preventDefault();setCheckedVin(vin.trim().toUpperCase());};

  return <main id="main-content" className="historyPage">
    <header className="historyHeader"><a href="/" className="historyLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a><nav><a href="/inventory">Inventory</a><a href="/live-auctions">Live auctions</a><a href="/transport">Transport</a><a className="active" href="/vehicle-history">Vehicle History</a></nav><div><button>Вход</button><button className="historyGreen">Register</button></div></header>

    <section className="historyHero"><div><span>ENCHEV VEHICLE INTELLIGENCE</span><h1>Check the history before you bid</h1><p>VIN, title status, known damage, mileage and auction records in one place. The current screen is a demo interface; real reports will connect to an external data provider.</p></div><form className="historySearch" onSubmit={submit}><label>VIN номер<input value={vin} onChange={e=>setVin(e.target.value)} placeholder="Напр. WAUZZZ8V5KA123456" maxLength={24}/></label><button type="submit">Check VIN →</button><small>Demo mode · does not perform a real VIN lookup</small></form></section>

    {checkedVin&&<section className="historyDemoResult"><div className="historyResultHead"><div><span>DEMO REPORT</span><h2>{checkedVin}</h2></div><b>ПРИМЕРЕН ОТЧЕТ</b></div><div className="historyScoreGrid"><article><span>Title</span><b>Clean / verify source</b><small>Данните са примерни</small></article><article><span>Mileage</span><b>41 280 km</b><small>Последно demo събитие</small></article><article><span>Щети</span><b>Minor scratches</b><small>Аукционен demo запис</small></article><article><span>Собственици</span><b>2 records</b><small>Примерни данни</small></article></div><div className="historyTimeline"><div><i/><span>2026</span><b>Поява в аукцион</b><p>Demo auction record · cosmetic damage</p></div><div><i/><span>2024</span><b>Сервизен запис</b><p>Demo maintenance event</p></div><div><i/><span>2022</span><b>Първа регистрация</b><p>Demo registration event</p></div></div></section>}

    <section className="historyFeatures"><div className="historySectionHead"><span>WHAT THE REPORT WILL SHOW</span><h2>Data that helps with buying</h2></div><div className="historyFeatureGrid"><article><b>VIN & identification</b><p>Make, model, year, engine and factory configuration.</p></article><article><b>Title / registration status</b><p>Clean, salvage, rebuilt and other statuses depending on the available source.</p></article><article><b>Damage and auction events</b><p>Known damage records, photos and previous auction appearances when available.</p></article><article><b>Mileage</b><p>Reported mileage history and inconsistency flags.</p></article><article><b>Ownership / registration</b><p>Registration events based on country and data source.</p></article><article><b>Risk flags</b><p>Clear warnings for missing, disputed or mismatched information.</p></article></div></section>

    <section className="historyCta"><div><span>ALREADY HAVE A LOT?</span><h2>Check the vehicle and open its auction details.</h2></div><a href="/inventory">Go to inventory →</a></section>
  </main>;
}
