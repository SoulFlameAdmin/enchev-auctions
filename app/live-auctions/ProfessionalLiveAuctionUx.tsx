"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BidFeedback="accepted"|"leading"|"outbid"|"rejected";
type ConnectionState="syncing"|"connected"|"reconnecting"|"stale";
type Lot=Readonly<{lot:string;title:string;price:number}>;

type Props=Readonly<{
  lots:readonly Lot[];
  active:number;
  remaining:number;
  prices:Readonly<Record<string,number>>;
  bidFeedback:BidFeedback|null;
  connectionState:ConnectionState;
  connectionAgeSeconds:number;
  lastRttMs:number|null;
  onBid:()=>Promise<void>;
  onResync:()=>Promise<void>;
}>;

const TAB_LEASE_KEY="enchev-live-auction-active-tab-v1";
const TAB_LEASE_TTL_MS=5000;

function feedbackReason(feedback:BidFeedback|null){
  if(feedback==="accepted")return "Демонстрационното състояние на сървъра прие офертата.";
  if(feedback==="leading")return "Приета — този раздел в момента води.";
  if(feedback==="outbid")return "Вече има по-висока потвърдена демонстрационна оферта.";
  if(feedback==="rejected")return "Отхвърлена от демонстрационното състояние; цената не е променена.";
  return "Все още няма резултат от оферта.";
}

