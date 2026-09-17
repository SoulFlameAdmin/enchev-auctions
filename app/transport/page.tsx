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

  return <main className="transportPage">
    <header className="transportHeader"><a href="/" className="transportLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a><nav><a href="/inventory">Инвентар</a><a href="/live-auctions">LIVE търгове</a><a className="active" href="/transport">Транспорт</a><a href="/#how">Как да купя</a></nav><div><button>Вход</button><button className="transportGreen">Регистрация</button></div></header>

    <section className="transportHero"><div><span>ENCHEV SHIPPING</span><h1>Транспорт от търга до България</h1><p>Един flow за вземане от площадката, вътрешен транспорт, пристанище, международен превоз и доставка до избран град.</p><div className="transportHeroActions"><a href="#calculator">Изчисли ориентировъчна цена</a><a className="ghost" href="/inventory">Избери автомобил</a></div></div><div className="transportRouteCard"><div><span>01</span><b>Аукционна площадка</b></div><i>→</i><div><span>02</span><b>Порт / терминал</b></div><i>→</i><div><span>03</span><b>България</b></div><i>→</i><div><span>04</span><b>До адрес</b></div></div></section>

    <section className="transportTrust"><div><b>Проследяване</b><span>Статус по етапи на доставката</span></div><div><b>Документи</b><span>Централизирани транспортни документи</span></div><div><b>Застраховане</b><span>Опция според маршрута и превозвача</span></div><div><b>Поддръжка</b><span>Един contact point за клиента</span></div></section>

    <section className="transportCalculator" id="calculator"><div className="transportCalcCopy"><span>ОРИЕНТИРОВЪЧЕН КАЛКУЛАТОР</span><h2>Провери маршрут и бюджет</h2><p>Това е demo калкулатор за интерфейса. Финалната оферта ще идва от реалните транспортни партньори и конкретния LOT.</p><div className="transportSteps"><div><b>1</b><span>Избираш автомобил</span></div><div><b>2</b><span>Получаваме pickup location</span></div><div><b>3</b><span>Изчисляваме реален маршрут</span></div><div><b>4</b><span>Потвърждаваш транспорта</span></div></div></div><div className="transportCalcCard"><label>Произход<select value={origin} onChange={e=>setOrigin(e.target.value)}>{Object.keys(baseByOrigin).map(x=><option key={x}>{x}</option>)}</select></label><label>Тип автомобил<select value={vehicle} onChange={e=>setVehicle(e.target.value)}>{Object.keys(typeExtra).map(x=><option key={x}>{x}</option>)}</select></label><label>Дестинация<select value={destination} onChange={e=>setDestination(e.target.value)}><option>София</option><option>Варна</option><option>Сливен</option></select></label><div className="transportEstimate"><span>Demo estimate</span><b>от €{estimate.toLocaleString("bg-BG")}</b><small>Без мита, местни такси и специфични LOT разходи.</small></div><a href="/inventory">Намери автомобил →</a></div></section>

    <section className="transportFlow"><div className="transportSectionHead"><span>ПЪТЯТ НА АВТОМОБИЛА</span><h2>От площадката до клиента</h2></div><div className="transportFlowGrid"><article><span>01</span><h3>Pickup</h3><p>Автомобилът се взема от аукционната площадка след освобождаване на лота.</p></article><article><span>02</span><h3>Вътрешен транспорт</h3><p>Превоз до порт, терминал или европейски хъб според държавата.</p></article><article><span>03</span><h3>Международен превоз</h3><p>Контейнер, RoRo или сухопътен транспорт според автомобила и маршрута.</p></article><article><span>04</span><h3>Доставка</h3><p>Пристигане в България и последна отсечка до избрания град или адрес.</p></article></div></section>

    <section className="transportFaq"><div className="transportSectionHead"><span>ЧЕСТИ ВЪПРОСИ</span><h2>Какво трябва да знаеш</h2></div><div className="transportFaqGrid"><details open><summary>Колко време отнема?</summary><p>Зависи от държавата, площадката, вида превоз и графика на транспорта. Реалният ETA ще се показва за конкретния LOT.</p></details><details><summary>Цената фиксирана ли е?</summary><p>Не. Demo калкулаторът е ориентир. Финалната цена зависи от pickup location, размери, порт, превозвач и допълнителни такси.</p></details><details><summary>Ще виждам ли статуса?</summary><p>Да — планираният ENCHEV flow включва статуси pickup, transit, port, shipped, arrived и delivered.</p></details></div></section>
  </main>;
}
