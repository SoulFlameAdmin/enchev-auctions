"use client";

import { useEffect, useMemo, useState } from "react";
import { accountNavigation, primaryNavigation } from "../site-navigation";\nimport { matchesCrossScriptSearch } from "../../packages/config/src/cross-script-search";
import "./inventory.css";
import "./inventory-v2.css";
import "./inventory-d13.css";
import "./inventory-d14.css";

const LOT_SECONDS = 10;
const PAGE_SIZE = 4;
const cars = [
  {lot:"EA-10482",vin:"WBS3R9C50JAK10482",title:"2018 BMW M4 F82",year:2018,model:"M4 F82",brand:"BMW",location:"Sofia, BG",region:"Европа",damage:"Minor dents",titleStatus:"Clean",mileage:"82 410 km",price:12750,buyNow:18900,badge:"RUN & DRIVE",image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10511",vin:"WDC0G4KB1MF10511",title:"2021 Mercedes-Benz GLC",year:2021,model:"GLC",brand:"Mercedes",location:"Munich, DE",region:"Европа",damage:"Front end",titleStatus:"Salvage",mileage:"64 900 km",price:18400,buyNow:24900,badge:"BUY NOW",image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10539",vin:"WUAZZZ8Y2NA10539",title:"2022 Audi RS3 Sportback",year:2022,model:"RS3 Sportback",brand:"Audi",location:"Crewe, UK",region:"Европа",damage:"Minor scratches",titleStatus:"Clean",mileage:"41 280 km",price:21900,buyNow:0,badge:"HOT LOT",image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10603",vin:"WVWZZZCD6TW10603",title:"2026 Volkswagen Golf GTI",year:2026,model:"Golf GTI",brand:"Volkswagen",location:"London, UK",region:"Европа",damage:"Clean title",titleStatus:"Clean",mileage:"9 870 km",price:16250,buyNow:20500,badge:"CLEAN TITLE",image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10627",vin:"5UXCR6C02L910627",title:"2020 BMW X5 xDrive40i",year:2020,model:"X5 xDrive40i",brand:"BMW",location:"Texas, USA",region:"САЩ",damage:"Rear end",titleStatus:"Salvage",mileage:"96 210 km",price:15100,buyNow:22400,badge:"RUN & DRIVE",image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10644",vin:"WDDWJ6EB5KF10644",title:"2019 Mercedes-AMG C43",year:2019,model:"AMG C43",brand:"Mercedes",location:"Florida, USA",region:"САЩ",damage:"Side",titleStatus:"Salvage",mileage:"72 030 km",price:13800,buyNow:19800,badge:"HOT LOT",image:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10671",vin:"WA1LXAF75MD10671",title:"2021 Audi Q7 55 TFSI",year:2021,model:"Q7 55 TFSI",brand:"Audi",location:"New Jersey, USA",region:"САЩ",damage:"Normal wear",titleStatus:"Clean",mileage:"58 440 km",price:19900,buyNow:26900,badge:"BUY NOW",image:"https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10702",vin:"WP1AB2A59PL10702",title:"2023 Porsche Macan S",year:2023,model:"Macan S",brand:"Porsche",location:"California, USA",region:"САЩ",damage:"Front end",titleStatus:"Salvage",mileage:"21 540 km",price:28750,buyNow:0,badge:"PREMIUM",image:"https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=82"},
];

const brands=["BMW","Mercedes","Audi","Volkswagen","Porsche"];
const regions=["САЩ","Европа"];
const auctionStatuses=["LIVE","UPCOMING","SOLD","OPEN"] as const;
const sortModes=["recommended","priceLow","priceHigh","yearNewest","yearOldest"] as const;
type AuctionStatus = "sold" | "live" | "next" | "open";
type ViewMode = "grid" | "list";
type FilterStatus = "Всички" | typeof auctionStatuses[number];
type SortMode = typeof sortModes[number];

