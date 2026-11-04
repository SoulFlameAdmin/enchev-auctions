"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import "./ea-premium-auction.css";

type BidFeedback="accepted"|"leading"|"outbid"|"rejected";
type ConnectionState="syncing"|"connected"|"reconnecting"|"stale";
type Lot=Readonly<{lot:string;title:string;location:string;image:string;price:number;damage:string;mileage:string}>;
type Props=Readonly<{
  current:Lot;next:Lot;remaining:number;price:number;
  connectionState:ConnectionState;bidFeedback:BidFeedback|null;
  onBid:()=>Promise<void>;onResync:()=>Promise<void>;
}>;

const TOTAL_SECONDS=60;
const ticks=Array.from({length:61},(_,i)=>{
  const theta=Math.PI-(i/60)*Math.PI;
  const outer=231,inner=i%5===0?203:215,cx=300,cy=260;
  const color=i<20?"#17ee4b":i<36?"#deff00":i<49?"#ff9915":"#fa1427";
  return {id:i,x1:cx+inner*Math.cos(theta),y1:cy-inner*Math.sin(theta),x2:cx+outer*Math.cos(theta),y2:cy-outer*Math.sin(theta),color};
});
function money(value:number){return new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);}
function secondsLabel(value:number){const v=Math.max(0,value);return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0");}

function Speedometer({remaining}:{remaining:number}){
  const seconds=Math.min(TOTAL_SECONDS,Math.max(0,remaining));
  const theta=Math.PI*seconds/TOTAL_SECONDS;
  const needleX=300+183*Math.cos(theta),needleY=260-183*Math.sin(theta);
  return <div className={`eaSpeedometer ${seconds<=10?"is-critical":seconds<=30?"is-warning":""}`} role="timer" aria-label={`Остават ${seconds} секунди`}>
    <svg viewBox="0 0 600 304" aria-hidden="true" className="eaSpeedometerFace">
      <defs><radialGradient id="eaDial" cx="50%" cy="85%"><stop offset="0" stopColor="#1b090b"/><stop offset=".7" stopColor="#080808"/><stop offset="1" stopColor="#151718"/></radialGradient>
      <linearGradient id="eaNeedle"><stop stopColor="#a80c16"/><stop offset="1" stopColor="#ff3242"/></linearGradient></defs>
      <path d="M60 260 A240 240 0 0 1 540 260 L528 260 A228 228 0 0 0 72 260 Z" fill="url(#eaDial)" stroke="#6e5151" strokeWidth="3"/>
      {ticks.map(t=><line key={t.id} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} strokeWidth={t.id%5===0?7:5}/>)}
      <text x="68" y="292" fill="#d0d0d0" fontSize="24" fontWeight="800">60</text>
      <text x="292" y="33" fill="#f9e9ce" fontSize="24" fontWeight="800">30</text>
      <text x="511" y="292" fill="#f6f0ed" fontSize="24" fontWeight="800">0</text>
      <line x1="300" y1="260" x2={needleX} y2={needleY} stroke="#f70717" strokeWidth="12" strokeLinecap="round" className="eaSpeedometerNeedle"/>
      <line x1="300" y1="260" x2={needleX} y2={needleY} stroke="#ffd4d4" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="300" cy="260" r="21" fill="#1c191a" stroke="#f3b5ac" strokeWidth="4"/>
      <circle cx="300" cy="260" r="11" fill="#c9c9c9"/>
    </svg>
    <div className="eaDialOverlay">
      <span className="eaDialCaption">ОСТАВАЩО ВРЕМЕ</span>
      <strong className="eaDialDigital">{secondsLabel(seconds)}</strong>
      <span className="eaFuel" aria-label="Предупреждение за гориво">⛽</span>
      <span className="eaDialRhythm">{seconds<=10?"ПОСЛЕДНИ 10 СЕК. · ×2 ТИК-ТАК":"ТИК-ТАК · 1 ПЪТ/СЕК."}</span>
    </div>
  </div>;
}

