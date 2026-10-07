"use client";

import { FormEvent, useState } from "react";
import "./vehicle-history.css";

export default function VehicleHistoryPage(){
  const [vin,setVin]=useState("");
  const [checkedVin,setCheckedVin]=useState("");
  const submit=(e:FormEvent)=>{e.preventDefault();setCheckedVin(vin.trim().toUpperCase());};

  return <main id="main-content" className="historyPage">
    <header className="historyHeader"><a href="/" className="historyLogo"><strong>ENCHEV</strong><span>АУКЦИОНИ</span></a><nav><a href="/inventory">Инвентар</a><a href="/live-auctions">LIVE търгове</a><a href="/transport">Транспорт</a><a className="active" href="/vehicle-history">История на МПС</a></nav><div><button>Вход</button><button className="historyGreen">Регистрация</button></div></header>

    <section className="historyHero"><div><span>ИНТЕЛИГЕНТНА ПРОВЕРКА ENCHEV</span><h1>Провери историята преди да наддаваш</h1><p>VIN, регистрационен статус, известни щети, пробег и аукционни записи на едно място. Текущият екран е демонстрационен интерфейс; реалните отчети ще се свържат към външен доставчик на данни.</p></div><form className="historySearch" onSubmit={submit}><label>VIN номер<input value={vin} onChange={e=>setVin(e.target.value)} placeholder="Напр. WAUZZZ8V5KA123456" maxLength={24}/></label><button type="submit">Провери VIN →</button><small>Демонстрационен режим · не извършва реална VIN справка</small></form></section>

    {checkedVin&&<section className="historyDemoResult"><div className="historyResultHead"><div><span>ДЕМОНСТРАЦИОНЕН ОТЧЕТ</span><h2>{checkedVin}</h2></div><b>ПРИМЕРЕН ОТЧЕТ</b></div><div className="historyScoreGrid"><article><span>Документ</span><b>Чист / провери източника</b><small>Данните са примерни</small></article><article><span>Пробег</span><b>41 280 km</b><small>Последно демонстрационно събитие</small></article><article><span>Щети</span><b>Леки драскотини</b><small>Демонстрационен аукционен запис</small></article><article><span>Собственици</span><b>2 записа</b><small>Примерни данни</small></article></div><div className="historyTimeline"><div><i/><span>2026</span><b>Поява в аукцион</b><p>Демонстрационен аукционен запис · козметични щети</p></div><div><i/><span>2024</span><b>Сервизен запис</b><p>Демонстрационно сервизно събитие</p></div><div><i/><span>2022</span><b>Първа регистрация</b><p>Демонстрационно регистрационно събитие</p></div></div></section>}

    <section className="historyFeatures"><div className="historySectionHead"><span>КАКВО ЩЕ ПОКАЗВА ОТЧЕТЪТ</span><h2>Данни, които помагат при покупка</h2></div><div className="historyFeatureGrid"><article><b>VIN и идентификация</b><p>Марка, модел, година, двигател и заводска конфигурация.</p></article><article><b>Документ / регистрационен статус</b><p>Чист, за възстановяване, възстановен и други статуси според наличния източник.</p></article><article><b>Щети и аукционни събития</b><p>Известни записи за щети, снимки и предишни аукционни участия, когато са налични.</p></article><article><b>Пробег</b><p>История на отчетения пробег и сигнали за несъответствия.</p></article><article><b>Собственост / регистрация</b><p>Регистрационни събития според държавата и източника на данните.</p></article><article><b>Рискови сигнали</b><p>Ясни предупреждения при липсваща, спорна или несъвпадаща информация.</p></article></div></section>

    <section className="historyCta"><div><span>ВЕЧЕ ИМАШ ЛОТ?</span><h2>Провери автомобила и отвори аукционните му детайли.</h2></div><a href="/inventory">Към инвентара →</a></section>
  </main>;
}
