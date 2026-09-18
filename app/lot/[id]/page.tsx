"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import "../lot.css";
import "../lot-d21.css";
import "../lot-d22.css";
import "../lot-d23.css";

const gallery=[
  "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1600&q=88",
  "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1000&q=84",
  "https://images.unsplash.com/photo-1617654112368-307921291f42?auto=format&fit=crop&w=1000&q=84",
  "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1000&q=84",
];

const history=[
  ["Bidder #A91","€21 900","преди 12 сек."],
  ["Bidder #K44","€21 800","преди 21 сек."],
  ["Bidder #D17","€21 500","преди 1 мин."],
  ["Bidder #R03","€21 200","преди 3 мин."],
];

export default function LotPage(){
  const params=useParams<{id:string}>();
  const lot=String(params?.id||"EA-10539").toUpperCase();
  const [activeImage,setActiveImage]=useState(0);
  const [viewerOpen,setViewerOpen]=useState(false);
  const viewerTriggerRef=useRef<HTMLButtonElement|null>(null);
  const viewerCloseRef=useRef<HTMLButtonElement|null>(null);
  const bidInputRef=useRef<HTMLInputElement|null>(null);
  const [bid,setBid]=useState(21900);
  const [bidInput,setBidInput]=useState("22000");
  const [countdown,setCountdown]=useState(10);
  const [maxBidInput,setMaxBidInput]=useState("25000");
  const [maxBid,setMaxBid]=useState<number|null>(null);
  const title=useMemo(()=>lot==="EA-10482"?"2018 BMW M4 F82":lot==="EA-10511"?"2021 Mercedes-Benz GLC":"2022 Audi RS3 Sportback",[lot]);
  const minimumBid=bid+100;

  const placeBid=()=>{
    const value=Number(bidInput.replace(/[^0-9]/g,""));
    if(Number.isFinite(value)&&value>=minimumBid){
      setBid(value);
      setBidInput(String(value+100));
      setCountdown(10);
    }
  };

  const saveMaxBid=()=>{
    const value=Number(maxBidInput.replace(/[^0-9]/g,""));
    if(Number.isFinite(value)&&value>=minimumBid){
      setMaxBid(value);
      setMaxBidInput(String(value));
    }
  };

  const showPreviousImage=()=>setActiveImage(index=>(index-1+gallery.length)%gallery.length);
  const showNextImage=()=>setActiveImage(index=>(index+1)%gallery.length);
  const focusBidPanel=()=>{
    const input=bidInputRef.current;
    if(!input)return;
    const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({behavior:reduceMotion?"auto":"smooth",block:"center"});
    window.setTimeout(()=>input.focus({preventScroll:true}),reduceMotion?0:260);
  };

  useEffect(()=>{
    const interval=window.setInterval(()=>setCountdown(value=>value<=1?10:value-1),1000);
    return()=>window.clearInterval(interval);
  },[]);

  useEffect(()=>{
    if(!viewerOpen)return;
    const previousOverflow=document.body.style.overflow;
    const trigger=viewerTriggerRef.current;
    const focusFrame=window.requestAnimationFrame(()=>viewerCloseRef.current?.focus());
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape")setViewerOpen(false);
      if(event.key==="ArrowLeft")setActiveImage(index=>(index-1+gallery.length)%gallery.length);
      if(event.key==="ArrowRight")setActiveImage(index=>(index+1)%gallery.length);
    };
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",onKeyDown);
    return()=>{
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",onKeyDown);
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
  },[viewerOpen]);

  return <main id="main-content" className="lotPage">
    <header className="lotHeader">
      <a className="lotLogo" href="/"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="lotNav"><a href="/inventory">Инвентар</a><a href="/live-auctions">LIVE търгове</a><a href="/#how">Как работи</a><a href="/transport">Транспорт</a></nav>
      <div className="lotHeaderActions"><a href="/inventory">← Назад</a><button className="lotGreen">Вход</button></div>
    </header>

    <div className="lotWrap">
      <div className="lotBreadcrumb"><a href="/">Начало</a> / <a href="/inventory">Инвентар</a> / {lot}</div>
      <div className="lotTitleRow"><div><div className="lotTitleMeta"><span className="lotPill green">● LIVE AUCTION</span><span className="lotPill">LOT {lot}</span><span className="lotPill">✓ VERIFIED</span></div><h1>{title}</h1></div><div className="lotTitleMeta"><span className="lotPill">♡ Запази</span><span className="lotPill">↗ Сподели</span></div></div>

      <div className="lotGrid">
        <div>
          <div className="lotGallery" data-design-task="D19" aria-label={`Галерия за ${title}`}>
            <button ref={viewerTriggerRef} type="button" className="lotMainImage" onClick={()=>setViewerOpen(true)} aria-label={`Отвори изображение ${activeImage+1} от ${gallery.length} на цял екран`}>
              <img src={gallery[activeImage]} alt={`${title} — изображение ${activeImage+1}`}/>
              <span className="lotImageBadge">RUN & DRIVE · {activeImage+1}/{gallery.length}</span>
              <span className="lotZoomHint" aria-hidden="true">⛶ Цял екран</span>
            </button>
            <div className="lotThumbs" role="list" aria-label="Миниатюри на автомобила">{gallery.map((src,index)=><button type="button" key={src} className={`lotThumb ${index===activeImage?"active":""}`} onClick={()=>setActiveImage(index)} aria-label={`Покажи изображение ${index+1} от ${gallery.length}`} aria-pressed={index===activeImage}><img src={src} alt=""/></button>)}</div>
          </div>

          <section className="lotSection" data-design-task="D20" aria-labelledby="lot-key-facts-title" aria-describedby="lot-key-facts-description" style={{borderColor:"rgba(39,245,138,.18)",background:"linear-gradient(180deg,rgba(13,23,16,.96),rgba(8,16,11,.96))"}}>
            <div className="lotSectionHead"><div><h2 id="lot-key-facts-title">Ключови данни за лота</h2><span id="lot-key-facts-description">Най-важната информация преди офериране</span></div><span className="lotPill green">6 проверени полета</span></div>
            <div className="lotSpecs" role="list" aria-label="Ключови данни за автомобила" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
              <div className="lotSpec" role="listitem"><span>VIN</span><b style={{overflowWrap:"anywhere"}}>WAUZZZ8V5KA123456</b></div>
              <div className="lotSpec" role="listitem"><span>LOT</span><b>{lot}</b></div>
              <div className="lotSpec" role="listitem"><span>Пробег</span><b>41 280 км</b></div>
              <div className="lotSpec" role="listitem"><span>Основна повреда</span><b>Леки драскотини / козметични следи</b></div>
              <div className="lotSpec" role="listitem"><span>Документ</span><b>Clean Title</b></div>
              <div className="lotSpec" role="listitem"><span>Локация</span><b style={{overflowWrap:"anywhere"}}>Crewe, United Kingdom</b></div>
            </div>
          </section>

          <section className="lotSection lotConditionSection" data-design-task="D22" aria-labelledby="lot-condition-title" aria-describedby="lot-condition-description">
            <div className="lotSectionHead lotConditionHead"><div><h2 id="lot-condition-title">Състояние, инспекция и произход</h2><span id="lot-condition-description">Подреден преглед на наличните данни и на това какво още не е потвърдено.</span></div><span className="lotPill green">LOT DATA SNAPSHOT</span></div>
            <div className="lotConditionGrid">
              <article className="lotConditionCard" aria-labelledby="lot-condition-summary-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">01</span><div><strong id="lot-condition-summary-title">Състояние</strong><small>Данни от аукционния лот</small></div></div>
                <dl className="lotConditionList"><div><dt>Статус на движение</dt><dd><span className="lotConditionStatus positive">Run &amp; Drive</span></dd></div><div><dt>Основна повреда</dt><dd>Леки драскотини / козметични следи</dd></div><div><dt>Вторична повреда</dt><dd>Не е посочена</dd></div></dl>
              </article>

              <article className="lotConditionCard" aria-labelledby="lot-inspection-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">02</span><div><strong id="lot-inspection-title">Инспекция</strong><small>Ясно разграничение на провереното</small></div></div>
                <ul className="lotInspectionList"><li><span>Визуални щети</span><b className="lotConditionStatus positive">Описани</b></li><li><span>Механична инспекция</span><b className="lotConditionStatus neutral">Няма свързан доклад</b></li><li><span>Диагностика</span><b className="lotConditionStatus neutral">Няма свързан доклад</b></li></ul>
              </article>

              <article className="lotConditionCard" aria-labelledby="lot-provenance-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">03</span><div><strong id="lot-provenance-title">Произход и документи</strong><small>Идентификация и история</small></div></div>
                <dl className="lotConditionList"><div><dt>Документ</dt><dd>Clean Title</dd></div><div><dt>VIN</dt><dd className="lotConditionVin">WAUZZZ8V5KA123456</dd></div><div><dt>Локация</dt><dd>Crewe, United Kingdom</dd></div></dl>
                <a className="lotHistoryLink" href="/vehicle-history" aria-label={`Провери историята на ${title}`}>Провери история на автомобила →</a>
              </article>
            </div>
            <p className="lotConditionDisclosure" role="note">Това е ENCHEV демо представяне на lot данни. Липсващите външни инспекционни или provenance доклади са означени като непотвърдени, вместо да се показват като факт.</p>
          </section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>История на офертите</h2><span>Последни bid събития</span></div></div><div className="lotHistory">{history.map(row=><div className="lotHistoryRow" key={row.join("-")}><b>{row[0]}</b><b>{row[1]}</b><span>{row[2]}</span></div>)}</div></section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>Транспорт</h2><span>Ориентировъчна цена до България</span></div></div><div className="lotTransport"><div className="lotTransportBox"><label>Дестинация<select defaultValue="sofia"><option value="sofia">София, България</option><option value="varna">Варна, България</option><option value="sliven">Сливен, България</option></select></label><label style={{marginTop:10}}>Пощенски код<input placeholder="1000"/></label></div><div className="lotTransportPrice"><span>Ориентировъчен транспорт</span><b>€1 480</b><small>7–14 работни дни · застрахован транспорт</small></div></div></section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>Подобни автомобили</h2><span>Други активни лотове</span></div></div><div className="lotRelated"><a href="/lot/EA-10482"><img src="https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=900&q=82" alt="BMW M4"/><div><b>2018 BMW M4 F82</b><span>€12 750 · LOT EA-10482</span></div></a><a href="/lot/EA-10511"><img src="https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=900&q=82" alt="Mercedes GLC"/><div><b>2021 Mercedes-Benz GLC</b><span>€18 400 · LOT EA-10511</span></div></a><a href="/lot/EA-10702"><img src="https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=900&q=82" alt="Porsche Macan"/><div><b>2023 Porsche Macan S</b><span>€28 750 · LOT EA-10702</span></div></a></div></section>
        </div>

        <aside id="lot-bid-panel" className="lotBidPanel" data-design-task="D21" data-sticky-task="D23" aria-labelledby="lot-auction-panel-title">
          <div className="lotLiveRow"><span className="lotLiveBadge"><i/> ПРОДАВА СЕ НА ЖИВО</span><span className="lotCountdown" data-urgent={countdown<=3?"true":"false"} role="timer" aria-live="polite" aria-label={`Оставащо време ${countdown} секунди`}>00:{String(countdown).padStart(2,"0")}</span></div>
          <h2 id="lot-auction-panel-title">Текуща ставка</h2><div className="lotCurrentBid" aria-live="polite">€{bid.toLocaleString("bg-BG")}</div><div className="lotBidHint" id="lot-bid-minimum">Следваща минимална оферта: €{minimumBid.toLocaleString("bg-BG")}</div>
          <label className="lotBidLabel" htmlFor="lot-bid-input">Твоя оферта</label>
          <div className="lotBidInputRow"><input ref={bidInputRef} id="lot-bid-input" className="lotBidInput" value={bidInput} onChange={e=>setBidInput(e.target.value)} inputMode="numeric" aria-describedby="lot-bid-minimum"/><button type="button" className="lotBidBtn" onClick={placeBid}>Оферирай</button></div>
          <div className="lotMaxBid" aria-labelledby="lot-max-bid-title">
            <div className="lotMaxBidHead"><div><strong id="lot-max-bid-title">Max bid</strong><span>Запази максимален лимит за тази сесия</span></div>{maxBid!==null&&<b aria-live="polite">€{maxBid.toLocaleString("bg-BG")}</b>}</div>
            <label className="lotBidLabel" htmlFor="lot-max-bid-input">Максимална оферта</label>
            <div className="lotMaxBidRow"><input id="lot-max-bid-input" className="lotMaxBidInput" value={maxBidInput} onChange={e=>setMaxBidInput(e.target.value)} inputMode="numeric" aria-describedby="lot-max-bid-help"/><button type="button" className="lotMaxBidBtn" onClick={saveMaxBid}>Задай max</button></div>
            <small id="lot-max-bid-help">Минимум €{minimumBid.toLocaleString("bg-BG")} · стойността е локална демо настройка до backend свързването.</small>
          </div>
          <button className="lotBuyNow">Купи сега · €29 900</button>
          <div className="lotFees"><div><span>Текуща ставка</span><b>€{bid.toLocaleString("bg-BG")}</b></div><div><span>Ориентировъчни такси</span><b>€980</b></div><div><span>Транспорт</span><b>от €1 480</b></div></div>
          <div className="lotNotice">Това е визуалният ENCHEV Lot Details flow. Реалните плащания, identity verification и server-side bid locking ще бъдат вързани към backend етапа.</div>
        </aside>
      </div>
    </div>

    {!viewerOpen&&<section className="lotMobileBidDock" data-design-task="D23" aria-label="Бързи действия за офериране">
      <div className="lotMobileBidSummary"><span>Текуща ставка</span><strong>€{bid.toLocaleString("bg-BG")}</strong><small>Минимум €{minimumBid.toLocaleString("bg-BG")}</small></div>
      <button type="button" className="lotMobileBidAction" onClick={focusBidPanel} aria-controls="lot-bid-panel">Към офертата</button>
    </section>}

    {viewerOpen&&<div className="lotViewer" role="dialog" aria-modal="true" aria-labelledby="lot-viewer-title" onMouseDown={event=>{if(event.target===event.currentTarget)setViewerOpen(false)}}>
      <div className="lotViewerShell">
        <div className="lotViewerTop">
          <div><span>ENCHEV MEDIA VIEWER</span><strong id="lot-viewer-title">{title}</strong></div>
          <button ref={viewerCloseRef} type="button" className="lotViewerClose" onClick={()=>setViewerOpen(false)} aria-label="Затвори галерията">✕</button>
        </div>
        <div className="lotViewerStage">
          <button type="button" className="lotViewerNav lotViewerPrev" onClick={showPreviousImage} aria-label="Предишно изображение">‹</button>
          <img src={gallery[activeImage]} alt={`${title} — изображение ${activeImage+1} на цял екран`}/>
          <button type="button" className="lotViewerNav lotViewerNext" onClick={showNextImage} aria-label="Следващо изображение">›</button>
        </div>
        <div className="lotViewerBottom">
          <span className="lotViewerCount" aria-live="polite">Изображение {activeImage+1} от {gallery.length}</span>
          <div className="lotViewerThumbs" aria-label="Избери изображение">{gallery.map((src,index)=><button type="button" key={`viewer-${src}`} className={`lotViewerThumb ${index===activeImage?"active":""}`} onClick={()=>setActiveImage(index)} aria-label={`Покажи изображение ${index+1}`} aria-pressed={index===activeImage}><img src={src} alt=""/></button>)}</div>
        </div>
      </div>
    </div>}
  </main>;
}