export default function EaPremiumAuction(props:Props){
  const [entered,setEntered]=useState(false);
  const [ready,setReady]=useState(false);
  const [sound,setSound]=useState(true);
  const [armed,setArmed]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [menu,setMenu]=useState(false);
  const [photo,setPhoto]=useState(0);
  const audioRef=useRef<AudioContext|null>(null);
  const lastTickRef=useRef<number|null>(null);
  const timeoutsRef=useRef<number[]>([]);
  const current=props.current;
  const isOnline=props.connectionState==="connected";
  const image=photo===0?current.image:photo===1?"/images/enchev-lamborghini-hero.jpg":props.next.image;

  const activeStatus=useMemo(()=>{
    if(props.bidFeedback==="rejected")return "Офертата е отказана от тестовия сървър";
    if(props.bidFeedback==="outbid")return "Има по-висока тестова оферта";
    if(props.bidFeedback==="accepted"||props.bidFeedback==="leading")return "Тестовата оферта е потвърдена";
    return "Няма подадена оферта в този изглед";
  },[props.bidFeedback]);

  const tone=(frequency:number,delay=0,duration=.055,volume=.04)=>{
    const ctx=audioRef.current;
    if(!ctx||ctx.state!=="running")return;
    const osc=ctx.createOscillator();const gain=ctx.createGain();const start=ctx.currentTime+delay;
    osc.type="sine";osc.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(start);osc.stop(start+duration+.01);
  };
  const enableAudio=async()=>{
    try{
      if(!audioRef.current)audioRef.current=new window.AudioContext();
      await audioRef.current.resume();
    }catch{/* Mobile browsers may reject audio until a new gesture. */}
  };
  const enterRoom=()=>{setEntered(true);setArmed(false);if(sound)void enableAudio();};
  const toggleSound=()=>{
    setSound(v=>!v);
    if(!sound)void enableAudio();
  };
  useEffect(()=>{
    if(!entered||!sound){lastTickRef.current=props.remaining;return;}
    if(lastTickRef.current===props.remaining)return;
    lastTickRef.current=props.remaining;
    if(props.remaining<=0||props.remaining>TOTAL_SECONDS)return;
    tone(props.remaining<=10?900:540,0,.052,.042);
    if(props.remaining<=10){
      tone(1100,.22,.06,.055);
      if(props.remaining===10){tone(700,.43,.17,.075);tone(920,.66,.18,.075);}
    }
  },[props.remaining,entered,sound]);
  useEffect(()=>()=>{timeoutsRef.current.forEach(window.clearTimeout);if(audioRef.current)void audioRef.current.close();},[]);
  useEffect(()=>{setArmed(false);setPhoto(0);},[current.lot]);
  useEffect(()=>{
    if(!armed)return;
    const id=window.setTimeout(()=>setArmed(false),5000);
    return()=>window.clearTimeout(id);
  },[armed]);
  const confirm=async()=>{
    if(!isOnline||submitting)return;
    if(!armed){setArmed(true);return;}
    setSubmitting(true);
    try{await props.onBid();}finally{setSubmitting(false);setArmed(false);}
  };

  return <section className="eaPremium" lang="bg" data-ea-premium="2026" data-auction-authority="false">
    <div className="eaPremiumHeader">
      <a href="/" aria-label="E&A начална страница" className="eaPremiumBrand"><img src="/brand/ea-official-dark.svg" alt="E&A East and West Auctioneers Group"/></a>
      <nav className="eaPremiumDesktopLinks" aria-label="Аукционно меню"><a href="/">Начало</a><button type="button" className={!entered?"is-current":""} onClick={()=>setEntered(false)}>Лоби</button><button className={entered?"is-current":""} type="button" onClick={enterRoom}>LIVE AUCTIONS</button><a href="/inventory">Автомобили</a></nav>
      <div className="eaPremiumHeaderRight"><span className="eaPremiumLive"><i/> {entered?"LIVE · DEMO":"LOBBY"}</span><button type="button" className="eaSound" onClick={toggleSound} aria-label={sound?"Изключи звука":"Включи звука"} aria-pressed={sound}>{sound?"♫":"♪"}</button><button className="eaPremiumMenu" type="button" aria-expanded={menu} aria-label="Отвори меню" onClick={()=>setMenu(v=>!v)}>☰</button></div>
    </div>
    {menu&&<nav className="eaPremiumDropdown" aria-label="Бързо меню"><button onClick={()=>{setEntered(false);setMenu(false);}}>Лоби</button><button onClick={()=>{enterRoom();setMenu(false);}}>Тестов търг</button><a href="/inventory">Автомобили</a><a href="/">Начало</a></nav>}

    {!entered?<div className="eaPremiumLobby" aria-label="Лоби на тестовия търг">
      <div className="eaLobbyScene">
        <div className="eaLobbyImage"/>
        <div className="eaLobbySceneContent">
          <span className="eaLobbyEyebrow">E&A · EAST AND WEST AUCTIONEERS GROUP</span>
          <span className="eaLivePill">● ПРЕДВАРИТЕЛНА ЗАЛА</span>
          <h1>ЛОБИ НА<br/><em>ТЪРГА</em></h1>
          <p>Добре дошли в премиум аукционната зала. Подгответе се за следващия тестов автомобилен търг.</p>
          <div className="eaLobbySceneBadges"><span>◉ LIVE ТЪРГОВЕ</span><span>◈ АВТОМОБИЛИ</span><span>◇ ЕВРОПА</span></div>
        </div>
      </div>
      <div className="eaLobbyDashboard">
        <section className="eaLobbyFeature"><span className="eaSectionKicker">СЛЕДВАЩ ЛОТ</span><img src={props.next.image} alt={props.next.title}/><div><strong>{props.next.title}</strong><small>Лот {props.next.lot} · {props.next.location}</small></div></section>
        <section className="eaLobbyWaiting"><span className="eaSectionKicker">ТЕСТОВА ЧАКАЛНЯ</span><div className="eaLobbyRing"><span>◉</span><strong>{ready?"ГОТОВ":"В ЗАЛАТА"}</strong><small>{ready?"Участието е подготвено":"Маркирай готовност за демото"}</small></div><div className="eaLobbySession"><span>Участници</span><b>1 локален потребител</b><small>Демонстрационна сесия, не общ брой онлайн</small></div><div className="eaLobbyActions"><button type="button" className={ready?"is-ready":""} onClick={()=>setReady(v=>!v)}>{ready?"✓ ГОТОВ СЪМ":"✓ МАРКИРАЙ ГОТОВ"}</button><button type="button" className="eaRedAction" onClick={enterRoom}>ВЛЕЗ В ТЕСТОВИЯ ТЪРГ →</button></div></section>
        <section className="eaLobbyDetails"><span className="eaSectionKicker">СТАТУС НА СИСТЕМАТА</span><div className={`eaServerStatus ${isOnline?"online":""}`}>● {isOnline?"ТЕСТОВ СЪРВЪР СВЪРЗАН":"ИЗЧАКВА СИНХРОНИЗАЦИЯ"}</div><span className="eaLobbyDetailLabel">Текущ тестов лот</span><b>{current.lot}</b><span className="eaLobbyDetailLabel">Остава до следващ лот</span><strong>{secondsLabel(props.remaining)}</strong><span className="eaLobbyDetailLabel">Начална цена на следващия</span><b>{money(props.next.price)}</b><button type="button" onClick={()=>void props.onResync()}>↻ ОПРЕСНИ СТАТУСА</button></section>
      </div>
      <p className="eaDemoDisclosure">ДЕМО РЕЖИМ · Готовността е локална визуална настройка, а не реална регистрация. Няма плащания.</p>
    </div>:<div className="eaPremiumAuctionRoom" aria-label="Професионален тестов търг">
      <div className="eaPremiumRoomRibbon"><span className="eaLivePill">● LIVE / TEST</span><strong>ТЪРГ НА ЖИВО · {current.lot}</strong><span>{isOnline?"● СЪРВЪРНА СИНХРОНИЗАЦИЯ":"⚠ НЯМА АКТУАЛНА ВРЪЗКА"}</span><button type="button" onClick={()=>setEntered(false)}>↩ Лоби</button></div>
      <div className="eaPremiumAuctionGrid">
        <section className="eaPremiumCarPanel">
          <div className="eaPremiumCarBackdrop"><img src={image} alt={current.title}/><div className="eaPremiumCarHeading"><small>ЛОТ № {current.lot}</small><h1>{current.title}</h1><p>{current.location} · {current.damage}</p></div><span className="eaCarLiveBadge">LIVE • DEMO</span></div>
          <div className="eaPremiumGallery"><button type="button" aria-label="Текущ автомобил" aria-pressed={photo===0} onClick={()=>setPhoto(0)}><img src={current.image} alt="Основна снимка"/></button><button type="button" aria-label="Визуализация" aria-pressed={photo===1} onClick={()=>setPhoto(1)}><img src="/images/enchev-lamborghini-hero.jpg" alt="Илюстративна визуализация"/></button><button type="button" aria-label="Следващ автомобил" aria-pressed={photo===2} onClick={()=>setPhoto(2)}><img src={props.next.image} alt="Следващ автомобил"/></button></div>
        </section>
        <section className="eaPremiumControlPanel">
          <Speedometer remaining={props.remaining}/>
          <div className="eaCurrentOffer"><span>ТЕКУЩА ТЕСТОВА ОФЕРТА</span><strong>{money(props.price)}</strong></div>
          <div className="eaPremiumBidActions"><button type="button" className={!armed?"eaOutlineBid":"eaConfirmBid"} disabled={!isOnline||submitting} onClick={()=>void confirm()}>{submitting?"ИЗПРАЩАНЕ…":armed?"ПОТВЪРДИ ОФЕРТАТА":"НАДДАЙ +100 €"}</button><button type="button" className="eaSecondaryBid" onClick={()=>{setArmed(false);setEntered(false);}}>ЛОБИ / ИЗХОД</button></div>
          <div className={`eaPremiumBidResult is-${props.bidFeedback??"idle"}`} role="status" aria-live="polite">{armed?"Натисни отново, за да потвърдиш тестова оферта.":activeStatus}</div>
          <div className="eaPremiumClockCaption">60 сек. за лот · от 60 сек. тик-так · при последните 10 сек. двоен ритъм + предупреждение за гориво</div>
        </section>
        <aside className="eaPremiumOffers"><div><span className="eaSectionKicker">ПОСЛЕДНИ ОФЕРТИ</span><span>СЪРВЪРНО ДЕМО</span></div><div className="eaOfferEntry"><span className="eaOfferAvatar">◉</span><div><b>Текуща цена</b><small>{current.lot}</small></div><strong>{money(props.price)}</strong></div><p>{activeStatus}</p><div className="eaNextLot"><span className="eaSectionKicker">СЛЕДВАЩ АВТОМОБИЛ</span><img src={props.next.image} alt={props.next.title}/><b>{props.next.title}</b><small>{props.next.lot}</small></div></aside>
      </div>
      <div className="eaPremiumSpecs"><span>⚑ ЛОТ: <b>{current.lot}</b></span><span>◈ АВТОМОБИЛ: <b>{current.title}</b></span><span>⌖ ЛОКАЦИЯ: <b>{current.location}</b></span><span>◷ ВРЕМЕ: <b>{secondsLabel(props.remaining)}</b></span></div>
      <p className="eaDemoDisclosure">ТЕСТОВ ТЪРГ · Офертите са примерни и са ограничени до сървърната демо сесия; не са реални сделки. Актуалните оферти от други устройства не се показват в общ поток.</p>
    </div>}
    <nav className="eaPremiumBottomNav" aria-label="Навигация на мобилното приложение"><button type="button" className={!entered?"selected":""} onClick={()=>setEntered(false)}>⌂<small>Лоби</small></button><button type="button" className={entered?"selected":""} onClick={enterRoom}>⚒<small>Търгове</small></button><a href="/inventory">▤<small>Автомобили</small></a><a href="/profile">♙<small>Профил</small></a></nav>
  </section>;
}