export default function InventoryPage(){
  const [query,setQuery]=useState("");
  const [brand,setBrand]=useState("Всички");
  const [model,setModel]=useState("Всички");
  const [region,setRegion]=useState("Всички");
  const [location,setLocation]=useState("Всички");
  const [damage,setDamage]=useState("Всички");
  const [titleStatus,setTitleStatus]=useState("Всички");
  const [auctionStatus,setAuctionStatus]=useState<FilterStatus>("Всички");
  const [yearFrom,setYearFrom]=useState(2010);
  const [yearTo,setYearTo]=useState(2026);
  const [buyNow,setBuyNow]=useState(false);
  const [liveOnly,setLiveOnly]=useState(false);
  const [sort,setSort]=useState<SortMode>("recommended");
  const [currentPage,setCurrentPage]=useState(1);
  const [viewMode,setViewMode]=useState<ViewMode>("grid");
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
  const [urlReady,setUrlReady]=useState(false);
  const [activeIndex,setActiveIndex]=useState(1);
  const [remaining,setRemaining]=useState(LOT_SECONDS);
  const [bidPrices,setBidPrices]=useState<Record<string,number>>(()=>Object.fromEntries(cars.map(car=>[car.lot,car.price])));

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const q=params.get("q");
    const make=params.get("make");
    const nextModel=params.get("model");
    const nextRegion=params.get("region");
    const nextLocation=params.get("location");
    const nextDamage=params.get("damage");
    const nextTitle=params.get("title");
    const nextStatus=params.get("status") as FilterStatus|null;
    const nextSort=params.get("sort") as SortMode|null;
    const nextPage=Number(params.get("page"));
    const nextYearFrom=Number(params.get("yearFrom"));
    const nextYearTo=Number(params.get("yearTo"));
    if(q)setQuery(q);
    if(make&&brands.includes(make))setBrand(make);
    if(nextModel)setModel(nextModel);
    if(nextRegion&&regions.includes(nextRegion))setRegion(nextRegion);
    if(nextLocation)setLocation(nextLocation);
    if(nextDamage)setDamage(nextDamage);
    if(nextTitle&&["Clean","Salvage"].includes(nextTitle))setTitleStatus(nextTitle);
    if(nextStatus&&auctionStatuses.includes(nextStatus as typeof auctionStatuses[number]))setAuctionStatus(nextStatus);
    if(nextSort&&sortModes.includes(nextSort))setSort(nextSort);
    if(Number.isInteger(nextPage)&&nextPage>=1)setCurrentPage(nextPage);
    if(nextYearFrom>=2010&&nextYearFrom<=2026)setYearFrom(nextYearFrom);
    if(nextYearTo>=2010&&nextYearTo<=2026)setYearTo(nextYearTo);
    setBuyNow(params.get("buyNow")==="1");
    setLiveOnly(params.get("live")==="1");
    setUrlReady(true);
  },[]);

  useEffect(()=>{
    if(!urlReady)return;
    const params=new URLSearchParams();
    const q=query.trim();
    if(q)params.set("q",q);
    if(brand!=="Всички")params.set("make",brand);
    if(model!=="Всички")params.set("model",model);
    if(region!=="Всички")params.set("region",region);
    if(location!=="Всички")params.set("location",location);
    if(damage!=="Всички")params.set("damage",damage);
    if(titleStatus!=="Всички")params.set("title",titleStatus);
    if(auctionStatus!=="Всички")params.set("status",auctionStatus);
    if(yearFrom!==2010)params.set("yearFrom",String(yearFrom));
    if(yearTo!==2026)params.set("yearTo",String(yearTo));
    if(buyNow)params.set("buyNow","1");
    if(liveOnly)params.set("live","1");
    if(sort!=="recommended")params.set("sort",sort);
    if(currentPage>1)params.set("page",String(currentPage));
    const search=params.toString();
    const nextUrl=`${window.location.pathname}${search?`?${search}`:""}${window.location.hash}`;
    window.history.replaceState(window.history.state,"",nextUrl);
  },[urlReady,query,brand,model,region,location,damage,titleStatus,auctionStatus,yearFrom,yearTo,buyNow,liveOnly,sort,currentPage]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setRemaining(value=>{
        if(value>1)return value-1;
        setActiveIndex(index=>index>=cars.length-1?0:index+1);
        return LOT_SECONDS;
      });
    },1000);
    return()=>window.clearInterval(timer);
  },[]);

  const nextIndex=(activeIndex+1)%cars.length;
  const auctionCars=useMemo(()=>cars.map((car,index)=>{
    let status:AuctionStatus="open";
    if(index===activeIndex)status="live";
    else if(index===nextIndex)status="next";
    else if(activeIndex>0 && index<activeIndex)status="sold";
    const stateBadge=status==="sold"?"ПРОДАДЕНО":status==="live"?"ПРОДАВА СЕ НА ЖИВО":status==="next"?"СЛЕДВАЩ ЛОТ":car.badge;
    return {...car,index,status,stateBadge,price:bidPrices[car.lot]??car.price};
  }),[activeIndex,nextIndex,bidPrices]);

  const models=useMemo(()=>["Всички",...Array.from(new Set(cars.filter(car=>brand==="Всички"||car.brand===brand).map(car=>car.model)))],[brand]);
  const locations=useMemo(()=>["Всички",...Array.from(new Set(cars.filter(car=>region==="Всички"||car.region===region).map(car=>car.location)))],[region]);
  const damages=["Всички",...Array.from(new Set(cars.map(car=>car.damage)))];
  const titleStatuses=["Всички",...Array.from(new Set(cars.map(car=>car.titleStatus)))];

  useEffect(()=>{
    if(!models.includes(model))setModel("Всички");
  },[models,model]);

  useEffect(()=>{
    if(!locations.includes(location))setLocation("Всички");
  },[locations,location]);

  const placeBid=(lot:string)=>{
    setBidPrices(current=>({...current,[lot]:(current[lot]??cars.find(car=>car.lot===lot)?.price??0)+100}));
    setRemaining(LOT_SECONDS);
  };

  const resetFilters=()=>{
    setBrand("Всички");setModel("Всички");setRegion("Всички");setLocation("Всички");setDamage("Всички");setTitleStatus("Всички");setAuctionStatus("Всички");setYearFrom(2010);setYearTo(2026);setBuyNow(false);setLiveOnly(false);setQuery("");setCurrentPage(1);
  };

  const filtered=useMemo(()=>{
    let list=auctionCars.filter(car=>{
      const matchesQuery=matchesCrossScriptSearch(query,{
        text:[car.title,car.brand,car.model,car.location,car.damage,car.titleStatus],
        identifiers:[car.vin,car.lot]
      });
      const matchesBrand=brand==="Всички"||car.brand===brand;
      const matchesModel=model==="Всички"||car.model===model;
      const matchesRegion=region==="Всички"||car.region===region;
      const matchesLocation=location==="Всички"||car.location===location;
      const matchesDamage=damage==="Всички"||car.damage===damage;
      const matchesTitle=titleStatus==="Всички"||car.titleStatus===titleStatus;
      const matchesYear=car.year>=Math.min(yearFrom,yearTo)&&car.year<=Math.max(yearFrom,yearTo);
      const matchesBuy=!buyNow||car.buyNow>0;
      const normalizedStatus=car.status==="next"?"UPCOMING":car.status.toUpperCase();
      const matchesStatus=auctionStatus==="Всички"||normalizedStatus===auctionStatus;
      const matchesLive=!liveOnly||car.status==="live";
      return matchesQuery&&matchesBrand&&matchesModel&&matchesRegion&&matchesLocation&&matchesDamage&&matchesTitle&&matchesYear&&matchesBuy&&matchesStatus&&matchesLive;
    });
    if(sort==="priceLow")list=[...list].sort((a,b)=>a.price-b.price);
    if(sort==="priceHigh")list=[...list].sort((a,b)=>b.price-a.price);
    if(sort==="yearNewest")list=[...list].sort((a,b)=>b.year-a.year||a.lot.localeCompare(b.lot));
    if(sort==="yearOldest")list=[...list].sort((a,b)=>a.year-b.year||a.lot.localeCompare(b.lot));
    return list;
  },[auctionCars,query,brand,model,region,location,damage,titleStatus,auctionStatus,yearFrom,yearTo,buyNow,liveOnly,sort]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  useEffect(()=>{
    if(currentPage>totalPages)setCurrentPage(totalPages);
  },[currentPage,totalPages]);
  const pageStartIndex=(currentPage-1)*PAGE_SIZE;
  const paged=filtered.slice(pageStartIndex,pageStartIndex+PAGE_SIZE);
  const rangeStart=filtered.length===0?0:pageStartIndex+1;
  const rangeEnd=Math.min(pageStartIndex+PAGE_SIZE,filtered.length);
  const pageNumbers=Array.from({length:totalPages},(_,index)=>index+1);

  const activeFilters:{key:string;label:string;clear:()=>void}[]=[];
  if(query.trim())activeFilters.push({key:"q",label:`Търсене: ${query.trim()}`,clear:()=>{setQuery("");setCurrentPage(1);}});
  if(brand!=="Всички")activeFilters.push({key:"make",label:`Марка: ${brand}`,clear:()=>{setBrand("Всички");setModel("Всички");setCurrentPage(1);}});
  if(model!=="Всички")activeFilters.push({key:"model",label:`Модел: ${model}`,clear:()=>{setModel("Всички");setCurrentPage(1);}});
  if(region!=="Всички")activeFilters.push({key:"region",label:`Регион: ${region}`,clear:()=>{setRegion("Всички");setLocation("Всички");setCurrentPage(1);}});
  if(location!=="Всички")activeFilters.push({key:"location",label:`Локация: ${location}`,clear:()=>{setLocation("Всички");setCurrentPage(1);}});
  if(damage!=="Всички")activeFilters.push({key:"damage",label:`Повреда: ${damage}`,clear:()=>{setDamage("Всички");setCurrentPage(1);}});
  if(titleStatus!=="Всички")activeFilters.push({key:"title",label:`Талон: ${titleStatus==="Clean"?"Clean title":"Salvage title"}`,clear:()=>{setTitleStatus("Всички");setCurrentPage(1);}});
  if(auctionStatus!=="Всички")activeFilters.push({key:"status",label:`Статус: ${auctionStatus}`,clear:()=>{setAuctionStatus("Всички");setCurrentPage(1);}});
  if(yearFrom!==2010||yearTo!==2026)activeFilters.push({key:"year",label:`Година: ${Math.min(yearFrom,yearTo)}–${Math.max(yearFrom,yearTo)}`,clear:()=>{setYearFrom(2010);setYearTo(2026);setCurrentPage(1);}});
  if(buyNow)activeFilters.push({key:"buyNow",label:"Buy Now",clear:()=>{setBuyNow(false);setCurrentPage(1);}});
  if(liveOnly)activeFilters.push({key:"live",label:"Само LIVE",clear:()=>{setLiveOnly(false);setCurrentPage(1);}});

  const formatTime=(seconds:number)=>`00:${String(seconds).padStart(2,"0")}`;
  const liveCar=auctionCars.find(car=>car.status==="live");

  return <main id="main-content" className="inventoryPage" data-design-task="D11" data-design-filter-task="D12" data-design-url-task="D13" data-design-pagination-task="D14" data-result-count={filtered.length} data-current-page={currentPage}>
    <div className="inv2TopUtility"><div className="inv2UtilityLive"><i/> ENCHEV LIVE NETWORK <span>·</span> Обновяване в реално време</div><div className="inv2UtilityRight"><span>BG · EUR</span><a href="/support">Помощ</a><a href="/transport">Транспорт</a></div></div>

    <header className="inventoryHeader">
      <a href="/" className="inventoryLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="inventorySearch"><span>⌕</span><input value={query} onChange={e=>{setQuery(e.target.value);setCurrentPage(1);}} placeholder="Търси марка, модел, VIN, LOT, повреда или локация..." aria-label="Търсене по марка, модел, VIN или LOT"/><button>Търси</button></div>
      <div className="inventoryAccount"><a href={accountNavigation.profile}>Вход / Профил</a><a className="registerBtn" href={accountNavigation.register}>Регистрация</a></div>
    </header>

    <nav className="inventoryNav" aria-label="Основна навигация"><a href="/">Начало</a>{primaryNavigation.map(item=><a key={item.key} className={`${item.key==="inventory"?"active":""} ${item.key==="live"?"navLive":""}`.trim()} href={item.href}>{item.label}</a>)}</nav>

    <section className="inv2Hero">
      <div className="inventoryIntro"><div><span>ENCHEV MARKETPLACE</span><h1>Автомобили от международни търгове</h1><p>Филтрирай, следи и наддавай. LIVE лотът има 10-секунден брояч; всяка нова оферта връща времето на 10 секунди.</p></div></div>
      <div className="inv2HeroStats"><div className="inv2HeroStat"><b>{cars.length}</b><span>активни лота</span></div><div className="inv2HeroStat"><b>{cars.filter(c=>c.buyNow>0).length}</b><span>buy now</span></div><div className="inv2HeroStat"><b>{formatTime(remaining)}</b><span>live таймер</span></div></div>
    </section>

    <div className="inv2Quickbar"><div className="inv2Chips"><button className={`inv2Chip ${activeFilters.length===0?"active":""}`} onClick={resetFilters}>Всички</button><button className={`inv2Chip ${liveOnly?"active":""}`} onClick={()=>{setLiveOnly(v=>!v);setCurrentPage(1);}}>● LIVE</button><button className={`inv2Chip ${buyNow?"active":""}`} onClick={()=>{setBuyNow(v=>!v);setCurrentPage(1);}}>Buy Now</button><button className={`inv2Chip ${brand==="BMW"?"active":""}`} onClick={()=>{setBrand(brand==="BMW"?"Всички":"BMW");setCurrentPage(1);}}>BMW</button><button className={`inv2Chip ${brand==="Mercedes"?"active":""}`} onClick={()=>{setBrand(brand==="Mercedes"?"Всички":"Mercedes");setCurrentPage(1);}}>Mercedes</button><button className={`inv2Chip ${region==="САЩ"?"active":""}`} onClick={()=>{setRegion(region==="САЩ"?"Всички":"САЩ");setCurrentPage(1);}}>САЩ</button><button className={`inv2Chip ${region==="Европа"?"active":""}`} onClick={()=>{setRegion(region==="Европа"?"Всички":"Европа");setCurrentPage(1);}}>Европа</button></div><button className="inv2SaveSearch">♡ Запази търсенето</button></div>

    {activeFilters.length>0&&<div className="inv2ActiveFilters" aria-label="Активни филтри" data-active-filter-count={activeFilters.length}>
      <span className="inv2ActiveFiltersLabel">Активни филтри</span>
      <div className="inv2ActiveFilterList">{activeFilters.map(filter=><button type="button" className="inv2ActiveFilterChip" key={filter.key} onClick={filter.clear} aria-label={`Премахни филтър ${filter.label}`}><span>{filter.label}</span><b aria-hidden="true">×</b></button>)}</div>
      <button type="button" className="inv2ClearAll" onClick={resetFilters}>Изчисти всички</button>
    </div>}

    <button className="inv2MobileFiltersToggle" type="button" aria-controls="inventory-filter-panel" aria-expanded={mobileFiltersOpen} onClick={()=>setMobileFiltersOpen(open=>!open)}>
      <span>⚙ Филтри</span><strong>{mobileFiltersOpen?"Затвори":"Отвори"}</strong>
    </button>

    <div className="inventoryShell">
      <aside id="inventory-filter-panel" className={`inventoryFilters ${mobileFiltersOpen?"isMobileOpen":""}`} aria-label="Филтри за инвентара">
        <div className="filterTitle"><b>Филтри за търсене</b><button onClick={resetFilters}>Изчисти{activeFilters.length>0?` (${activeFilters.length})`:""}</button></div>
        <label className="filterSearchLabel">Търси в резултатите<input value={query} onChange={e=>{setQuery(e.target.value);setCurrentPage(1);}} placeholder="BMW, EA-10482, WBS3R9..."/></label>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Бързи филтри</b><small>LIVE / BUY NOW</small></div><label><input type="checkbox" checked={liveOnly} onChange={e=>{setLiveOnly(e.target.checked);setCurrentPage(1);}}/> Само LIVE</label><label><input type="checkbox" checked={buyNow} onChange={e=>{setBuyNow(e.target.checked);setCurrentPage(1);}}/> Buy Now</label></div>
        <div className="filterBlock filterBlock--select"><b>Марка</b><select className="inv2Select" value={brand} onChange={e=>{setBrand(e.target.value);setCurrentPage(1);}} aria-label="Филтър по марка">{["Всички",...brands].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Модел</b><select className="inv2Select" value={model} onChange={e=>{setModel(e.target.value);setCurrentPage(1);}} aria-label="Филтър по модел">{models.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Година</b><small>{Math.min(yearFrom,yearTo)}–{Math.max(yearFrom,yearTo)}</small></div><div className="inv2Range"><input type="number" min="2010" max="2026" value={yearFrom} onChange={e=>{setYearFrom(Number(e.target.value)||2010);setCurrentPage(1);}} aria-label="Година от"/><input type="number" min="2010" max="2026" value={yearTo} onChange={e=>{setYearTo(Number(e.target.value)||2026);setCurrentPage(1);}} aria-label="Година до"/></div></div>
        <div className="filterBlock filterBlock--select"><b>Регион</b><select className="inv2Select" value={region} onChange={e=>{setRegion(e.target.value);setCurrentPage(1);}} aria-label="Филтър по регион">{["Всички",...regions].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Локация</b><select className="inv2Select" value={location} onChange={e=>{setLocation(e.target.value);setCurrentPage(1);}} aria-label="Филтър по локация">{locations.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Основна повреда</b><select className="inv2Select" value={damage} onChange={e=>{setDamage(e.target.value);setCurrentPage(1);}} aria-label="Филтър по повреда">{damages.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Статус на талона</b><select className="inv2Select" value={titleStatus} onChange={e=>{setTitleStatus(e.target.value);setCurrentPage(1);}} aria-label="Филтър по статус на талона">{titleStatuses.map(x=><option key={x} value={x}>{x==="Всички"?x:x==="Clean"?"Clean title":"Salvage title"}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Статус на търга</b><select className="inv2Select" value={auctionStatus} onChange={e=>{setAuctionStatus(e.target.value as FilterStatus);setCurrentPage(1);}} aria-label="Филтър по статус на търга">{["Всички",...auctionStatuses].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Цена</b><small>EUR</small></div><div className="inv2Range"><input placeholder="От"/><input placeholder="До"/></div></div>
        <div className="filterBlock collapsed"><b>Тип превозно средство</b><span>+</span></div><div className="filterBlock collapsed"><b>Двигател</b><span>+</span></div><div className="filterBlock collapsed"><b>Скоростна кутия</b><span>+</span></div><div className="filterBlock collapsed"><b>Пробег</b><span>+</span></div><div className="filterBlock collapsed"><b>Дата на търга</b><span>+</span></div>
      </aside>

      <section className="inventoryResults" aria-label="Резултати от инвентара">
        <div className="inventoryToolbar">
          <div className="inv2ResultMeta" aria-live="polite"><b>{filtered.length} резултата</b><span className="inv2ResultRange">{filtered.length>0?`Показани ${rangeStart}–${rangeEnd} от ${filtered.length}`:"Няма резултати за показване"}</span><span className="inv2ResultLive">{liveCar?`LIVE: ${liveCar.title} · ${formatTime(remaining)}`:"Няма активен LIVE лот"}</span></div>
          <div className="inventoryToolbarControls">
            <div className="inv2ViewSwitch" role="group" aria-label="Изглед на резултатите">
              <button type="button" className={viewMode==="grid"?"active":""} onClick={()=>setViewMode("grid")} aria-pressed={viewMode==="grid"} aria-label="Покажи като мрежа">▦</button>
              <button type="button" className={viewMode==="list"?"active":""} onClick={()=>setViewMode("list")} aria-pressed={viewMode==="list"} aria-label="Покажи като списък">☰</button>
            </div>
            <select className="inv2SortSelect" value={sort} onChange={e=>{setSort(e.target.value as SortMode);setCurrentPage(1);}} aria-label="Сортиране на резултатите"><option value="recommended">Препоръчани</option><option value="priceLow">Цена: ниска → висока</option><option value="priceHigh">Цена: висока → ниска</option><option value="yearNewest">Година: нови → стари</option><option value="yearOldest">Година: стари → нови</option></select>
          </div>
        </div>

        <div className={`inventoryGrid ${viewMode==="list"?"inventoryGrid--list":""}`} data-view={viewMode}>{paged.map(car=><article className={`inventoryCard ${car.status==="sold"?"soldCard":""} ${car.status==="live"?"liveCard":""} ${car.status==="next"?"nextCard":""}`} key={car.lot}>
          <div className="inventoryImage">
            <img src={car.image} alt={car.title}/>
            <span className={`inventoryBadge ${car.status}`}>{car.stateBadge}</span>
            {car.status!=="sold"&&<span className="inventoryTimer">◷ {car.status==="live"?formatTime(remaining):car.status==="next"?"СЛЕДВАЩ":"ОЧАКВА"}</span>}
            <button className="inventoryHeart">♡</button>
            {car.status==="sold"&&<div className="soldStamp">SOLD</div>}
            {car.status==="live"&&<div className="liveBidOrb"><span className="liveBidText">NEW BID</span><span className="liveSaleText">ПРОДАВА СЕ<br/>НА ЖИВО</span><i>◉</i><strong className="liveCountdown">{remaining}</strong><small>СЕК</small></div>}
          </div>
          <div className="inventoryCardBody">
            <div className="inventoryLot">LOT {car.lot}<span>● VERIFIED</span></div><h2>{car.title}</h2>
            <dl><div><dt>Пробег</dt><dd>{car.mileage}</dd></div><div><dt>Повреда</dt><dd>{car.damage}</dd></div><div><dt>Локация</dt><dd>{car.location}</dd></div></dl>
            <button className="detailsBtn">Повече детайли <span>⌄</span></button>
            {car.status==="sold"?<><div className="saleEnded">Продажбата приключи</div><div className="inventoryActions soldActions"><button className="soldDetailsBtn">Виж детайлите</button></div></>:<><div className="inventoryPrice"><span>{car.status==="next"?"Начална ставка":"Текуща ставка"}</span><b>€{car.price.toLocaleString("bg-BG")}</b></div><div className="inventoryActions">{car.buyNow>0&&car.status!=="next"&&<button className="buyBtn">Купи €{car.buyNow.toLocaleString("bg-BG")}</button>}<button className={`bidBtn ${car.status==="next"?"nextBidBtn":""}`} disabled={car.status==="next"} onClick={()=>car.status==="live"&&placeBid(car.lot)}>{car.status==="live"?"Оферирай +€100":car.status==="next"?"Следващ лот":"Оферирай"} <span>→</span></button></div></>}
          </div>
        </article>)}</div>

        {filtered.length===0&&<div className="emptyInventory"><b>Няма намерени автомобили</b><span>Промени филтрите или търсенето.</span></div>}
        {filtered.length>0&&<nav className="inv2Pagination" aria-label="Страници с резултати"><button type="button" onClick={()=>setCurrentPage(page=>Math.max(1,page-1))} disabled={currentPage===1} aria-label="Предишна страница">‹</button>{pageNumbers.map(page=><button type="button" key={page} onClick={()=>setCurrentPage(page)} aria-current={currentPage===page?"page":undefined} aria-label={`Страница ${page}`}>{page}</button>)}<button type="button" onClick={()=>setCurrentPage(page=>Math.min(totalPages,page+1))} disabled={currentPage===totalPages} aria-label="Следваща страница">›</button><span className="inv2PaginationStatus">Страница {currentPage} / {totalPages}</span></nav>}
      </section>
    </div>
  </main>
}
