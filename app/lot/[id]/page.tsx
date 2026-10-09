"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PREVIEW_VEHICLES } from "../../data/preview-vehicles";
import { GOLF_GTI_DEMO_PHOTO_CREDIT } from "../../data/demo-vehicle-media";
import { getDemoWatchlist, setDemoWatchlist, type DemoSavedVehicle } from "../../components/demo-watchlist";
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
  ["Bidder #A91","€21 900","12 sec ago"],
  ["Bidder #K44","€21 800","21 sec ago"],
  ["Bidder #D17","€21 500","1 min ago"],
  ["Bidder #R03","€21 200","3 min ago"],
];

export default function LotPage(){
  const params=useParams<{id:string}>();
  const lot=String(params?.id||"EA-10539").toUpperCase();
  const vehicle=PREVIEW_VEHICLES[lot];
  const lotGallery=useMemo(()=>lot==="EA-10539"?gallery:vehicle?[vehicle.image]:gallery,[lot,vehicle]);
  const title=vehicle?.title||`Unrecognized preview lot ${lot}`;
  const [activeImage,setActiveImage]=useState(0);
  const [viewerOpen,setViewerOpen]=useState(false);
  const viewerTriggerRef=useRef<HTMLButtonElement|null>(null);
  const viewerCloseRef=useRef<HTMLButtonElement|null>(null);
  const bidInputRef=useRef<HTMLInputElement|null>(null);
  const [bid,setBid]=useState(vehicle?.price??0);
  const [bidInput,setBidInput]=useState(String((vehicle?.price??0)+100));
  const [buyNowNotice,setBuyNowNotice]=useState("");
  const [isSaved,setIsSaved]=useState(false);
  const [shareUrl,setShareUrl]=useState("");
  const [countdown,setCountdown]=useState(10);
  const [maxBidInput,setMaxBidInput]=useState(String((vehicle?.price??0)+3000));
  const [maxBid,setMaxBid]=useState<number|null>(null);
  useEffect(()=>{
    setBid(vehicle?.price??0);
    setBidInput(String((vehicle?.price??0)+100));
    setMaxBidInput(String((vehicle?.price??0)+3000));
    setMaxBid(null);
    setBuyNowNotice("");
    setShareUrl("");
    setIsSaved(getDemoWatchlist().some(item=>item.lot===lot));
    setActiveImage(0);
  },[lot,vehicle]);
  const minimumBid=bid+100;
  const toggleSaved=()=>{
    if(!vehicle)return;
    const entries=getDemoWatchlist();
    const exists=entries.some(item=>item.lot===lot);
    const next=exists?entries.filter(item=>item.lot!==lot):[...entries,{
      lot,title:vehicle.title,location:vehicle.location,damage:vehicle.damage,bid:vehicle.price,
      state:(vehicle.buyNow>0?"BUY NOW":"UPCOMING") as DemoSavedVehicle["state"],
      image:vehicle.image,
    }];
    setDemoWatchlist(next);
    setIsSaved(!exists);
  };

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

  const showPreviousImage=()=>setActiveImage(index=>(index-1+lotGallery.length)%lotGallery.length);
  const showNextImage=()=>setActiveImage(index=>(index+1)%lotGallery.length);
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
      if(event.key==="ArrowLeft")setActiveImage(index=>(index-1+lotGallery.length)%lotGallery.length);
      if(event.key==="ArrowRight")setActiveImage(index=>(index+1)%lotGallery.length);
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

  if(!vehicle)return <main id="main-content" className="lotPage">
    <section className="lotWrap" role="status">
      <h1>Preview lot not found</h1>
      <p>This LOT is not in the sample inventory. No vehicle details or bids are available.</p>
      <a href="/inventory">Back to vehicle catalog</a>
    </section>
  </main>;

  return <main id="main-content" className="lotPage">
    <header className="lotHeader">
      <a className="lotLogo" href="/"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="lotNav"><a href="/inventory">Inventory</a><a href="/live-auctions">Live auctions</a><a href="/platform#how">How it works</a><a href="/transport">Transport</a></nav>
      <div className="lotHeaderActions"><a href="/inventory">← Back</a><button className="lotGreen">Вход</button></div>
    </header>

    <div className="lotWrap">
      <div className="lotBreadcrumb"><a href="/">Home</a> / <a href="/inventory">Inventory</a> / {lot}</div>
      <div className="lotTitleRow"><div><div className="lotTitleMeta"><span className="lotPill green">● PREVIEW AUCTION</span><span className="lotPill">LOT {lot}</span><span className="lotPill">DEMO DATA</span></div><h1>{title}</h1></div><div className="lotTitleMeta"><button type="button" className="lotPill" aria-pressed={isSaved} onClick={toggleSaved}>{isSaved?"♥ Saved preview":"♡ Save preview"}</button><button type="button" className="lotPill" onClick={()=>setShareUrl(window.location.href)}>↗ Share</button>{shareUrl&&<label>Link to lot<input type="text" readOnly value={shareUrl} onFocus={event=>event.currentTarget.select()} aria-label="Copy lot URL"/></label>}</div></div>

      <div className="lotGrid">
        <div>
          <div className="lotGallery" data-design-task="D19" aria-label={`Галерия за ${title}`}>
            <button ref={viewerTriggerRef} type="button" className="lotMainImage" onClick={()=>setViewerOpen(true)} aria-label={`Open изображение ${activeImage+1} от ${lotGallery.length} на цял екран`}>
              <img src={lotGallery[activeImage]} alt={`${title} — изображение ${activeImage+1}`}/>
              <span className="lotImageBadge">PREVIEW PHOTO · {activeImage+1}/{lotGallery.length}</span>
              <span className="lotZoomHint" aria-hidden="true">⛶ Full screen</span>
            </button>
            {lot==="EA-10603"&&<a className="lotDemoPhotoCredit" href={GOLF_GTI_DEMO_PHOTO_CREDIT} target="_blank" rel="noopener noreferrer">Illustrative GTI photo · David Moffatt / Unsplash ↗</a>}
            <div className="lotThumbs" role="list" aria-label="Миниатюри на автомобила">{lotGallery.map((src,index)=><button type="button" key={src} className={`lotThumb ${index===activeImage?"active":""}`} onClick={()=>setActiveImage(index)} aria-label={`Покажи изображение ${index+1} от ${lotGallery.length}`} aria-pressed={index===activeImage}><img src={src} alt=""/></button>)}</div>
          </div>

          <section className="lotSection" data-design-task="D20" aria-labelledby="lot-key-facts-title" aria-describedby="lot-key-facts-description" style={{borderColor:"rgba(39,245,138,.18)",background:"linear-gradient(180deg,rgba(13,23,16,.96),rgba(8,16,11,.96))"}}>
            <div className="lotSectionHead"><div><h2 id="lot-key-facts-title">Key lot data</h2><span id="lot-key-facts-description">The most important information before bidding</span></div><span className="lotPill green">6 verified fields</span></div>
            <div className="lotSpecs" role="list" aria-label="Ключови данни за автомобила" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
              <div className="lotSpec" role="listitem"><span>VIN</span><b style={{overflowWrap:"anywhere"}}>{vehicle?.vin??"Unknown"}</b></div>
              <div className="lotSpec" role="listitem"><span>LOT</span><b>{lot}</b></div>
              <div className="lotSpec" role="listitem"><span>Mileage</span><b>{vehicle?.mileage??"Unknown"}</b></div>
              <div className="lotSpec" role="listitem"><span>Primary damage</span><b>{vehicle?.damage??"Unknown"}</b></div>
              <div className="lotSpec" role="listitem"><span>Документ</span><b>{vehicle?.titleStatus??"Unknown"}</b></div>
              <div className="lotSpec" role="listitem"><span>Location</span><b style={{overflowWrap:"anywhere"}}>{vehicle?.location??"Unknown"}</b></div>
            </div>
          </section>

          <section className="lotSection lotConditionSection" data-design-task="D22" aria-labelledby="lot-condition-title" aria-describedby="lot-condition-description">
            <div className="lotSectionHead lotConditionHead"><div><h2 id="lot-condition-title">Condition, inspection and provenance</h2><span id="lot-condition-description">A structured view of available data and what is not yet confirmed.</span></div><span className="lotPill green">LOT DATA SNAPSHOT</span></div>
            <div className="lotConditionGrid">
              <article className="lotConditionCard" aria-labelledby="lot-condition-summary-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">01</span><div><strong id="lot-condition-summary-title">Condition</strong><small>Auction lot data</small></div></div>
                <dl className="lotConditionList"><div><dt>Run status</dt><dd><span className="lotConditionStatus neutral">Not independently inspected</span></dd></div><div><dt>Primary damage</dt><dd>{vehicle?.damage??"Unknown"}</dd></div><div><dt>Secondary damage</dt><dd>Not specified</dd></div></dl>
              </article>

              <article className="lotConditionCard" aria-labelledby="lot-inspection-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">02</span><div><strong id="lot-inspection-title">Inspection</strong><small>Clear separation of verified data</small></div></div>
                <ul className="lotInspectionList"><li><span>Visual damage</span><b className="lotConditionStatus positive">Documented</b></li><li><span>Mechanical inspection</span><b className="lotConditionStatus neutral">No linked report</b></li><li><span>Diagnostics</span><b className="lotConditionStatus neutral">No linked report</b></li></ul>
              </article>

              <article className="lotConditionCard" aria-labelledby="lot-provenance-title">
                <div className="lotConditionCardHead"><span className="lotConditionIcon" aria-hidden="true">03</span><div><strong id="lot-provenance-title">Provenance & documents</strong><small>Identification & history</small></div></div>
                <dl className="lotConditionList"><div><dt>Документ</dt><dd>{vehicle?.titleStatus??"Unknown"}</dd></div><div><dt>VIN</dt><dd className="lotConditionVin">{vehicle?.vin??"Unknown"}</dd></div><div><dt>Location</dt><dd>{vehicle?.location??"Unknown"}</dd></div></dl>
                <a className="lotHistoryLink" href="/vehicle-history" aria-label={`Провери историята на ${title}`}>Check vehicle history →</a>
              </article>
            </div>
            <p className="lotConditionDisclosure" role="note">This is an ENCHEV demo presentation of lot data. Missing external inspection or provenance reports are marked as unverified instead of being shown as fact.</p>
          </section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>Bid history</h2><span>Illustrative demo events — not an authoritative bid ledger</span></div></div><div className="lotHistory">{lot==="EA-10539"?history.map(row=><div className="lotHistoryRow" key={row.join("-")}><b>{row[0]}</b><b>{row[1]}</b><span>{row[2]}</span></div>):<p>No preview bid history for this lot.</p>}</div></section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>Transport</h2><span>Estimated transport cost to Bulgaria</span></div></div><div className="lotTransport"><div className="lotTransportBox"><label>Destination<select defaultValue="sofia"><option value="sofia">Sofia, Bulgaria</option><option value="varna">Varna, Bulgaria</option><option value="sliven">Sliven, Bulgaria</option></select></label><label style={{marginTop:10}}>Postal code<input placeholder="1000"/></label></div><div className="lotTransportPrice"><span>Estimated transport</span><b>€1 480</b><small>7–14 business days · insured transport</small></div></div></section>

          <section className="lotSection"><div className="lotSectionHead"><div><h2>Similar vehicles</h2><span>Other active lots</span></div></div><div className="lotRelated"><a href="/lot/EA-10482"><img src="https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=900&q=82" alt="BMW M4"/><div><b>2018 BMW M4 F82</b><span>€12 750 · LOT EA-10482</span></div></a><a href="/lot/EA-10511"><img src="https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=900&q=82" alt="Mercedes GLC"/><div><b>2021 Mercedes-Benz GLC</b><span>€18 400 · LOT EA-10511</span></div></a><a href="/lot/EA-10702"><img src="https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=900&q=82" alt="Porsche Macan"/><div><b>2023 Porsche Macan S</b><span>€28 750 · LOT EA-10702</span></div></a></div></section>
        </div>

        <aside id="lot-bid-panel" className="lotBidPanel" data-design-task="D21" data-sticky-task="D23" aria-labelledby="lot-auction-panel-title">
          <div className="lotLiveRow"><span className="lotLiveBadge"><i/> LIVE</span><span className="lotCountdown" data-urgent={countdown<=3?"true":"false"} role="timer" aria-live="polite" aria-label={`Remainingщо време ${countdown} секунди`}>00:{String(countdown).padStart(2,"0")}</span></div>
          <h2 id="lot-auction-panel-title">Current bid</h2><div className="lotCurrentBid" aria-live="polite">€{bid.toLocaleString("bg-BG")}</div><div className="lotBidHint" id="lot-bid-minimum">Next minimum bid: €{minimumBid.toLocaleString("bg-BG")}</div>
          <label className="lotBidLabel" htmlFor="lot-bid-input">Your bid</label>
          <div className="lotBidInputRow"><input ref={bidInputRef} id="lot-bid-input" className="lotBidInput" value={bidInput} onChange={e=>setBidInput(e.target.value)} inputMode="numeric" aria-describedby="lot-bid-minimum"/><button type="button" className="lotBidBtn" onClick={placeBid}>Bid</button></div>
          <div className="lotMaxBid" aria-labelledby="lot-max-bid-title">
            <div className="lotMaxBidHead"><div><strong id="lot-max-bid-title">Max bid</strong><span>Save максимален лимит за тази сесия</span></div>{maxBid!==null&&<b aria-live="polite">€{maxBid.toLocaleString("bg-BG")}</b>}</div>
            <label className="lotBidLabel" htmlFor="lot-max-bid-input">Maximum bid</label>
            <div className="lotMaxBidRow"><input id="lot-max-bid-input" className="lotMaxBidInput" value={maxBidInput} onChange={e=>setMaxBidInput(e.target.value)} inputMode="numeric" aria-describedby="lot-max-bid-help"/><button type="button" className="lotMaxBidBtn" onClick={saveMaxBid}>Set max</button></div>
            <small id="lot-max-bid-help">Minimum €{minimumBid.toLocaleString("bg-BG")} · the value is a local demo setting until backend integration.</small>
          </div>
          {vehicle?.buyNow ? <><button type="button" className="lotBuyNow" onClick={()=>setBuyNowNotice("Demo listing only. No checkout or payment was initiated.")}>Preview Buy Now · €{vehicle.buyNow.toLocaleString("bg-BG")}</button>{buyNowNotice&&<p role="status" aria-live="polite">{buyNowNotice}</p>}</> : <p role="status">Buy Now is unavailable for this preview lot.</p>}
          <div className="lotFees"><div><span>Current bid</span><b>€{bid.toLocaleString("bg-BG")}</b></div><div><span>Estimated fees</span><b>€980</b></div><div><span>Transport</span><b>от €1 480</b></div></div>
          <div className="lotNotice">This is the visual ENCHEV Lot Details flow. Real payments, identity verification and server-side bid locking will be connected in the backend stage.</div>
        </aside>
      </div>
    </div>

    {!viewerOpen&&<section className="lotMobileBidDock" data-design-task="D23" aria-label="Бързи действия за офериране">
      <div className="lotMobileBidSummary"><span>Current bid</span><strong>€{bid.toLocaleString("bg-BG")}</strong><small>Minimum €{minimumBid.toLocaleString("bg-BG")}</small></div>
      <button type="button" className="lotMobileBidAction" onClick={focusBidPanel} aria-controls="lot-bid-panel">Go to bid</button>
    </section>}

    {viewerOpen&&<div className="lotViewer" role="dialog" aria-modal="true" aria-labelledby="lot-viewer-title" onMouseDown={event=>{if(event.target===event.currentTarget)setViewerOpen(false)}}>
      <div className="lotViewerShell">
        <div className="lotViewerTop">
          <div><span>ENCHEV MEDIA VIEWER</span><strong id="lot-viewer-title">{title}</strong></div>
          <button ref={viewerCloseRef} type="button" className="lotViewerClose" onClick={()=>setViewerOpen(false)} aria-label="Close галерията">✕</button>
        </div>
        <div className="lotViewerStage">
          <button type="button" className="lotViewerNav lotViewerPrev" onClick={showPreviousImage} aria-label="Предишно изображение">‹</button>
          <img src={lotGallery[activeImage]} alt={`${title} — изображение ${activeImage+1} на цял екран`}/>
          <button type="button" className="lotViewerNav lotViewerNext" onClick={showNextImage} aria-label="Nextо изображение">›</button>
        </div>
        <div className="lotViewerBottom">
          <span className="lotViewerCount" aria-live="polite">Изображение {activeImage+1} от {lotGallery.length}</span>
          <div className="lotViewerThumbs" aria-label="Избери изображение">{lotGallery.map((src,index)=><button type="button" key={`viewer-${src}`} className={`lotViewerThumb ${index===activeImage?"active":""}`} onClick={()=>setActiveImage(index)} aria-label={`Покажи изображение ${index+1}`} aria-pressed={index===activeImage}><img src={src} alt=""/></button>)}</div>
        </div>
      </div>
    </div>}
  </main>;
}
