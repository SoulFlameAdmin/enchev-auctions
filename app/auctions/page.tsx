"use client";

import {useEffect,useMemo,useState} from "react";
import EaOfficialLogo from "../components/EaOfficialLogo";
import "./auctions.css";

type DemoLot=Readonly<{lot:string;title:string;year:string;fuel:string;mileage:string;transmission:string;location:string;startingPrice:number;image:string}>;
type VerifiedLot={id:string;lot_number:string;title:string;make:string;model:string;model_year:number|null;fuel_type:string|null;mileage_km:number|null;transmission:string|null;image_url:string|null;starting_price:number|null;price_currency:string;status:string;auction_starts_at:string|null;auction_ends_at:string|null};
type LiveDemoClock={serverNow:number;roundEndsAt:number;lotIndex:number;auctionAuthority:boolean;scope:string;receivedAt:number};
type Network="loading"|"connected"|"offline";
const demoLots:readonly DemoLot[]=[
 {lot:"EA-10511",title:"Mercedes-Benz GLC (демо)",year:"2021",fuel:"Бензин",mileage:"64 900 км",transmission:"Автоматик",location:"Мюнхен, Германия",startingPrice:18400,image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82"},
 {lot:"EA-10539",title:"Audi RS3 Sportback (демо)",year:"2022",fuel:"Бензин",mileage:"41 280 км",transmission:"Автоматик",location:"Великобритания",startingPrice:21900,image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82"},
 {lot:"EA-10603",title:"Volkswagen Golf GTI (демо)",year:"2026",fuel:"Бензин",mileage:"9 870 км",transmission:"Автоматик",location:"Лондон, Великобритания",startingPrice:16250,image:"https://images.unsplash.com/photo-1655285886265-835ce7541e10?auto=format&fit=crop&w=1200&q=82"},
 {lot:"EA-10627",title:"BMW X5 xDrive40i (демо)",year:"2020",fuel:"Бензин",mileage:"96 210 км",transmission:"Автоматик",location:"САЩ",startingPrice:15100,image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1500&q=84"},
];
function Icon({name,size=20}:{name:"home"|"car"|"broadcast"|"layers"|"bookmark"|"user"|"chevron-left"|"chevron-right"|"clock"|"gavel"|"calendar"|"history"|"shield"|"users"|"camera"|"arrow"|"info"|"heart";size?:number}){
 const paths:Record<string,string>={
 home:"M3 10 12 3l9 7v11h-6v-7H9v7H3z",
 car:"M4 16h16l-2-7H6zM7 9l1-4h8l1 4M5 16v3m14-3v3",
 broadcast:"M12 12h.01M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14",
 layers:"m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
 bookmark:"M5 3h14v18l-7-4-7 4z",
 user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2",
 "chevron-left":"m15 18-6-6 6-6","chevron-right":"m9 18 6-6-6-6",
 clock:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
 gavel:"m14 3 7 7M12 5l7 7M7 10l7 7M3 14l7 7M9 9l6-6 6 6-6 6zM2 22h15",
 calendar:"M3 5h18v16H3zM7 2v6m10-6v6M3 10h18",
 history:"M3 5v6h6M3 11a9 9 0 1 1 3 7M12 7v5l4 2",
 shield:"m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6zM8 12l3 3 5-6",
 users:"M15 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM23 19v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
 camera:"M3 7h4l2-3h6l2 3h4v13H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 arrow:"M5 12h14m-6-6 6 6-6 6",
 info:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v5m0-9h.01",
 heart:"M20.5 9c0 4-8.5 11-8.5 11S3.5 13 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2z"
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
const euro=(v:number|null,c="EUR")=>v===null?"При запитване":new Intl.NumberFormat("bg-BG",{style:"currency",currency:/^(EUR|BGN|USD)$/i.test(c)?c:"EUR",maximumFractionDigits:0}).format(v);
function safeImage(url:string|null|undefined){
 if(!url||typeof url!=="string")return null;
 return url.startsWith("https://ejfrnjhlggebzmpmxajl.supabase.co/storage/v1/object/public/enchev-lot-public/")?url:null;
}
function asRemaining(ms:number){if(!Number.isFinite(ms)||ms<=0)return "00:00";const t=Math.ceil(ms/1000);return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}
function readDate(iso:string|null){if(!iso)return "Предстои";const d=new Date(iso);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat("bg-BG",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Sofia"}).format(d):"Предстои";}
function LotImage({src,alt}:{src:string|null;alt:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return src&&!failed?<img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>:<div className="eaLiveMissing"><Icon name="car" size={44}/><span>Снимка предстои</span></div>;
}
export default function AuctionsPage(){
 const [featured,setFeatured]=useState(3);
 const [lots,setLots]=useState<VerifiedLot[]>([]);
 const [catalogState,setCatalogState]=useState<"checking"|"ready"|"unavailable">("checking");
 const [net,setNet]=useState<Network>("loading");
 const [demoClock,setDemoClock]=useState<LiveDemoClock|null>(null);
 const [now,setNow]=useState(0);
 const [authenticated,setAuthenticated]=useState(false);
 const [panel,setPanel]=useState<"upcoming"|"history">("upcoming");
 useEffect(()=>{
  const controller=new AbortController();
  async function loadCatalog(){
   try{
    const r=await fetch("/api/buyer/catalog",{signal:controller.signal,cache:"no-store"});
    const j=await r.json();
    if(controller.signal.aborted)return;
    if(r.ok&&j?.ok&&Array.isArray(j.lots)){setLots(j.lots.filter((x:VerifiedLot)=>x&&["scheduled","live"].includes(x.status)));setCatalogState("ready");}
    else setCatalogState("unavailable");
   }catch{if(!controller.signal.aborted)setCatalogState("unavailable")}
  }
  async function session(){
   try{const r=await fetch("/api/enchev-auth/session",{signal:controller.signal,cache:"no-store"});const j=await r.json();if(!controller.signal.aborted){setAuthenticated(j?.authenticated===true)}}catch{}
  }
  void loadCatalog();void session();
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  let busy=false;
  async function sync(){
   if(busy||controller.signal.aborted)return;busy=true;
   try{
    const response=await fetch("/api/live-auction-clock",{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("clock-http");
    const d=await response.json() as LiveDemoClock;
    if(d.auctionAuthority!==false||d.scope!=="server-issued-browser-session-demo"||!Number.isFinite(d.serverNow)||!Number.isFinite(d.roundEndsAt)||!Number.isInteger(d.lotIndex)||d.lotIndex<0||d.lotIndex>=demoLots.length)throw new Error("invalid-clock");
    if(!controller.signal.aborted){setDemoClock({...d,receivedAt:Date.now()});setNet("connected");}
   }catch{if(!controller.signal.aborted)setNet("offline")}
   finally{busy=false}
  }
  void sync();
  const i=window.setInterval(()=>void sync(),3000);
  const t=window.setInterval(()=>setNow(Date.now()),400);
  return()=>{controller.abort();window.clearInterval(i);window.clearInterval(t)};
 },[]);
 const realLive=useMemo(()=>lots.filter(x=>x.status==="live"),[lots]);
 const realUpcoming=useMemo(()=>lots.filter(x=>x.status==="scheduled"),[lots]);
 const real=realLive[0]??null;
 const preview=demoLots[featured];
 const demoRemaining=demoClock&&net==="connected"?asRemaining(demoClock.roundEndsAt-(now+(demoClock.serverNow-demoClock.receivedAt))):"--:--";
 const realSelected=Boolean(real);
 const primaryTitle=real?real.title:preview.title;
 const primaryPrice=real?euro(real.starting_price,real.price_currency):euro(preview.startingPrice);
 const primaryImage=real?safeImage(real.image_url):preview.image;
 const upcoming=realUpcoming;
 function pick(index:number){setFeatured((index+demoLots.length)%demoLots.length)}
 async function saveReal(){
  if(!real)return;
  if(!authenticated){window.location.assign("/register?next="+encodeURIComponent("/vehicles/"+real.id));return}
  const r=await fetch("/api/buyer/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({lot_id:real.id})});
  if(!r.ok)window.alert("Неуспешно запазване. Провери профила си.");
  else window.alert("Автомобилът е запазен в профила.");
 }
 return <main id="main-content" className="eaLiveMarket">
  <div className="eaLiveWrap">
   <header className="eaLiveHeader">
    <a href="/" className="eaLiveBrand" aria-label="Начало E&A"><EaOfficialLogo/></a>
    <nav className="eaLiveDesktopNav" aria-label="Главна навигация">
     <a href="/"><Icon name="home" size={17}/> Начало</a>
     <a href="/vehicles"><Icon name="car" size={17}/> Автомобили</a>
     <a className="eaLiveNavActive" aria-current="page" href="/auctions"><Icon name="broadcast" size={17}/> Търгове на живо</a>
     <a href="/vehicles#ea-market-catalog"><Icon name="layers" size={17}/> Каталог</a>
     <a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={16}/> Запазени</a>
    </nav>
    <a href={authenticated?"/profile":"/login"} className="eaLiveProfile" aria-label={authenticated?"Моят профил":"Вход в профила"}><Icon name="user"/></a>
   </header>
   <nav className="eaLiveQuickNav" aria-label="Раздели">
    <a href="/vehicles"><Icon name="car" size={17}/> Автомобили</a>
    <a className="is-current" aria-current="page" href="/auctions"><Icon name="broadcast" size={17}/> LIVE</a>
    <a href="/vehicles#ea-market-catalog"><Icon name="layers" size={17}/> Каталог</a>
    <a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={17}/> Запазени</a>
   </nav>
   <div className="eaLiveTitleRow">
    <div><span className="eaLiveEyebrow">E&A · ОНЛАЙН АВТОМОБИЛНИ ТЪРГОВЕ</span><h1><Icon name="broadcast" size={36}/> ТЪРГОВЕ НА <em>ЖИВО</em></h1><p>Следи автомобилите и разгледай работещата демонстрация на наддаване.</p></div>
    <div className="eaLiveAssurances"><span><Icon name="shield"/> Проверени обяви</span><span><Icon name="gavel"/> Ясни правила</span></div>
   </div>
   <div className="eaLiveModeNotice" role="status"><Icon name="info" size={18}/><span><strong>{realSelected?"ПУБЛИКУВАН ЛОТ":"ДЕМОНСТРАЦИОННА ВИЗИЯ"}</strong> {realSelected?"Реалните оферти още не са активирани.":"Показаните автомобили, начални цени и таймер не са истински търгове или сделки."}</span><a href="/live-auctions">Работещо демо <Icon name="arrow" size={15}/></a></div>
   <div className="eaLiveMain">
    <section className="eaLiveCarStage" aria-label="Автомобил и галерия">
     <div className="eaLiveImageFrame">
      <LotImage src={primaryImage} alt={primaryTitle+" — "+(realSelected?"обява":"демонстрационно изображение")}/>
      <span className="eaLivePhotoTag"><Icon name="broadcast" size={15}/> {realSelected?"ОДОБРЕН ЛОТ":"ДЕМО ПРЕГЛЕД"}</span>
      <span className="eaLiveLotId">Лот № {real?.lot_number??preview.lot}</span>
      {!real&&<><button type="button" className="eaLiveSlidePrev" onClick={()=>pick(featured-1)} aria-label="Предишен демонстрационен автомобил"><Icon name="chevron-left" size={25}/></button><button type="button" className="eaLiveSlideNext" onClick={()=>pick(featured+1)} aria-label="Следващ демонстрационен автомобил"><Icon name="chevron-right" size={25}/></button><div className="eaLiveDots" aria-label="Галерия">{demoLots.map((x,i)=><button type="button" key={x.lot} aria-label={"Покажи "+x.title} aria-pressed={i===featured} className={i===featured?"active":""} onClick={()=>pick(i)}/>)}</div></>}
      {real&&<span className="eaLiveRealNote">Снимка на публикуван лот · офертите не са активни</span>}
     </div>
     <div className="eaLiveGallery">
      {!real&&demoLots.map((x,i)=><button type="button" key={x.lot} aria-label={"Разгледай "+x.title} className={i===featured?"active":""} onClick={()=>pick(i)}><LotImage src={x.image} alt={x.title}/><span>{i===featured?"Избран":"Пример"}</span></button>)}
      {real&&<div className="eaLiveGalleryNote"><Icon name="camera"/> Допълнителни снимки ще се показват след качване от продавача.</div>}
     </div>
     <div className="eaLiveCarSummary">
      <h2>{primaryTitle}</h2>
      <div className="eaLiveSpecs">
       <span><Icon name="calendar" size={16}/>{real?(real.model_year??"—"):preview.year} г.</span>
       <span><Icon name="car" size={16}/>{real?(real.fuel_type??"Не е посочено"):preview.fuel}</span>
       <span><Icon name="clock" size={16}/>{real?(typeof real.mileage_km==="number"?real.mileage_km.toLocaleString("bg-BG")+" км":"Не е посочен"):preview.mileage}</span>
       <span><Icon name="layers" size={16}/>{real?(real.transmission??"Не е посочено"):preview.transmission}</span>
      </div>
     </div>
    </section>
    <aside className="eaLiveBidPanel" aria-label="Информация за търга">
     <div className="eaLiveBidFlag"><span className={realSelected?"pending":"demo"}><i/>{realSelected?"ПРОВЕРЕН ЛОТ":"ДЕМО РЕЖИМ"}</span><small>{real?"Публикувано":"Не са реални оферти"}</small></div>
     <div className="eaLiveBidNumbers">
      <div><span>{real?"Начална цена":"Примерна начална цена"}</span><strong>{primaryPrice}</strong></div>
      <div><span>{real?"График на лота":"Сървърен демо таймер"}</span><strong className="eaLiveCountdown"><Icon name="clock" size={18}/>{real?readDate(real.auction_ends_at):demoRemaining}</strong></div>
     </div>
     <div className="eaLiveBidDetail"><strong>{primaryTitle}</strong><small>Лот {real?.lot_number??preview.lot} · {real?"Реална одобрена обява":"Илюстративен модел"}</small></div>
     <a className="eaLiveBidAction" href={real?"/vehicles/"+real.id:"/live-auctions"}><Icon name="gavel" size={23}/>{real?"Виж лота и условията":"Наддай сега · ДЕМО"}</a>
     {real?<button type="button" className="eaLiveSaveAction" onClick={()=>void saveReal()}><Icon name="bookmark" size={18}/> Запази автомобила</button>:<a className="eaLiveSaveAction" href={authenticated?"/profile":"/register"}><Icon name="bookmark" size={18}/> {authenticated?"Моят профил":"Регистрация за участие"}</a>}
     <p className="eaLiveBidDisclosure">Тази страница не приема реални парични залози. Работещото демо използва отделен сървърен часовник.</p>
    </aside>
    <section className="eaLiveHistory" aria-label="История на офертите">
     <header><h2><Icon name="history" size={20}/> История на наддаването</h2><span>{realSelected?"НЕАКТИВНА":"ДЕМО"}</span></header>
     <div className="eaLiveHistoryEmpty"><Icon name="shield" size={27}/><strong>Без потвърдени реални оферти</strong><p>Не показваме измислени купувачи, цени или продажби като реални. Наддаванията в демото са отделни.</p><a href={real?"/vehicles/"+real.id:"/live-auctions"}>{real?"Информация за лота":"Виж демо наддаването"} <Icon name="arrow" size={15}/></a></div>
    </section>
    <section className="eaLiveUpcoming" aria-label="Следващи лотове">
     <header><div><span>КАТАЛОГ НА ТЪРГОВЕ</span><h2><Icon name="calendar" size={22}/> Следващи лотове</h2></div><a href="/vehicles">Виж автомобилите <Icon name="arrow" size={16}/></a></header>
     {upcoming.length>0?<div className="eaLiveQueue">{upcoming.slice(0,4).map((lot)=><a key={lot.id} className="eaLiveQueueCard" href={"/vehicles/"+lot.id}><div className="eaLiveQueueMedia"><LotImage src={safeImage(lot.image_url)} alt={lot.title}/><span>ОДОБРЕНО</span></div><div className="eaLiveQueueText"><strong>{lot.title}</strong><small>Лот {lot.lot_number} · {readDate(lot.auction_starts_at)}</small><b>{euro(lot.starting_price,lot.price_currency)}</b></div></a>)}</div>:
     <><div className="eaLiveQueueDisclaimer"><Icon name="info" size={15}/> {catalogState==="checking"?"Проверяваме следващите одобрени лотове.":catalogState==="unavailable"?"Каталогът очаква активиране. Показани са примери от демо стаята.":"Засега няма одобрени предстоящи лотове. Показани са демонстрационни автомобили."}</div><div className="eaLiveQueue">{demoLots.map((x,i)=><button type="button" className="eaLiveQueueCard" key={x.lot} onClick={()=>{pick(i);document.querySelector(".eaLiveCarStage")?.scrollIntoView({behavior:"smooth",block:"start"})}}><div className="eaLiveQueueMedia"><LotImage src={x.image} alt={"Пример: "+x.title}/><span>ДЕМО</span></div><div className="eaLiveQueueText"><strong>{x.title}</strong><small>{x.year} г. · {x.mileage}</small><b>{euro(x.startingPrice)}</b></div></button>)}</div></>}
    </section>
   </div>
   <section className="eaLiveFooterExplain"><Icon name="info" size={19}/><div><strong>Готова визия за реални търгове</strong><p>След включване на верифицираните лотове, авторитетния сървърен таймер, профилите и системата за приемане на оферти този екран ще показва истинска история и цени. Нищо няма да се активира като реално наддаване само от дизайна.</p></div><a href="/live-auctions">Отвори демото ↗</a></section>
  </div>
  <nav className="eaLiveMobileDock" aria-label="Мобилна навигация"><a className="selected" aria-current="page" href="/auctions"><Icon name="broadcast" size={21}/>Търгове</a><a href="/vehicles"><Icon name="car" size={21}/>Автомобили</a><a href={authenticated?"/profile":"/login"}><Icon name="bookmark" size={21}/>Запазени</a><a href={authenticated?"/profile":"/login"}><Icon name="user" size={21}/>Профил</a></nav>
 </main>;
}
