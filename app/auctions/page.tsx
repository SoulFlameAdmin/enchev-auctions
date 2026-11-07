"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import EaOfficialLogo from "../components/EaOfficialLogo";
import "./auctions.css";

type Vehicle={lot:string;title:string;year:number;fuel:string;mileage:string;transmission:string;startingPrice:number;image?:string};
type VerifiedLot={
 id:string;lot_number:string;title:string;make:string;model:string;model_year:number|null;
 fuel_type:string|null;mileage_km:number|null;transmission:string|null;image_url:string|null;
 starting_price:number|null;price_currency:string;status:string;auction_starts_at:string|null;auction_ends_at:string|null
};
type Clock={serverNow:number;roundEndsAt:number;lotIndex:number;auctionAuthority:boolean;scope:string;receivedAt:number};
type IconName="home"|"car"|"broadcast"|"layers"|"bookmark"|"user"|"chevron-left"|"chevron-right"|"clock"|"gavel"|"calendar"|"history"|"shield"|"camera"|"arrow"|"info"|"heart"|"bell"|"share"|"check";
const IMG="/images/ea-auctions/";
const bmw:Vehicle={lot:"EA-87421",title:"BMW 530d xDrive M Sport",year:2021,fuel:"Дизел",mileage:"96 420 км",transmission:"Автоматик",startingPrice:72500,image:IMG+"main.webp"};
const nextDemo:readonly Vehicle[]=[
 {lot:"EA-87441",title:"Mercedes-Benz GLE",year:2022,fuel:"Дизел",mileage:"72 800 км",transmission:"Автоматик",startingPrice:63000},
 {lot:"EA-87462",title:"Audi Q7",year:2020,fuel:"Дизел",mileage:"82 500 км",transmission:"Автоматик",startingPrice:56200},
 {lot:"EA-87483",title:"Range Rover Sport",year:2021,fuel:"Дизел",mileage:"67 500 км",transmission:"Автоматик",startingPrice:62700},
 {lot:"EA-87519",title:"BMW X5",year:2022,fuel:"Дизел",mileage:"76 100 км",transmission:"Автоматик",startingPrice:68900}
];
const demoBidRows=[
 {buyer:"Пример #4821",price:72500},
 {buyer:"Пример #3719",price:72000},
 {buyer:"Пример #3560",price:71500},
 {buyer:"Пример #2994",price:71000},
 {buyer:"Пример #2731",price:70500}
] as const;
const demoQueueSeconds=[28*60+17,46*60+5,72*60+33,95*60+20];
const paths:Record<IconName,string>={
 home:"M3 10 12 3l9 7v11h-6v-7H9v7H3z",car:"M4 16h16l-2-7H6zM7 9l1-4h8l1 4M5 16v3m14-3v3",
 broadcast:"M12 12h.01M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14",
 layers:"m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
 bookmark:"M5 3h14v18l-7-4-7 4z",user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2",
 "chevron-left":"m15 18-6-6 6-6","chevron-right":"m9 18 6-6-6-6",
 clock:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
 gavel:"m14 3 7 7M12 5l7 7M7 10l7 7M3 14l7 7M9 9l6-6 6 6-6 6zM2 22h15",
 calendar:"M3 5h18v16H3zM7 2v6m10-6v6M3 10h18",
 history:"M3 5v6h6M3 11a9 9 0 1 1 3 7M12 7v5l4 2",
 shield:"m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6zM8 12l3 3 5-6",
 camera:"M3 7h4l2-3h6l2 3h4v13H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 arrow:"M5 12h14m-6-6 6 6-6 6",info:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v5m0-9h.01",
 heart:"M20.5 9c0 4-8.5 11-8.5 11S3.5 13 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2z",
 bell:"M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21h4",
 share:"M18 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM6 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm12 7a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM8.7 13.4l6.6 4.1M8.7 10.6l6.6-4.1",
 check:"M5 12l4 4L19 6"
};
function Icon({name,size=20}:{name:IconName;size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function euro(v:number|null,c="EUR"){
 if(v===null||!Number.isFinite(v))return "При запитване";
 const code=/^(EUR|BGN|USD)$/i.test(c)?c.toUpperCase():"EUR";
 return new Intl.NumberFormat("bg-BG",{style:"currency",currency:code,maximumFractionDigits:0}).format(v);
}
function remaining(ms:number){
 if(!Number.isFinite(ms)||ms<=0)return "00:00";
 const seconds=Math.ceil(ms/1000),h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
 return h>0?[h,m,s].map(x=>String(x).padStart(2,"0")).join(":"):[m,s].map(x=>String(x).padStart(2,"0")).join(":");
}
function dateBG(s:string|null){
 if(!s)return "Датата предстои";
 const d=new Date(s);
 return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat("bg-BG",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Sofia"}).format(d):"Датата предстои";
}
function safeImage(s:string|null){
 return typeof s==="string"&&s.startsWith("https://ejfrnjhlggebzmpmxajl.supabase.co/storage/v1/object/public/enchev-lot-public/")?s:null;
}
function GalleryPhoto({src,alt}:{src:string|null;alt:string}){
 const [error,setError]=useState(false);
 useEffect(()=>setError(false),[src]);
 return src&&!error?<picture className="eaLivePicture">{src===IMG+"main.webp"&&<source media="(max-width:820px)" srcSet={IMG+"main-mobile.webp"}/>}<img src={src} alt={alt} loading="eager" onError={()=>setError(true)}/></picture>:
 <div className="eaLiveMissing"><Icon name="car" size={38}/><span>Снимка предстои</span></div>;
}
function pos(index:number,total:number){return total<=1?"center":("center "+(index*100/(total-1))+"%");}
function AppearanceIcon({light}:{light:boolean}){
 return light
 ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
 :<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M20.4 15.4A8.6 8.6 0 0 1 8.6 3.6 8.7 8.7 0 1 0 20.4 15.4Z"/></svg>;
}
export default function AuctionsPage(){
 const [verified,setVerified]=useState<VerifiedLot[]>([]);
 const [catalogState,setCatalogState]=useState<"checking"|"ready"|"unavailable">("checking");
 const [authenticated,setAuthenticated]=useState(false);
 const [clock,setClock]=useState<Clock|null>(null);
 const [clockOnline,setClockOnline]=useState(false);
 const [now,setNow]=useState(0);
 const [selectedShot,setSelectedShot]=useState(0);
 const [previewId,setPreviewId]=useState<number|null>(null);
 const [demoSaved,setDemoSaved]=useState(false);
 const [notice,setNotice]=useState("");
 const [demoOrigin,setDemoOrigin]=useState(0);
 const [appearance,setAppearance]=useState<"dark"|"light">("dark");
 const [auctionSearch,setAuctionSearch]=useState("");
 const [auctionMake,setAuctionMake]=useState("");
 const [auctionYear,setAuctionYear]=useState("");
 useEffect(()=>{
  try{const saved=localStorage.getItem("ea-vehicles-appearance-v1");if(saved==="dark"||saved==="light")setAppearance(saved);}catch{}
 },[]);
 function changeAppearance(){
  const next=appearance==="dark"?"light":"dark";
  setAppearance(next);
  try{localStorage.setItem("ea-vehicles-appearance-v1",next)}catch{}
 }
 useEffect(()=>{
  setDemoOrigin(Date.now());
  try{setDemoSaved(window.localStorage.getItem("ea-demo-bmw-watched-v1")==="yes")}catch{}
  const controller=new AbortController();
  const load=async()=>{
   try{
    const r=await fetch("/api/buyer/catalog",{cache:"no-store",signal:controller.signal});
    const j=await r.json();
    if(controller.signal.aborted)return;
    if(r.ok&&j?.ok&&Array.isArray(j.lots)){
     setVerified(j.lots.filter((x:VerifiedLot)=>x&&["scheduled","live"].includes(x.status)));
     setCatalogState("ready");
    }else setCatalogState("unavailable");
   }catch{if(!controller.signal.aborted)setCatalogState("unavailable")}
  };
  const session=async()=>{
   try{const r=await fetch("/api/enchev-auth/session",{signal:controller.signal,cache:"no-store"});const j=await r.json();if(!controller.signal.aborted)setAuthenticated(j?.authenticated===true);}catch{}
  };
  void load();void session();
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const ctrl=new AbortController();let busy=false;
  const sync=async()=>{
   if(busy||ctrl.signal.aborted)return;busy=true;
   try{
    const r=await fetch("/api/live-auction-clock",{signal:ctrl.signal,cache:"no-store"});
    if(!r.ok)throw new Error("unavailable");
    const d=await r.json() as Omit<Clock,"receivedAt">;
    if(d.auctionAuthority!==false||d.scope!=="server-issued-browser-session-demo"||!Number.isFinite(d.serverNow)||!Number.isFinite(d.roundEndsAt))throw new Error("invalid");
    if(!ctrl.signal.aborted){setClock({...d,receivedAt:Date.now()});setClockOnline(true);}
   }catch{if(!ctrl.signal.aborted)setClockOnline(false)}
   finally{busy=false};
  };
  void sync();setNow(Date.now());
  const i=window.setInterval(()=>void sync(),3500),tick=window.setInterval(()=>setNow(Date.now()),400);
  return()=>{ctrl.abort();window.clearInterval(i);window.clearInterval(tick)};
 },[]);
 const live=useMemo(()=>verified.filter(x=>x.status==="live"),[verified]);
 const upcoming=useMemo(()=>verified.filter(x=>x.status==="scheduled"),[verified]);
 const real=live[0]??null;
 const demo=previewId===null?bmw:nextDemo[previewId];
 const isMainDemo=!real&&previewId===null;
 const heading=real?real.title:demo.title;
 const amount=real?euro(real.starting_price,real.price_currency):euro(demo.startingPrice);
 const timeText=real?dateBG(real.auction_ends_at):clockOnline&&clock?remaining(clock.roundEndsAt-(now+(clock.serverNow-clock.receivedAt))):"--:--";
 const galleryLength=isMainDemo?5:1;
 const photo=real?safeImage(real.image_url):isMainDemo?IMG+"main.webp":null;
 const demoActive=real===null;
 const openLot=real?"/vehicles/"+real.id:"/live-auctions";
 const galleryStyle=useMemo(()=>{
  if(!isMainDemo||selectedShot===0)return undefined;
  return {backgroundImage:'url("'+IMG+'gallery.webp")',backgroundSize:"100% 500%",backgroundPosition:pos(selectedShot,5)};
 },[isMainDemo,selectedShot]);
 const auctionMakes=useMemo(()=>Array.from(new Set([...upcoming.map(v=>v.make),...nextDemo.map(v=>v.title.startsWith("Range Rover")?"Range Rover":v.title.split(" ")[0]),"BMW"].filter(Boolean))).sort((a,b)=>a.localeCompare(b,"bg")),[upcoming]);
 const auctionYears=useMemo(()=>Array.from(new Set([...upcoming.map(v=>v.model_year),bmw.year,...nextDemo.map(v=>v.year)].filter((y):y is number=>typeof y==="number"))).sort((a,b)=>b-a),[upcoming]);
 const matchesAuction=(title:string,lot:string,year:number|null)=>{
  const q=auctionSearch.trim().toLocaleLowerCase("bg");
  return (!q||(title+" "+lot).toLocaleLowerCase("bg").includes(q))
    &&(!auctionMake||title.toLocaleLowerCase("bg").includes(auctionMake.toLocaleLowerCase("bg")))
    &&(!auctionYear||year===Number(auctionYear));
 };
 const matchingUpcoming=upcoming.filter(v=>matchesAuction(v.title,v.lot_number,v.model_year));
 const matchingDemo=[bmw,...nextDemo].filter(v=>matchesAuction(v.title,v.lot,v.year));
 function changeShot(delta:number){setSelectedShot(v=>(v+delta+galleryLength)%galleryLength)}
 function selectNext(i:number){setPreviewId(i);setSelectedShot(0);document.querySelector(".eaLiveCarStage")?.scrollIntoView({behavior:"smooth",block:"start"});}
 function showBmw(){setPreviewId(null);setSelectedShot(0);document.querySelector(".eaLiveCarStage")?.scrollIntoView({behavior:"smooth",block:"start"});}
 async function share(){
  const url=window.location.href;
  try{
   if(navigator.share){await navigator.share({title:"E&A · Търгове на живо",url});setNotice("Линкът е споделен.");}
   else if(navigator.clipboard){await navigator.clipboard.writeText(url);setNotice("Линкът е копиран.");}
   else setNotice("Копирай адреса от браузъра.");
  }catch{setNotice("Линкът може да се копира от адресната лента.")}
 }
 async function watch(){
  if(!authenticated){window.location.assign("/register?next="+encodeURIComponent("/auctions"));return}
  if(real){
   try{
    const r=await fetch("/api/buyer/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({lot_id:real.id})});
    setNotice(r.ok?"Автомобилът е добавен в профила.":"Запазването не успя. Опитай отново.");
   }catch{setNotice("Няма връзка със системата за запазване.")}
   return;
  }
  const next=!demoSaved;setDemoSaved(next);
  try{window.localStorage.setItem("ea-demo-bmw-watched-v1",next?"yes":"no")}catch{}
  setNotice(next?"Демо автомобилът е добавен в наблюдаваните на този браузър.":"Демо автомобилът е премахнат от наблюдаваните.");
 }
 const buttons=(mobile:boolean)=><div className={mobile?"eaLiveActionGroup mobile":"eaLiveActionGroup"}>
   <a className="eaLiveBidAction" href={openLot}><Icon name="gavel" size={21}/>{real?"Виж лота":mobile?"Наддай сега":"Наддай сега"}{demoActive&&<span className="eaLiveDemoSuffix"> · ДЕМО</span>}</a>
   {real?<button type="button" onClick={()=>void watch()} className="eaLiveSaveAction"><Icon name="bookmark" size={19}/> Добави в наблюдавани</button>:
    <button type="button" onClick={()=>void watch()} className="eaLiveSaveAction" aria-pressed={demoSaved}><Icon name={demoSaved?"check":"bookmark"} size={19}/>{demoSaved?"В наблюдаваните":"Добави в наблюдавани"}</button>}
  </div>;
 const priceTimer=(mobile:boolean)=><div className={mobile?"eaLivePriceTimer mobile":"eaLivePriceTimer"}>
   <div className="eaLivePrice"><span>{real?"Начална цена":"Текуща оферта · ДЕМО"}</span><strong>{amount}</strong></div>
   <div className="eaLiveTimerCard"><span><Icon name="clock" size={17}/>{real?"Край по график":"Остава · ДЕМО"}</span><strong className="eaLiveCountdown" aria-live="off">{timeText}</strong></div>
  </div>;
 return <main id="main-content" className="eaLiveMarket eaLiveV2" data-appearance={appearance} data-ea-bid-mode={demoActive?"demo":"verified-no-bidding"}>
  <div className="eaLiveWrap">
   <header className="eaLiveHeader">
    <a href="/" className="eaLiveBrand" aria-label="E&A Начало"><EaOfficialLogo/></a>
    <nav className="eaLiveDesktopNav" aria-label="Основна навигация">
     <a href="/"><Icon name="home" size={17}/> Начало</a>
     <a href="/vehicles"><Icon name="car" size={17}/> Автомобили</a>
     <a href="/auctions" className="eaLiveNavActive" aria-current="page"><Icon name="broadcast" size={17}/> Търгове на живо</a>
     <a href="/vehicles#ea-market-catalog"><Icon name="layers" size={17}/> Каталог</a>
     <a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={17}/> Запазени</a>
    </nav>
    <div className="eaLiveHeaderRight">
     <a href={authenticated?"/profile":"/login"} className="eaLiveBell" aria-label="Известия в профила"><Icon name="bell" size={21}/></a>
     <a href={authenticated?"/profile":"/login"} className="eaLiveProfile" aria-label={authenticated?"Моят профил":"Вход в профила"}><Icon name="user" size={21}/></a>
    </div>
   </header>
   <nav className="eaLiveQuickNav" aria-label="Мобилни раздели">
    <a href="/vehicles"><Icon name="car" size={16}/> Автомобили</a>
    <a href="/auctions" className="is-current" aria-current="page"><Icon name="broadcast" size={16}/> LIVE</a>
    <a href="/vehicles#ea-market-catalog"><Icon name="layers" size={16}/> Каталог</a>
    <a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={16}/> Запазени</a>
   </nav>
   <section className="eaLiveTitleRow">
    <div className="eaLiveHeading">
     <span className="eaLiveHeroEyebrow">ОНЛАЙН АВТОМОБИЛНИ ТЪРГОВЕ</span>
     <h1><span>ПРОФЕСИОНАЛНИ<br/>АУКЦИОНИ НА<br/><em>АВТОМОБИЛИ</em></span></h1>
     <p>Проверени автомобили и предстоящи търгове.</p>
     <span className="eaLiveLiveCaveat">{demoActive?"ДЕМО · Примерните данни не са реални оферти":"ОДОБРЕН ЛОТ · Наддаването още не е активирано"}</span>
    </div>
    <button type="button" className="eaLiveAppearanceToggle" aria-label={appearance==="dark"?"Включи светъл режим":"Включи тъмен режим"} aria-pressed={appearance==="light"} onClick={changeAppearance}><AppearanceIcon light={appearance==="light"}/><span>{appearance==="dark"?"Светъл режим":"Тъмен режим"}</span></button>
   </section>
   {!authenticated&&<aside className="eaLiveRegisterBanner" aria-label="Регистрация">
    <div className="eaLiveRegisterPitch"><Icon name="user" size={22}/><strong>Регистрирай се, за да следиш търговете и да запазваш автомобили.</strong></div>
    <a href="/register?next=%2Fauctions">Регистрация <Icon name="arrow" size={17}/></a>
   </aside>}
   <div className="eaLiveMain">
    <section className="eaLiveCarStage" aria-label="Автомобил на фокус">
     <div className="eaLiveImageFrame">
      {isMainDemo&&selectedShot>0?<div className="eaLiveSpriteMain" role="img" aria-label={"Демо BMW · изглед "+(selectedShot+1)} style={galleryStyle}/>:
       !real&&previewId!==null?<div className="eaLiveSpriteMain" role="img" aria-label={"Демо "+heading} style={{backgroundImage:'url("'+IMG+'upcoming.webp")',backgroundSize:"100% 400%",backgroundPosition:pos(previewId,4)}}/>:
       <GalleryPhoto src={photo} alt={heading+(demoActive?" · демо изображение":" · снимка на одобрен лот")}/>}
      <span className="eaLivePhotoTag"><Icon name="broadcast" size={16}/>{real?"ОДОБРЕН ЛОТ":"НА ЖИВО · ДЕМО"}</span>
      <div className="eaLiveImageMeta"><span className="eaLiveLotId">Лот № {real?.lot_number??demo.lot}</span><button type="button" onClick={()=>void share()} className="eaLiveShare" aria-label="Сподели този търг"><Icon name="share" size={16}/></button></div>
      {galleryLength>1&&<>
       <button type="button" className="eaLiveSlidePrev" onClick={()=>changeShot(-1)} aria-label="Предишна снимка"><Icon name="chevron-left" size={27}/></button>
       <button type="button" className="eaLiveSlideNext" onClick={()=>changeShot(1)} aria-label="Следваща снимка"><Icon name="chevron-right" size={27}/></button>
       <div className="eaLiveDots" role="group" aria-label="Снимки на автомобила">{Array.from({length:galleryLength},(_,i)=><button type="button" key={i} aria-label={"Снимка "+(i+1)} aria-pressed={selectedShot===i} className={selectedShot===i?"active":""} onClick={()=>setSelectedShot(i)}/>)}</div>
      </>}
     </div>
     <div className="eaLiveGallery">
      {isMainDemo?Array.from({length:5},(_,i)=><button type="button" key={i} className={i===selectedShot?"active":""} aria-label={"Покажи снимка "+(i+1)} aria-pressed={i===selectedShot} onClick={()=>setSelectedShot(i)}><span className="eaLiveGallerySprite" style={{backgroundImage:'url("'+IMG+'gallery.webp")',backgroundSize:"100% 500%",backgroundPosition:pos(i,5)}}/></button>):
       <button type="button" className="eaLiveGalleryReturn" onClick={showBmw}><Icon name="chevron-left" size={17}/> {real?"Назад към BMW демо":"Назад към BMW"}</button>}
     </div>
     <div className="eaLiveCarSummary">
      <h2>{heading}</h2>
      <div className="eaLiveSpecs">
       <span><Icon name="calendar" size={16}/>{real?(real.model_year??"—"):demo.year} г.</span>
       <span><Icon name="car" size={16}/>{real?(real.fuel_type??"Не е посочено"):demo.fuel}</span>
       <span><Icon name="layers" size={16}/>{real?(real.transmission??"Не е посочено"):demo.transmission}</span>
       <span><Icon name="clock" size={16}/>{real?(typeof real.mileage_km==="number"?real.mileage_km.toLocaleString("bg-BG")+" км":"Не е посочен"):demo.mileage}</span>
      </div>
      {demoActive&&<small className="eaLiveCarDemoNote">Примерна автомобилна презентация · няма реален търг</small>}
     </div>
     <div className="eaLiveMobileBid">
      {priceTimer(true)}
      {buttons(true)}
      {notice&&<p className="eaLiveActionNotice" role="status">{notice}</p>}
     </div>
    </section>
    <aside className="eaLiveBidPanel" aria-label="Панел за търга">
     {priceTimer(false)}
     {buttons(false)}
     <p className="eaLiveBidDisclosure">{real?"Този лот е публикуван, но реалните оферти и плащания не са активирани.":"ДЕМО: сумата и автомобилът са примерни. Бутонът отваря отделния работещ демо търг със сървърен таймер."}</p>
     {notice&&<p className="eaLiveActionNotice" role="status">{notice}</p>}
    </aside>
    <section className="eaLiveHistory" aria-label="История на офертите">
     <header><h2>История на офертите {demoActive?"(демо)":""}</h2><span>{demoActive?"ПРИМЕР":"НЕАКТИВНА"}</span></header>
     {demoActive?<div className="eaLiveBidHistoryRows">{demoBidRows.map((b,i)=><div key={b.buyer}><span><Icon name="user" size={15}/>{b.buyer}</span><strong className={i===0?"top":""}>{euro(b.price)}</strong></div>)}</div>:
       <div className="eaLiveHistoryEmpty"><Icon name="shield" size={25}/><strong>Няма реални оферти</strong><p>Наддаването ще се активира след проверка на профилите и сървърната система.</p></div>}
     {demoActive&&<p className="eaLiveHistoryFootnote">Илюстративни стойности, не действителни купувачи и оферти.</p>}
    </section>
    <section className="eaLiveUpcoming" aria-label="Автомобили и следващи търгове">
     <div className="eaLiveQueueFilters">
      <label className="eaLiveSearch"><Icon name="car" size={18}/><input type="search" maxLength={120} value={auctionSearch} onChange={e=>setAuctionSearch(e.target.value)} placeholder="Търси марка, модел, лот №..." aria-label="Търси търг"/></label>
      <div className="eaLiveFilterRow">
       <select aria-label="Марка" value={auctionMake} onChange={e=>setAuctionMake(e.target.value)}><option value="">Всички марки</option>{auctionMakes.map(m=><option key={m} value={m}>{m}</option>)}</select>
       <select aria-label="Година" value={auctionYear} onChange={e=>setAuctionYear(e.target.value)}><option value="">Година</option>{auctionYears.map(y=><option key={y} value={y}>{y}</option>)}</select>
       <a href="/vehicles#ea-market-catalog"><Icon name="layers" size={16}/> Всички филтри</a>
      </div>
     </div>
     <header><h2><Icon name="calendar" size={19}/> Автомобили на търг</h2><a href="/vehicles">Виж всички <Icon name="arrow" size={16}/></a></header>
     {upcoming.length>0?<div className="eaLiveQueue">{matchingUpcoming.map(lot=><a key={lot.id} className="eaLiveQueueCard" href={"/vehicles/"+lot.id}>
      <div className="eaLiveQueueMedia"><GalleryPhoto src={safeImage(lot.image_url)} alt={lot.title}/><span>ОДОБРЕН</span></div>
      <div className="eaLiveQueueText"><strong>{lot.title}</strong><small>Лот № {lot.lot_number} · {lot.model_year??"—"} г.</small><small>Начало: {dateBG(lot.auction_starts_at)}</small><span className="eaLiveQueuePrice">Начална цена: <b>{euro(lot.starting_price,lot.price_currency)}</b></span></div>
     </a>)}</div>:<div className="eaLiveQueue">{matchingDemo.map(v=>{
      const index=nextDemo.findIndex(x=>x.lot===v.lot);
      return <button type="button" className="eaLiveQueueCard" key={v.lot} onClick={index<0?showBmw:()=>selectNext(index)}>
       <div className="eaLiveQueueMedia">{index<0?<GalleryPhoto src={IMG+"main.webp"} alt={v.title}/>:<div className="eaLiveQueueSprite" role="img" aria-label={v.title} style={{backgroundImage:'url("'+IMG+'upcoming.webp")',backgroundSize:"100% 400%",backgroundPosition:pos(index,4)}}/>}<span>ДЕМО</span></div>
       <div className="eaLiveQueueText"><strong>{v.title}</strong><small>Лот № {v.lot} · {v.year} г. · {v.fuel}</small><small>{index<0?"Примерен активен търг":"Демо начало: "+(demoOrigin?remaining(Math.max(0,demoQueueSeconds[index]*1000-(now-demoOrigin))):"--:--")}</small><span className="eaLiveQueuePrice">Примерна цена: <b>{euro(v.startingPrice)}</b></span></div>
      </button>;
     })}</div>}
     {(upcoming.length>0?matchingUpcoming.length===0:matchingDemo.length===0)&&<p className="eaLiveNoResults" role="status">Няма автомобили по избраните критерии.</p>}
     {upcoming.length===0&&<p className="eaLiveQueueDisclaimer"><Icon name="info" size={15}/>{catalogState==="checking"?"Проверяваме одобрените лотове.":catalogState==="unavailable"?"Каталогът още не е активен.":"Няма потвърдени предстоящи търгове."} Визуалните примери не са реални обяви.</p>}
    </section>
   </div>
  </div>
  <nav className="eaLiveMobileDock" aria-label="Мобилна навигация">
   <a className="selected" href="/auctions" aria-current="page"><Icon name="broadcast" size={21}/>Търгове</a>
   <a href="/vehicles"><Icon name="car" size={21}/>Автомобили</a>
   <a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={21}/>Запазени</a>
   <a href={authenticated?"/profile":"/login"}><Icon name="user" size={21}/>Профил</a>
  </nav>
 </main>;
}
