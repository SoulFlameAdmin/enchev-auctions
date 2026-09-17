"use client";

import { FormEvent, useState } from "react";
import "./vehicle-history.css";

export default function VehicleHistoryPage(){
  const [vin,setVin]=useState("");
  const [checkedVin,setCheckedVin]=useState("");
  const submit=(e:FormEvent)=>{e.preventDefault();setCheckedVin(vin.trim().toUpperCase());};

  return <main className="historyPage">
    <header className="historyHeader"><a href="/" className="historyLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a><nav><a href="/inventory">Инвентар</a><a href="/live-auctions">LIVE търгове</a><a href="/transport">Транспорт</a><a className="active" href="/vehicle-history">История на МПС</a></nav><div><button>Вход</button><button className="historyGreen">Регистрация</button></div></header>

    <section className="historyHero"><div><span>ENCHEV VEHICLE INTELLIGENCE</span><h1>Провери историята преди да наддаваш</h1><p>VIN, title status, известни щети, пробег и аукционни записи на едно място. Текущият екран е demo интерфейс; реалните отчети ще се свържат към външен data provider.</p></div><form className="historySearch" onSubmit={submit}><label>VIN номер<input value={vin} onChange={e=>setVin(e.target.value)} placeholder="Напр. WAUZZZ8V5KA123456" maxLength={24}/></label><button type="submit">Провери VIN →</button><small>Demo режим · не извършва реална VIN справка</small></form></section>

    {checkedVin&&<section className="historyDemoResult"><div className="historyResultHead"><div><span>DEMO REPORT</span><h2>{checkedVin}</h2></div><b>ПРИМЕРЕН ОТЧЕТ</b></div><div className="historyScoreGrid"><article><span>Title</span><b>Clean / verify source</b><small>Данните са примерни</small></article><article><span>Пробег</span><b>41 280 km</b><small>Последно demo събитие</small></article><article><span>Щети</span><b>Minor scratches</b><small>Аукционен demo запис</small></article><article><span>Собственици</span><b>2 records</b><small>Примерни данни</small></article></div><div className="historyTimeline"><div><i/><span>2026</span><b>Поява в аукцион</b><p>Demo auction record · cosmetic damage</p></div><div><i/><span>2024</span><b>Сервизен запис</b><p>Demo maintenance event</p></div><div><i/><span>2022</span><b>Първа регистрация</b><p>Demo registration event</p></div></div></section>}

    <section className="historyFeatures"><div className="historySectionHead"><span>КАКВО ЩЕ ПОКАЗВА ОТЧЕТЪТ</span><h2>Данни, които помагат при покупка</h2></div><div className="historyFeatureGrid"><article><b>VIN & идентификация</b><p>Марка, модел, година, двигател и factory configuration.</p></article><article><b>Title / регистрационен статус</b><p>Clean, salvage, rebuilt и други статуси според наличния източник.</p></article><article><b>Щети и аукционни събития</b><p>Известни damage записи, снимки и предишни аукционни участия, когато са налични.</p></article><article><b>Пробег</b><p>История на отчетения пробег и сигнали за несъответствия.</p></article><article><b>Ownership / registration</b><p>Регистрационни събития според държавата и източника на данните.</p></article><article><b>Risk flags</b><p>Ясни предупреждения при липсваща, спорна или несъвпадаща информация.</p></article></div></section>

    <section className="historyCta"><div><span>ВЕЧЕ ИМАШ ЛОТ?</span><h2>Провери автомобила и отвори аукционните му детайли.</h2></div><a href="/inventory">Към инвентара →</a></section>
  </main>;
}
