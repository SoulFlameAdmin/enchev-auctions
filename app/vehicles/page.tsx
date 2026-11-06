"use client";

import {useEffect,useMemo,useState} from "react";
import EaOfficialLogo from "../components/EaOfficialLogo";
import "./vehicles.css";

type MarketLot={
 id:string;lot_number:string;title:string;make:string;model:string;
 model_year:number|null;country_code:string|null;condition_summary:string|null;
 starting_price:number|null;price_currency:string;status:string;auction_starts_at:string|null;
 auction_ends_at:string|null;image_url:string|null;mileage_km:number|null;
 fuel_type:string|null;transmission:string|null;power_kw:number|null;body_type:string|null;
};
type Session={available:boolean;authenticated:boolean;user?:{id:string;email:string;accountAgeDays?:number|null}};
type Mode="loading"|"ready"|"inactive"|"error";
type Filter="all"|"live"|"scheduled"|"ended";
const marketPhotos=["/forge/media/9b20239c5e1099a605ec.jpg","/forge/media/20ac6eaa8d0b086cee3c.jpg","/forge/media/81f625f9053d53ae5f72.jpg"];
function EuroIcon(){return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.5"/><path d="m15.8 15.8 4.5 4.5"/></svg>}
function CarIcon(){return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 16.5h16l-1.8-6A2 2 0 0 0 16.3 9H7.7a2 2 0 0 0-1.9 1.5zM5 16.5V20m14-3.5V20M7.5 9 9 5h6l1.5 4"/><circle cx="7.5" cy="16.5" r="1"/><circle cx="16.5" cy="16.5" r="1"/></svg>}
function Bookmark(){return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>}
function Profile(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2.5a8 8 0 0 1 16 0V21"/></svg>}
function Bell(){return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4"/></svg>}
function price(value:number|null,currency:string){
 if(value===null||!Number.isFinite(value))return "При запитване";
 const code=/^(EUR|USD|BGN)$/i.test(currency)?currency.toUpperCase():"EUR";
 return new Intl.NumberFormat("bg-BG",{style:"currency",currency:code,maximumFractionDigits:0}).format(value);
}
function dateLabel(source:string|null){
 if(!source)return null;
 const date=new Date(source);
 return Number.isFinite(date.valueOf())?new Intl.DateTimeFormat("bg-BG",{timeZone:"Europe/Sofia",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date):null;
}
function activeLive(lot:MarketLot,time:number){
 return lot.status==="live"&&!!lot.auction_starts_at&&!!lot.auction_ends_at&&
 Date.parse(lot.auction_starts_at)<=time&&Date.parse(lot.auction_ends_at)>time;
}
function remaining(target:string|null,time:number){
 if(!target)return "—";
 const t=Math.max(0,Math.floor((Date.parse(target)-time)/1000));
 const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;
 return [h,m,s].map(n=>String(n).padStart(2,"0")).join(":");
}
function photoFor(lot:MarketLot){return typeof lot.image_url==="string"&&lot.image_url.startsWith("https://ejfrnjhlggebzmpmxajl.supabase.co/storage/v1/object/public/enchev-lot-public/")?lot.image_url:null}
function statusLabel(lot:MarketLot,now:number){return activeLive(lot,now)?"НА ЖИВО":lot.status==="scheduled"?"ПРЕДСТОЯЩ":lot.status==="ended"?"ЗАВЪРШЕН":"ОБЯВА";}
function LotPhoto({lot,hero=false}:{lot:MarketLot;hero?:boolean}){
 const [broken,setBroken]=useState(false);
 const src=photoFor(lot);
 return <div className={hero?"eaMarketLotPhoto eaMarketLotPhotoLarge":"eaMarketLotPhoto"}>
  {src&&!broken?<img src={src} alt={"Автомобил: "+lot.title} loading={hero?"eager":"lazy"} onError={()=>setBroken(true)}/>:
   <div className="eaMarketNoPhoto"><CarIcon/><span>Снимката се подготвя</span></div>}
 </div>;
}
export default function VehiclesPage(){
 const [lots,setLots]=useState<MarketLot[]>([]);
 const [mode,setMode]=useState<Mode>("loading");
 const [session,setSession]=useState<Session|null>(null);
 const [query,setQuery]=useState("");
 const [make,setMake]=useState("");
 const [year,setYear]=useState("");
 const [tab,setTab]=useState<Filter>("all");
 const [sort,setSort]=useState("newest");
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [now,setNow]=useState(0);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [gated,setGated]=useState<MarketLot|null>(null);

 useEffect(()=>{
  const fromUrl=new URLSearchParams(window.location.search).get("q");
  if(fromUrl)setQuery(fromUrl.slice(0,140));
  const ctrl=new AbortController();
  fetch("/api/buyer/catalog",{cache:"no-store",signal:ctrl.signal})
   .then(async r=>({ok:r.ok,body:await r.json()}))
   .then(({ok,body})=>{
    if(ctrl.signal.aborted)return;
    if(!ok){setMode(body?.available===false?"inactive":"error");return}
    setLots(Array.isArray(body.lots)?body.lots:[]);
    setMode("ready");
   }).catch(()=>{if(!ctrl.signal.aborted)setMode("error")});
  fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store",signal:ctrl.signal})
   .then(r=>r.json()).then(data=>{if(!ctrl.signal.aborted)setSession(data)}).catch(()=>{});
  return()=>ctrl.abort();
 },[]);
 const liveCount=lots.filter(l=>l.status==="live").length;
 useEffect(()=>{
  setNow(Date.now());
  if(!liveCount)return;
  const id=window.setInterval(()=>setNow(Date.now()),1000);
  return()=>window.clearInterval(id);
 },[liveCount]);
 const clock=now||0;
 const live=lots.find(l=>activeLive(l,clock))??null;
 const makes=useMemo(()=>[...new Set(lots.map(l=>l.make).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"bg")),[lots]);
 const years=useMemo(()=>[...new Set(lots.map(l=>l.model_year).filter((n):n is number=>typeof n==="number"))].sort((a,b)=>b-a),[lots]);
 const tabs:{id:Filter;label:string}[]=[{id:"all",label:"Всички"},{id:"live",label:"LIVE"},{id:"scheduled",label:"Предстоящи"},{id:"ended",label:"Завършени"}];
 const filtered=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase("bg");
  const values=lots.filter(l=>{
   if(q&&!(l.make+" "+l.model+" "+l.title+" "+l.lot_number).toLocaleLowerCase("bg").includes(q))return false;
   if(make&&l.make!==make)return false;
   if(year&&l.model_year!==Number(year))return false;
   if(tab!=="all"&&l.status!==tab)return false;
   return true;
  });
  return [...values].sort((a,b)=>{
   if(sort==="year")return (b.model_year||0)-(a.model_year||0);
   if(sort==="price")return (a.starting_price??Infinity)-(b.starting_price??Infinity);
   return (Date.parse(b.auction_starts_at||"")||0)-(Date.parse(a.auction_starts_at||"")||0);
  });
 },[lots,query,make,year,tab,sort]);

 const age=session?.authenticated?session.user?.accountAgeDays:null;
 const stepsUnlocked=typeof age==="number"&&age>=7;
 const registered=session?.authenticated===true;
 const nextFor=(lot:MarketLot)=>"/vehicles/"+encodeURIComponent(lot.id);
 async function save(lot:MarketLot){
  if(!registered){setGated(lot);return}
  setBusy(lot.id);setNotice("");
  try{
   const r=await fetch("/api/buyer/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({lot_id:lot.id})});
   const j=await r.json();
   if(!r.ok||j.ok!==true){setNotice("Неуспешно записване. Провери профила си.");return}
   setNotice("Автомобилът е добавен към запазените ти обяви.");
  }catch{setNotice("Възникна временен проблем със запазването.");}
  finally{setBusy(null)}
 }
 return <main id="main-content" className="eaMarketPage">
  <div className="eaMarketShell">
   <header className="eaMarketTop">
    <a className="eaMarketBrand" href="/" aria-label="E&A Начало"><EaOfficialLogo/></a>
    <div className="eaMarketTopLinks">
     <a href="/vehicles" aria-current="page">Автомобили</a>
     <a href="/auctions">Търгове</a>
     <a href="/transport">Транспорт</a>
    </div>
    <div className="eaMarketTopActions">
     {stepsUnlocked&&<a className="eaMarketStepsLink" href="/start" title={typeof age==="number"&&age>=30?"Насоки след първия месец":"Насоки след първата седмица"}>Моите стъпки <span>{age!==null&&age>=30?"30+":"7+"}</span></a>}
     {registered&&<a className="eaMarketTopSquare" href="/profile" aria-label="Известия в профила"><Bell/></a>}
     <a className="eaMarketProfile" href={registered?"/profile":"/login"} aria-label={registered?"Моят профил":"Вход в профила"}><Profile/><span>{registered?"Моят профил":"Вход"}</span></a>
    </div>
   </header>

   <nav className="eaMarketQuick" aria-label="Бърза навигация">
    <a className="active" href="/vehicles"><CarIcon/> Автомобили</a>
    <a href="/auctions"><span className="eaMarketPulse"/> LIVE</a>
    <a href="#ea-market-catalog">Каталог</a>
    <a href={registered?"/profile":"/login"}><Bookmark/> Запазени</a>
   </nav>

   <section className="eaMarketHero" aria-labelledby="ea-market-headline">
    <div className="eaMarketHeroIntro">
     <span className="eaMarketEyebrow">E&A · ОНЛАЙН АВТОМОБИЛНИ ТЪРГОВЕ</span>
     <h1 id="ea-market-headline">ПРОФЕСИОНАЛНИ<br/>АУКЦИОНИ НА<br/><em>АВТОМОБИЛИ</em></h1>
     <p>E&A East and West Auctioneers Group — платформа за покупка и продажба на автомобили чрез онлайн търгове в България и Европа.</p>
     <div className="eaMarketTrust"><span>✓ Проверени автомобили</span><span>✓ Прозрачни търгове</span><span>✓ Доверен партньор</span></div>
    </div>

    <div className="eaMarketLive" aria-label="Акцент на търговете">
     <div className="eaMarketLivePhoto">
      {live?<LotPhoto lot={live} hero/>:<img src="/forge/media/9b20239c5e1099a605ec.jpg" alt="Илюстративен автомобил за представяне на платформата" loading="eager"/>}
      <span className={live?"eaMarketLiveTag live":"eaMarketLiveTag"}><span className="eaMarketPulse"/> {live?"LIVE АУКЦИОН":"ПРЕДСТОЯЩ LIVE"}</span>
      {!live&&<span className="eaMarketIllustration">ИЛЮСТРАТИВНО ИЗОБРАЖЕНИЕ</span>}
      {live&&<span className="eaMarketLotId">Лот {live.lot_number}</span>}
     </div>
     <div className="eaMarketLiveBody">
      {live?<><h2>{live.title}</h2><div className="eaMarketChips"><span>{live.model_year||"Година предстои"}</span><span>{live.fuel_type||"Детайли в обявата"}</span>{live.mileage_km!==null&&<span>{live.mileage_km.toLocaleString("bg-BG")} км</span>}</div><div className="eaMarketLiveStats"><div><small>Начална цена</small><strong>{price(live.starting_price,live.price_currency)}</strong></div><div><small>До края на лота</small><strong className="eaMarketTimer">{remaining(live.auction_ends_at,clock)}</strong></div></div><a className="eaMarketActionHot" href={nextFor(live)}>Виж лота и условията ↗</a><p className="eaMarketLiveDisclaimer">Участието и реалните оферти изискват потвърден профил и отделно активиране на наддаването.</p></>:
       <div className="eaMarketLiveEmpty"><span>ПРОВЕРЕНА LIVE ИНФОРМАЦИЯ</span><h2>Следващият търг предстои.</h2><p>В момента няма активен потвърден търг. Когато бъде публикуван, тук ще се покажат автомобилът, началната цена и реалният таймер.</p><a className="eaMarketActionHot" href="/auctions">Виж търговете ↗</a></div>}
     </div>
    </div>
   </section>

   <aside className="eaMarketPromo" aria-label="Регистрация и отстъпка">
    <span className="eaMarketPromoMark" aria-hidden="true">%</span>
    <div className="eaMarketPromoText"><strong>Регистрирай се и получи код за <em>10% отстъпка</em></strong><small>Промокампанията предстои да се активира. Отстъпката ще важи само за определени такси, съгласно условията.</small></div>
    <a href="/register?campaign=welcome10" className="eaMarketPromoButton">Регистрирай се сега <span aria-hidden="true">→</span></a>
   </aside>

   <section id="ea-market-catalog" className="eaMarketCatalog">
    <div className="eaMarketSearchTop"><div><span className="eaMarketEyebrow">E&A · VERIFIED VEHICLE MARKETPLACE</span><h2>Автомобили на търг</h2></div><a href="/vehicle-history">Проверка на историята ↗</a></div>
    <div className="eaMarketSearchRow">
     <label className="eaMarketSearch" htmlFor="ea-market-search"><EuroIcon/><input id="ea-market-search" type="search" value={query} maxLength={140} placeholder="Марка, модел, номер на лот..." onChange={e=>setQuery(e.target.value)}/></label>
     <select value={make} onChange={e=>setMake(e.target.value)} aria-label="Марка"><option value="">Всички марки</option>{makes.map(m=><option value={m} key={m}>{m}</option>)}</select>
     <select value={year} onChange={e=>setYear(e.target.value)} aria-label="Година"><option value="">Всяка година</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
     <button className="eaMarketFilterBtn" type="button" aria-expanded={filtersOpen} aria-controls="ea-market-morefilters" onClick={()=>setFiltersOpen(x=>!x)}>☷ Филтри</button>
    </div>
    {filtersOpen&&<div className="eaMarketMoreFilters" id="ea-market-morefilters">
      <label>Подреди по <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Най-нови търгове</option><option value="year">Най-нова година</option><option value="price">Най-ниска начална цена</option></select></label>
      <button type="button" onClick={()=>{setQuery("");setMake("");setYear("");setTab("all");setSort("newest")}}>Изчисти филтрите</button>
     </div>}
    <div className="eaMarketCatalogBar">
     <div className="eaMarketCatalogTabs" role="group" aria-label="Състояние на лотовете">{tabs.map(t=><button key={t.id} type="button" className={tab===t.id?"selected":""} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}{mode==="ready"&&<small>{t.id==="all"?lots.length:lots.filter(l=>l.status===t.id).length}</small>}</button>)}</div>
     <span className="eaMarketCatalogCount">{mode==="ready"?filtered.length+" одобрени обяви":"Проверка на каталога"}</span>
    </div>

    {mode==="ready"&&filtered.length>0?<div className="eaMarketLotGrid">{filtered.map(l=><article className="eaMarketCard" key={l.id}>
      <a className="eaMarketCardImage" href={nextFor(l)}><LotPhoto lot={l}/><span className={activeLive(l,clock)?"eaMarketCardStatus live":"eaMarketCardStatus"}>{statusLabel(l,clock)}</span></a>
      <div className="eaMarketCardContent"><span className="eaMarketCardLot">ЛОТ {l.lot_number} · {l.country_code||"ЕВРОПА"}</span><h3><a href={nextFor(l)}>{l.title}</a></h3><div className="eaMarketCardSpecs">{l.model_year&&<span>{l.model_year} г.</span>}{l.mileage_km!==null&&<span>{l.mileage_km.toLocaleString("bg-BG")} км</span>}{l.fuel_type&&<span>{l.fuel_type}</span>}{l.transmission&&<span>{l.transmission}</span>}</div><div className="eaMarketCardBottom"><div><small>Начална цена</small><strong>{price(l.starting_price,l.price_currency)}</strong></div><button type="button" onClick={()=>void save(l)} disabled={busy===l.id} aria-label={"Запази "+l.title}><Bookmark/></button></div><a className="eaMarketCardDetails" href={nextFor(l)}>Виж детайли <span>↗</span></a></div>
     </article>)}</div>:
     <div className="eaMarketAwaiting" role="status">
      <div className="eaMarketPreviewNotice"><span className="eaMarketEyebrow">ПРЕГЛЕД НА БЪДЕЩИЯ КАТАЛОГ</span><strong>Тук ще се появяват реалните автомобили.</strong><p>След проверка на продавача и публикуване на лота снимката, характеристиките, началната цена и графикът ще се зареждат автоматично. Следващите карти са само визуален пример и не са обяви.</p></div>
      {!query&&!make&&!year&&tab==="all"&&<div className="eaMarketPreviewGrid" aria-label="Визуални примерни карти, не реални обяви">
        {[
          {title:"BMW · Седан",image:"/forge/media/9b20239c5e1099a605ec.jpg"},
          {title:"Mercedes-Benz · SUV",image:"/forge/media/20ac6eaa8d0b086cee3c.jpg"},
          {title:"Audi · SUV",image:"/forge/media/81f625f9053d53ae5f72.jpg"},
          {title:"Премиум автомобили",image:"/images/enchev-lamborghini-hero.jpg"},
        ].map((item,i)=><article className="eaMarketPreviewCard" key={item.title}>
         <div className="eaMarketPreviewPhoto"><img src={item.image} alt={"Илюстративна снимка "+(i+1)} loading="lazy"/><span>ВИЗУАЛЕН ПРИМЕР</span></div>
         <div className="eaMarketPreviewCardBody"><h3>{item.title}</h3><p>Снимки · Технически данни · VIN история</p><div className="eaMarketPreviewPrice"><small>Цена при одобрена обява</small><strong>Очаква се</strong></div><a href="/start#early-access">Известете ме при старта ↗</a></div>
        </article>)}
      </div>}
     </div>
     <div className="eaMarketEmpty" role="status">
      <div className="eaMarketEmptyImage" aria-hidden="true"><img src={marketPhotos[1]} alt=""/></div>
      <div className="eaMarketEmptyContent"><span className="eaMarketEyebrow">{mode==="inactive"?"ПРЕДСТОЯЩО АКТИВИРАНЕ":mode==="error"?"ВРЕМЕНЕН ПРОБЛЕМ":mode==="loading"?"ЗАРЕЖДАНЕ":query||make||year||tab!=="all"?"ТЪРСЕНЕ":"ПРОВЕРЕН КАТАЛОГ"}</span>
       <h3>{mode==="inactive"?"Каталогът се подготвя.":mode==="error"?"Не успяхме да заредим каталога.":mode==="loading"?"Проверяваме одобрените автомобили...":query||make||year||tab!=="all"?"Няма автомобили с тези критерии.":"Очакваме първите реални обяви."}</h3>
       <p>Показваме само потвърдени автомобили от проверени продавачи. Няма да публикуваме примерни оферти като реални. Изображението е илюстративно.</p>
       <div className="eaMarketEmptyActions"><a href="/start#early-access">Заяви ранен достъп ↗</a><a href="/auctions">Търгове ↗</a></div>
      </div>
     </div>}
    {notice&&<p className="eaMarketNotice" role="status">{notice}</p>}
   </section>

   <div className="eaMarketFooterProof"><span>Сигурни профили</span><span>Проверени обяви</span><span>Ясни такси и документи</span><a href="/support">Помощ ↗</a></div>
  </div>
  {gated&&<div className="eaMarketModalShade" role="presentation" onClick={()=>setGated(null)}>
    <section role="dialog" aria-modal="true" aria-labelledby="ea-market-modal-title" className="eaMarketModal" onClick={e=>e.stopPropagation()}>
      <button className="eaMarketModalClose" type="button" onClick={()=>setGated(null)} aria-label="Затвори">×</button>
      <span className="eaMarketEyebrow">Е&А · КУПУВАЧЕСКИ ПРОФИЛ</span><h2 id="ea-market-modal-title">Запази автомобила в профила си.</h2>
      <p>За запазени автомобили и участие в търгове е необходима регистрация. Реалното наддаване изисква допълнителна проверка и активиране.</p>
      <div className="eaMarketModalLinks"><a href={"/register?next="+encodeURIComponent(nextFor(gated))}>Регистрирай се ↗</a><a href={"/login?next="+encodeURIComponent(nextFor(gated))}>Вече имам профил</a></div>
    </section>
   </div>}
 </main>;
}
