"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./live-auctions.css";
import "./live-d24.css";
import "./live-d26.css";
import "./live-d27.css";

const LOT_SECONDS=10;
const lots=[
  {lot:"EA-10511",title:"2021 Mercedes-Benz GLC",location:"Munich, DE",damage:"Front end",mileage:"64 900 km",price:18400,image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1500&q=86"},
  {lot:"EA-10539",title:"2022 Audi RS3 Sportback",location:"Crewe, UK",damage:"Minor scratches",mileage:"41 280 km",price:21900,image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1500&q=86"},
  {lot:"EA-10603",title:"2026 Volkswagen Golf GTI",location:"London, UK",damage:"Clean title",mileage:"9 870 km",price:16250,image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1500&q=86"},
  {lot:"EA-10627",title:"2020 BMW X5 xDrive40i",location:"Texas, USA",damage:"Rear end",mileage:"96 210 km",price:15100,image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1500&q=86"},
];

type BidFeedbackKind="accepted"|"rejected"|"outbid"|"leading";
type BidFeedback={kind:BidFeedbackKind;title:string;detail:string};

type LiveClockPayload={
  serverNow:number;
  roundEndsAt:number;
  durationMs:number;
  lotIndex:number;
  lotId:string;
  currentBid:number;
  bidSequence:number;
  minimumBid:number;
  scope:string;
  outcome?:"accepted"|"rejected";
  reason?:"stale-lot"|"invalid-bid"|"bid-too-low";
};

export default function LiveAuctionsPage(){
  const [active,setActive]=useState(0);
  const [remaining,setRemaining]=useState(LOT_SECONDS);
  const [prices,setPrices]=useState<Record<string,number>>(()=>Object.fromEntries(lots.map(x=>[x.lot,x.price])));
  const [bidFlash,setBidFlash]=useState(false);
  const [clockMode,setClockMode]=useState<"syncing"|"server">("syncing");
  const [soldNotice,setSoldNotice]=useState<string|null>(null);
  const [bidFeedback,setBidFeedback]=useState<BidFeedback|null>(null);

  const deadlineRef=useRef<number|null>(null);
  const serverOffsetRef=useRef(0);
  const lastServerNowRef=useRef(0);
  const syncInFlightRef=useRef(false);
  const activeRef=useRef(0);
  const soldNoticeTimerRef=useRef<number|null>(null);
  const feedbackTimerRef=useRef<number|null>(null);
  const ownBidRef=useRef<{lotId:string;amount:number;sequence:number}|null>(null);

  const showFeedback=(feedback:BidFeedback,autoClearMs?:number)=>{
    setBidFeedback(feedback);
    if(feedbackTimerRef.current!==null)window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current=null;
    if(autoClearMs){
      feedbackTimerRef.current=window.setTimeout(()=>setBidFeedback(null),autoClearMs);
    }
  };

  const applyClock=(data:LiveClockPayload,sentAt:number,receivedAt:number)=>{
    if(
      !Number.isFinite(data.serverNow)||
      !Number.isFinite(data.roundEndsAt)||
      !Number.isFinite(data.currentBid)||
      !Number.isInteger(data.bidSequence)||
      !Number.isInteger(data.lotIndex)||
      data.lotIndex<0||
      data.lotIndex>=lots.length||
      data.serverNow<lastServerNowRef.current
    )return false;

    const midpoint=sentAt+(receivedAt-sentAt)/2;
    const offset=data.serverNow-midpoint;
    const previousIndex=activeRef.current;
    const hadServerState=lastServerNowRef.current>0;
    const ownBid=ownBidRef.current;

    if(
      ownBid&&
      data.lotId===ownBid.lotId&&
      data.currentBid>ownBid.amount&&
      data.bidSequence>ownBid.sequence
    ){
      showFeedback({
        kind:"outbid",
        title:"Наддадено е над твоята оферта",
        detail:`Текущата ставка вече е €${data.currentBid.toLocaleString("bg-BG")}.`,
      });
      ownBidRef.current=null;
    }

    if(hadServerState&&data.lotIndex!==previousIndex){
      setSoldNotice(lots[previousIndex].lot);
      if(soldNoticeTimerRef.current!==null)window.clearTimeout(soldNoticeTimerRef.current);
      soldNoticeTimerRef.current=window.setTimeout(()=>setSoldNotice(null),1800);
      if(ownBidRef.current?.lotId===lots[previousIndex].lot)ownBidRef.current=null;
    }

    lastServerNowRef.current=data.serverNow;
    serverOffsetRef.current=offset;
    deadlineRef.current=data.roundEndsAt;
    activeRef.current=data.lotIndex;
    setActive(data.lotIndex);
    setPrices(p=>({...p,[data.lotId]:data.currentBid}));
    setRemaining(Math.max(0,Math.ceil((data.roundEndsAt-(Date.now()+offset))/1000)));
    setClockMode("server");
    return true;
  };

  const syncClock=async()=>{
    if(syncInFlightRef.current)return;
    syncInFlightRef.current=true;
    const sentAt=Date.now();
    try{
      const response=await fetch("/api/live-auction-clock",{cache:"no-store"});
      if(!response.ok)return;
      const data=await response.json() as LiveClockPayload;
      applyClock(data,sentAt,Date.now());
    }finally{
      syncInFlightRef.current=false;
    }
  };

  useEffect(()=>{
    if(deadlineRef.current===null)deadlineRef.current=Date.now()+LOT_SECONDS*1000;
    void syncClock();

    const tickId=window.setInterval(()=>{
      const deadline=deadlineRef.current;
      if(deadline===null)return;
      const serverAlignedNow=Date.now()+serverOffsetRef.current;
      const nextRemaining=Math.max(0,Math.ceil((deadline-serverAlignedNow)/1000));
      setRemaining(nextRemaining);
      if(nextRemaining===0)void syncClock();
    },200);

    const resyncId=window.setInterval(()=>void syncClock(),3000);
    return()=>{
      window.clearInterval(tickId);
      window.clearInterval(resyncId);
      if(soldNoticeTimerRef.current!==null)window.clearTimeout(soldNoticeTimerRef.current);
      if(feedbackTimerRef.current!==null)window.clearTimeout(feedbackTimerRef.current);
    };
  // D25 sync lifecycle is intentionally ref-backed; D28 owns reconnect/stale UI.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const current=lots[active];
  const next=lots[(active+1)%lots.length];
  const sold=useMemo(()=>lots.filter((_,i)=>i<active),[active]);
  const price=prices[current.lot]??current.price;

  const bid=async()=>{
    const bidLot=current;
    const requestedBid=price+100;
    const sentAt=Date.now();

    try{
      const response=await fetch("/api/live-auction-clock",{
        method:"POST",
        cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"bid",lotId:bidLot.lot,bidAmount:requestedBid}),
      });

      const data=await response.json() as LiveClockPayload;
      const applied=applyClock(data,sentAt,Date.now());

      if(!response.ok||!applied||data.outcome!=="accepted"||data.lotId!==bidLot.lot){
        const detail=
          data.reason==="stale-lot"?"Лотът вече е сменен. Показваме актуалния търг.":
          data.reason==="bid-too-low"?`Нужна е минимум €${data.minimumBid.toLocaleString("bg-BG")}.`:
          "Офертата не отговаря на текущото server state.";
        showFeedback({kind:"rejected",title:"Офертата не е приета",detail},3200);
        return;
      }

      ownBidRef.current={lotId:data.lotId,amount:data.currentBid,sequence:data.bidSequence};
      showFeedback({
        kind:"accepted",
        title:"Офертата е приета",
        detail:`Server потвърди €${data.currentBid.toLocaleString("bg-BG")} за LOT ${data.lotId}.`,
      });
      feedbackTimerRef.current=window.setTimeout(()=>{
        const own=ownBidRef.current;
        if(own&&own.lotId===data.lotId&&own.sequence===data.bidSequence){
          setBidFeedback({
            kind:"leading",
            title:"Водиш наддаването",
            detail:`Твоята потвърдена оферта е €${data.currentBid.toLocaleString("bg-BG")}.`,
          });
        }
      },900);

      setBidFlash(true);
      window.setTimeout(()=>setBidFlash(false),650);
    }catch{
      // D28 owns connection/reconnect/stale-state feedback.
    }
  };

  const fmt=(v:number)=>`00:${String(v).padStart(2,"0")}`;
  const feedbackState=bidFeedback?.kind??"idle";

  return <main className="livePage">
    <div className="liveUtility"><span><i/> ENCHEV LIVE NETWORK</span><span>Server-synced demo session · 10 sec per lot</span></div>
    <header className="liveHeader">
      <a href="/" className="liveLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav><a href="/inventory">Инвентар</a><a className="active" href="/live-auctions">Търгове на живо</a><a href="/transport">Транспорт</a><a href="/#how">Как да купя</a></nav>
      <div><button>Вход</button><button className="liveRegister">Регистрация</button></div>
    </header>

    <section className="liveHero">
      <div><span className="liveEyebrow">● LIVE AUCTION ROOM</span><h1>Наддавай в реално време</h1><p>10-секундният demo брояч се води от ENCHEV server session clock. При потвърдена оферта сървърът задава нов краен момент; при изтичане клиентът взема актуалния lot state от сървъра.</p></div>
      <div className="liveHeroClock" data-design-task="D25" data-clock-mode={clockMode} role="timer" aria-label={`Остават ${remaining} секунди за лот ${current.lot}`}><small>{clockMode==="server"?"SERVER SYNC":"СИНХРОНИЗИРАНЕ"}</small><b>{fmt(remaining)}</b><span>LOT {current.lot}</span></div>
    </section>

    <section className="liveStage" data-design-task="D24" data-auto-advance-task="D26" aria-label="Live auction room: текущ и следващ лот">
      <div className="liveVisual" data-live-slot="current" aria-labelledby="live-current-lot-title">
        <img src={current.image} alt={current.title}/>
        <div className="liveVisualShade"/>
        <span className="liveStatus"><i/> ПРОДАВА СЕ НА ЖИВО</span>
        {soldNotice&&<div className="liveSoldTransition" role="status" aria-live="polite"><b>SOLD · LOT {soldNotice}</b><span>Следващият лот е активен</span></div>}
        {bidFlash&&<div className="liveNewBid">NEW BID</div>}
        <div className="liveRing" data-clock-mode={clockMode}><strong>{remaining}</strong><small>SEC</small></div>
        <div className="liveVisualInfo"><span>ТЕКУЩ ЛОТ · {current.lot}</span><h2 id="live-current-lot-title">{current.title}</h2><p>{current.location} · {current.damage} · {current.mileage}</p></div>
      </div>

      <aside className="liveBidPanel" aria-label="Наддаване и следващ лот">
        <div className="liveBidTop"><span>ТЕКУЩА СТАВКА</span><b>€{price.toLocaleString("bg-BG")}</b></div>
        <div className="liveBidMeta"><div><span>Следваща оферта</span><b>€{(price+100).toLocaleString("bg-BG")}</b></div><div><span>Остава</span><b>{fmt(remaining)}</b></div></div>
        <button className="liveBidButton" onClick={()=>void bid()}>Оферирай +€100 <span>→</span></button>
        <div
          className={`liveBidFeedback ${feedbackState}`}
          data-bid-feedback-task="D27"
          data-bid-state={feedbackState}
          role={bidFeedback?.kind==="rejected"||bidFeedback?.kind==="outbid"?"alert":"status"}
          aria-live={bidFeedback?.kind==="rejected"||bidFeedback?.kind==="outbid"?"assertive":"polite"}
        >
          <span className="liveBidFeedbackDot" aria-hidden="true"/>
          <div>
            <b>{bidFeedback?.title??"Готов за оферта"}</b>
            <span>{bidFeedback?.detail??"Офертата ще бъде валидирана спрямо текущото server state."}</span>
          </div>
        </div>
        <a className="liveLotLink" href={`/lot/${current.lot}`}>Отвори детайлите на лота</a>

        <section className="liveNextPreview" data-live-slot="next" aria-labelledby="live-next-lot-title">
          <div className="liveNextPreviewHead"><span>СЛЕДВАЩ ЛОТ</span><small>Стартира след текущия</small></div>
          <a className="liveNextPreviewCard" href={`/lot/${next.lot}`}>
            <img src={next.image} alt=""/>
            <div>
              <span>LOT {next.lot}</span>
              <h3 id="live-next-lot-title">{next.title}</h3>
              <p>{next.location} · {next.damage}</p>
              <b>Старт €{(prices[next.lot]??next.price).toLocaleString("bg-BG")}</b>
            </div>
          </a>
        </section>

        <div className="liveRule"><b>Как работи</b><p>Офертата се валидира от server session state. Приета оферта става leading; stale/ниска оферта се отхвърля, а по-висока последваща server оферта показва outbid.</p></div>
      </aside>
    </section>

    <section className="liveQueue">
      <div className="liveSectionHead"><div><span>АУКЦИОННА ОПАШКА</span><h2>Следващи лотове</h2></div><a href="/inventory">Всички автомобили →</a></div>
      <div className="liveQueueGrid">
        <article className="liveQueueCard next"><img src={next.image} alt={next.title}/><div><span>СЛЕДВАЩ ЛОТ · {next.lot}</span><h3>{next.title}</h3><p>{next.location}</p><b>Старт €{(prices[next.lot]??next.price).toLocaleString("bg-BG")}</b></div></article>
        {lots.filter((_,i)=>i!==active&&i!==(active+1)%lots.length).slice(0,2).map(x=><article className="liveQueueCard" key={x.lot}><img src={x.image} alt={x.title}/><div><span>ОЧАКВА · {x.lot}</span><h3>{x.title}</h3><p>{x.location}</p><b>€{(prices[x.lot]??x.price).toLocaleString("bg-BG")}</b></div></article>)}
      </div>
    </section>

    {sold.length>0&&<section className="liveSold"><div className="liveSectionHead"><div><span>ПРИКЛЮЧИЛИ</span><h2>Продадени в този цикъл</h2></div></div><div className="liveSoldGrid">{sold.map(x=><a href={`/lot/${x.lot}`} key={x.lot}><img src={x.image} alt={x.title}/><div><span>SOLD · {x.lot}</span><b>{x.title}</b></div></a>)}</div></section>}
  </main>;
}