export default function ProfessionalLiveAuctionUx(props:Props){
  const current=props.lots[props.active];
  const next=props.lots[(props.active+1)%props.lots.length];
  const [focus,setFocus]=useState(false);
  const [armed,setArmed]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [readOnlyTab,setReadOnlyTab]=useState(false);
  const [tabId,setTabId]=useState("");
  const [lateExtension,setLateExtension]=useState(false);
  const previousRemainingRef=useRef(props.remaining);

  const dashboard=useMemo(()=>props.lots.map((lot,index)=>({
    ...lot,
    relation:index===props.active?"current":index<props.active?"passed":"upcoming",
    lotsAway:index>props.active?index-props.active:0,
  })),[props.lots,props.active]);

  const networkQuality=props.connectionState!=="connected"
    ? "ИЗВЪН ЛИНИЯ / ВЛОШЕНА ВРЪЗКА"
    : props.lastRttMs===null
      ? "СИНХРОНИЗИРАНЕ"
      : props.lastRttMs<=250?"ОТЛИЧНА":props.lastRttMs<=750?"ДОБРА":"ВЛОШЕНА";

  useEffect(()=>{
    const previous=previousRemainingRef.current;
    if(previous<=3&&props.remaining>=6&&props.bidFeedback!==null&&props.bidFeedback!=="rejected"){
      setLateExtension(true);
      const id=window.setTimeout(()=>setLateExtension(false),3000);
      previousRemainingRef.current=props.remaining;
      return()=>window.clearTimeout(id);
    }
    previousRemainingRef.current=props.remaining;
  },[props.remaining,props.bidFeedback]);

  useEffect(()=>{
    const id=sessionStorage.getItem("enchev-live-tab-id")??crypto.randomUUID();
    sessionStorage.setItem("enchev-live-tab-id",id);
    setTabId(id);
    const beat=()=>{
      const now=Date.now();
      let owner:{tabId:string;heartbeat:number}|null=null;
      try{owner=JSON.parse(localStorage.getItem(TAB_LEASE_KEY)??"null") as {tabId:string;heartbeat:number}|null;}catch{owner=null;}
      if(!owner||now-owner.heartbeat>TAB_LEASE_TTL_MS||owner.tabId===id){
        localStorage.setItem(TAB_LEASE_KEY,JSON.stringify({tabId:id,heartbeat:now}));
        setReadOnlyTab(false);
      }else{
        setReadOnlyTab(true);
      }
    };
    beat();
    const interval=window.setInterval(beat,1500);
    const storage=()=>beat();
    window.addEventListener("storage",storage);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener("storage",storage);
      try{
        const owner=JSON.parse(localStorage.getItem(TAB_LEASE_KEY)??"null") as {tabId:string}|null;
        if(owner?.tabId===id)localStorage.removeItem(TAB_LEASE_KEY);
      }catch{}
    };
  },[]);

  const safeToBid=props.connectionState==="connected"&&!readOnlyTab&&!submitting;
  const confirmBid=async()=>{
    if(!safeToBid)return;
    if(!armed){setArmed(true);return;}
    setSubmitting(true);
    try{await props.onBid();}
    finally{setSubmitting(false);setArmed(false);}
  };

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(!focus||readOnlyTab)return;
      const tag=(event.target as HTMLElement|null)?.tagName?.toLowerCase();
      if(tag==="input"||tag==="textarea"||tag==="select")return;
      if((event.key.toLowerCase()==="b"||event.key===" ")&&!armed&&safeToBid){
        event.preventDefault();setArmed(true);
      }else if(event.key==="Enter"&&armed&&safeToBid){
        event.preventDefault();void confirmBid();
      }else if(event.key==="Escape"&&armed){
        event.preventDefault();setArmed(false);
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[focus,readOnlyTab,armed,safeToBid]);

  const connectionBanner=props.connectionState==="connected"
    ? null
    : props.connectionState==="stale"
      ? "ОСТАРЯЛО СЪСТОЯНИЕ — нужно е повторно синхронизиране преди наддаване."
      : props.connectionState==="reconnecting"
        ? "ВРЪЗКАТА Е ПРЕКЪСНАТА — автоматично възстановяване; наддаването е временно спряно."
        : "Синхронизиране с потвърденото състояние на сървъра.";

  return <section className={`proLiveUx ${focus?"is-focus":""}`} aria-label="Професионални контроли за търг на живо" data-phase="36">
    <div className="proLiveTop" data-phase-task="36.01">
      <div><span>ПРОФЕСИОНАЛЕН РЕЖИМ</span><b>{focus?"ФОКУСЪТ Е АКТИВЕН":"СТАНДАРТЕН ИЗГЛЕД"}</b></div>
      <button type="button" onClick={()=>setFocus(x=>!x)} aria-pressed={focus}>{focus?"Излез от фокус":"Влез във фокус"}</button>
    </div>

    {connectionBanner&&<div className={`proLiveBanner is-${props.connectionState}`} role="alert" data-phase-task="36.08">
      <b>{connectionBanner}</b>
      <button type="button" onClick={()=>void props.onResync()} data-phase-task="36.11">Повторна синхронизация</button>
    </div>}

    <div className="proLiveStatusGrid">
      <div data-phase-task="36.06"><span>СЪРВЪРНО ВРЕМЕ</span><b>{props.connectionState==="connected"?"СИНХРОНИЗИРАНО":"ПРОВЕРКА"}</b><small>{props.lastRttMs===null?"Измерване на закъснението":`Закъснение ${props.lastRttMs} мс`}</small></div>
      <div data-phase-task="36.07"><span>МРЕЖА</span><b>{networkQuality}</b><small>възраст на синхронизацията {props.connectionAgeSeconds} сек.</small></div>
      <div data-phase-task="36.09"><span>ПОВТОРНО СВЪРЗВАНЕ</span><b>{props.connectionState==="reconnecting"?"ПОВТОРЕН ОПИТ":props.connectionState==="stale"?"НУЖНО Е СИНХРОНИЗИРАНЕ":"ГОТОВО"}</b><progress max={5} value={Math.min(5,props.connectionAgeSeconds)} /></div>
      <div data-phase-task="36.10"><span>ИЗТОЧНИК</span><b>СЪРВЪРНО СЪСТОЯНИЕ</b><small>само визуализация в клиента</small></div>
      <div data-phase-task="36.16"><span>АКТИВЕН РАЗДЕЛ</span><b>{readOnlyTab?"САМО ПРЕГЛЕД":"АКТИВЕН НАДДАВАЧ"}</b><small>{tabId?tabId.slice(0,8):"стартира"}</small></div>
    </div>

    <div className="proLiveNowNext" data-phase-task="36.03">
      <article><span>ТЕКУЩ ЛОТ</span><b>{current.lot}</b><strong>{current.title}</strong></article>
      <article><span>СЛЕДВАЩ ЛОТ</span><b>{next.lot}</b><strong>{next.title}</strong></article>
    </div>

    <div className="proLiveDashboard" data-phase-task="36.02">
      {dashboard.map((lot,index)=><article key={lot.lot} className={`is-${lot.relation}`}>
        <span>{lot.relation==="current"?"ТЕКУЩ":lot.relation==="passed"?"МИНАЛ":"ПРЕДСТОЯЩ"}</span>
        <b>{lot.lot}</b>
        <strong>{lot.title}</strong>
        <small data-phase-task="36.04">ПОЗИЦИЯ {index+1}</small>
        <small data-phase-task="36.05">{lot.relation==="upcoming"?`${lot.lotsAway} ЛОТА ДО НЕГО`:lot.relation==="current"?"СЕГА":"МИНАЛ"}</small>
        <em>€{(props.prices[lot.lot]??lot.price).toLocaleString("bg-BG")}</em>
      </article>)}
    </div>

    <div className="proLiveBidDock" data-phase-task="36.12">
      <div>
        <span>{armed?"ПОТВЪРДИ ОФЕРТАТА":"СЛЕДВАЩА ОФЕРТА"}</span>
        <b>€{((props.prices[current.lot]??current.price)+100).toLocaleString("bg-BG")}</b>
        <small>{readOnlyTab?"Друг раздел управлява наддаването":props.connectionState!=="connected"?"Изчакване на стабилно състояние от сървъра":armed?"Натисни Enter или потвърди отново":"B / Интервал подготвя · Enter потвърждава"}</small>
      </div>
      <button type="button" disabled={!safeToBid} onClick={()=>void confirmBid()}>
        {submitting?"Изпращане…":armed?"Потвърди офертата":"Подготви оферта"}
      </button>
    </div>

    <div className={`proLiveResult is-${props.bidFeedback??"idle"}`} role="status" aria-live="polite" data-phase-task="36.13">
      <b>{props.bidFeedback==="accepted"?"ПРИЕТА":props.bidFeedback==="leading"?"ВОДИШ":props.bidFeedback==="outbid"?"НАДДАДЕНА":props.bidFeedback==="rejected"?"ОТХВЪРЛЕНА":"ГОТОВО"}</b><span>{feedbackReason(props.bidFeedback)}</span>
    </div>
    {props.bidFeedback==="outbid"&&<div className="proLiveOutbid" role="alert" data-phase-task="36.14">НАДДАДЕНА ОФЕРТА — прегледай новата потвърдена цена преди следващо наддаване.</div>}
    {lateExtension&&<div className="proLiveExtension" role="status" aria-live="assertive" data-phase-task="36.15">УДЪЛЖАВАНЕ ПРИ КЪСНА ОФЕРТА — таймерът е удължен от сървъра.</div>}

    <div className="proLiveKeyboard" data-phase-task="36.17">Клавиатура: <kbd>B</kbd>/<kbd>Интервал</kbd> подготвя · <kbd>Enter</kbd> потвърждава · <kbd>Esc</kbd> отказва</div>
    <div className="proLiveMobileMarker" data-phase-task="36.18">Адаптивният изглед за наддаване е включен</div>
    <div className="srOnly" aria-live="polite" aria-atomic="true" data-phase-task="36.19">
      {connectionBanner??`Свързано. Текущ лот ${current.lot}. Остават ${props.remaining} секунди. ${feedbackReason(props.bidFeedback)}`}
    </div>
    <div className="srOnly" data-phase-task="36.20">Устройствата с един и същ профил трябва да се синхронизират към потвърденото състояние на сървъра.</div>
  </section>;
}
