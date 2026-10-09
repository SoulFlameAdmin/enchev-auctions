"use client";

import { GOLF_GTI_DEMO_IMAGE, GOLF_GTI_DEMO_PHOTO_CREDIT } from "../data/demo-vehicle-media";
import { useEffect, useMemo, useState } from "react";
import { accountNavigation, primaryNavigation } from "../site-navigation";
import { getDemoWatchlist, setDemoWatchlist, type DemoSavedVehicle } from "../components/demo-watchlist";
import { matchesCrossScriptSearch } from "../../packages/config/src/cross-script-search";
import { searchVehicleCatalog } from "../../packages/domain/src/search-discovery";
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
  {lot:"EA-10603",vin:"WVWZZZCD6TW10603",title:"2026 Volkswagen Golf GTI",year:2026,model:"Golf GTI",brand:"Volkswagen",location:"London, UK",region:"Европа",damage:"Clean title",titleStatus:"Clean",mileage:"9 870 km",price:16250,buyNow:20500,badge:"CLEAN TITLE",image:GOLF_GTI_DEMO_IMAGE},
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
type FilterStatus = "All" | typeof auctionStatuses[number];
type SortMode = typeof sortModes[number];

export default function InventoryPage(){
  const [query,setQuery]=useState("");
  const [brand,setBrand]=useState("All");
  const [model,setModel]=useState("All");
  const [region,setRegion]=useState("All");
  const [location,setLocation]=useState("All");
  const [damage,setDamage]=useState("All");
  const [titleStatus,setTitleStatus]=useState("All");
  const [auctionStatus,setAuctionStatus]=useState<FilterStatus>("All");
  const [yearFrom,setYearFrom]=useState(2010);
  const [yearTo,setYearTo]=useState(2026);
  const [buyNow,setBuyNow]=useState(false);
  const [priceMin,setPriceMin]=useState("");
  const [priceMax,setPriceMax]=useState("");
  const [savedLots,setSavedLots]=useState<string[]>([]);
  const [saveSearchFeedback,setSaveSearchFeedback]=useState("");
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
    setSavedLots(getDemoWatchlist().map(vehicle=>vehicle.lot));
    const onStorage=()=>setSavedLots(getDemoWatchlist().map(vehicle=>vehicle.lot));
    window.addEventListener("storage",onStorage);
    return()=>window.removeEventListener("storage",onStorage);
  },[]);

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
    const nextPriceMin=params.get("priceMin");
    const nextPriceMax=params.get("priceMax");
    if(nextPriceMin && /^\d+$/.test(nextPriceMin))setPriceMin(nextPriceMin);
    if(nextPriceMax && /^\d+$/.test(nextPriceMax))setPriceMax(nextPriceMax);
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
    if(brand!=="All")params.set("make",brand);
    if(model!=="All")params.set("model",model);
    if(region!=="All")params.set("region",region);
    if(location!=="All")params.set("location",location);
    if(damage!=="All")params.set("damage",damage);
    if(titleStatus!=="All")params.set("title",titleStatus);
    if(auctionStatus!=="All")params.set("status",auctionStatus);
    if(yearFrom!==2010)params.set("yearFrom",String(yearFrom));
    if(yearTo!==2026)params.set("yearTo",String(yearTo));
    if(priceMin && Number.isFinite(Number(priceMin)))params.set("priceMin",priceMin);
    if(priceMax && Number.isFinite(Number(priceMax)))params.set("priceMax",priceMax);
    if(buyNow)params.set("buyNow","1");
    if(liveOnly)params.set("live","1");
    if(sort!=="recommended")params.set("sort",sort);
    if(currentPage>1)params.set("page",String(currentPage));
    const search=params.toString();
    const nextUrl=`${window.location.pathname}${search?`?${search}`:""}${window.location.hash}`;
    window.history.replaceState(window.history.state,"",nextUrl);
  },[urlReady,query,brand,model,region,location,damage,titleStatus,auctionStatus,yearFrom,yearTo,priceMin,priceMax,buyNow,liveOnly,sort,currentPage]);

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
    const stateBadge=status==="sold"?"SOLD":status==="live"?"LIVE":status==="next"?"NEXT LOT":car.badge;
    return {...car,index,status,stateBadge,price:bidPrices[car.lot]??car.price};
  }),[activeIndex,nextIndex,bidPrices]);

  const models=useMemo(()=>["All",...Array.from(new Set(cars.filter(car=>brand==="All"||car.brand===brand).map(car=>car.model)))],[brand]);
  const locations=useMemo(()=>["All",...Array.from(new Set(cars.filter(car=>region==="All"||car.region===region).map(car=>car.location)))],[region]);
  const damages=["All",...Array.from(new Set(cars.map(car=>car.damage)))];
  const titleStatuses=["All",...Array.from(new Set(cars.map(car=>car.titleStatus)))];

  useEffect(()=>{
    if(!models.includes(model))setModel("All");
  },[models,model]);

  useEffect(()=>{
    if(!locations.includes(location))setLocation("All");
  },[locations,location]);

  const placeBid=(lot:string)=>{
    setBidPrices(current=>({...current,[lot]:(current[lot]??cars.find(car=>car.lot===lot)?.price??0)+100}));
    setRemaining(LOT_SECONDS);
  };

  const toggleSaved=(car: typeof cars[number] & {status: AuctionStatus;price:number})=>{
    const current=getDemoWatchlist();
    const exists=current.some(item=>item.lot===car.lot);
    const next=exists?current.filter(item=>item.lot!==car.lot):[...current,{
      lot:car.lot,title:car.title,location:car.location,damage:car.damage,
      bid:car.price,state:(car.status==="live"?"LIVE":car.buyNow>0?"BUY NOW":"UPCOMING") as DemoSavedVehicle["state"],image:car.image,
    }];
    setSavedLots(setDemoWatchlist(next).map(item=>item.lot));
  };

  const resetFilters=()=>{
    setBrand("All");setModel("All");setRegion("All");setLocation("All");setDamage("All");setTitleStatus("All");setAuctionStatus("All");setYearFrom(2010);setYearTo(2026);setPriceMin("");setPriceMax("");setBuyNow(false);setLiveOnly(false);setQuery("");setCurrentPage(1);
  };

  const searchMatchLots=useMemo(()=>{
    const lots=new Set(searchVehicleCatalog(
      auctionCars.map(car=>({
        id:car.lot,
        lot:car.lot,
        vin:car.vin,
        title:car.title,
        make:car.brand,
        model:car.model,
        year:car.year,
        region:car.region,
        location:car.location,
        damage:car.damage,
        titleStatus:car.titleStatus,
        status:car.status==="next"?"upcoming":car.status,
        priceCents:Math.round(car.price*100),
        buyNowCents:Math.round(car.buyNow*100),
        updatedAt:"2026-09-29T00:00:00.000Z",
      })),
      {query,typoTolerance:true,sort:"recommended"},
    ).map(result=>result.vehicle.lot));
    for(const car of auctionCars){
      if(matchesCrossScriptSearch(query,{
        text:[car.title,car.brand,car.model,car.location,car.damage,car.titleStatus],
        identifiers:[car.vin,car.lot],
      }))lots.add(car.lot);
    }
    return lots;
  },[auctionCars,query]);

  const filtered=useMemo(()=>{
    let list=auctionCars.filter(car=>{
      const matchesQuery=searchMatchLots.has(car.lot);
      const matchesBrand=brand==="All"||car.brand===brand;
      const matchesModel=model==="All"||car.model===model;
      const matchesRegion=region==="All"||car.region===region;
      const matchesLocation=location==="All"||car.location===location;
      const matchesDamage=damage==="All"||car.damage===damage;
      const matchesTitle=titleStatus==="All"||car.titleStatus===titleStatus;
      const matchesYear=car.year>=Math.min(yearFrom,yearTo)&&car.year<=Math.max(yearFrom,yearTo);
      const amount=car.price;
      const matchesPriceMin=!priceMin||!Number.isFinite(Number(priceMin))||amount>=Number(priceMin);
      const matchesPriceMax=!priceMax||!Number.isFinite(Number(priceMax))||amount<=Number(priceMax);
      const matchesBuy=!buyNow||car.buyNow>0;
      const normalizedStatus=car.status==="next"?"UPCOMING":car.status.toUpperCase();
      const matchesStatus=auctionStatus==="All"||normalizedStatus===auctionStatus;
      const matchesLive=!liveOnly||car.status==="live";
      return matchesQuery&&matchesBrand&&matchesModel&&matchesRegion&&matchesLocation&&matchesDamage&&matchesTitle&&matchesYear&&matchesPriceMin&&matchesPriceMax&&matchesBuy&&matchesStatus&&matchesLive;
    });
    if(sort==="priceLow")list=[...list].sort((a,b)=>a.price-b.price);
    if(sort==="priceHigh")list=[...list].sort((a,b)=>b.price-a.price);
    if(sort==="yearNewest")list=[...list].sort((a,b)=>b.year-a.year||a.lot.localeCompare(b.lot));
    if(sort==="yearOldest")list=[...list].sort((a,b)=>a.year-b.year||a.lot.localeCompare(b.lot));
    return list;
  },[auctionCars,searchMatchLots,brand,model,region,location,damage,titleStatus,auctionStatus,yearFrom,yearTo,priceMin,priceMax,buyNow,liveOnly,sort]);

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
  if(brand!=="All")activeFilters.push({key:"make",label:`Make: ${brand}`,clear:()=>{setBrand("All");setModel("All");setCurrentPage(1);}});
  if(model!=="All")activeFilters.push({key:"model",label:`Model: ${model}`,clear:()=>{setModel("All");setCurrentPage(1);}});
  if(region!=="All")activeFilters.push({key:"region",label:`Region: ${region}`,clear:()=>{setRegion("All");setLocation("All");setCurrentPage(1);}});
  if(location!=="All")activeFilters.push({key:"location",label:`Location: ${location}`,clear:()=>{setLocation("All");setCurrentPage(1);}});
  if(damage!=="All")activeFilters.push({key:"damage",label:`Повреда: ${damage}`,clear:()=>{setDamage("All");setCurrentPage(1);}});
  if(titleStatus!=="All")activeFilters.push({key:"title",label:`Талон: ${titleStatus==="Clean"?"Clean title":"Salvage title"}`,clear:()=>{setTitleStatus("All");setCurrentPage(1);}});
  if(auctionStatus!=="All")activeFilters.push({key:"status",label:`Статус: ${auctionStatus}`,clear:()=>{setAuctionStatus("All");setCurrentPage(1);}});
  if(yearFrom!==2010||yearTo!==2026)activeFilters.push({key:"year",label:`Year: ${Math.min(yearFrom,yearTo)}–${Math.max(yearFrom,yearTo)}`,clear:()=>{setYearFrom(2010);setYearTo(2026);setCurrentPage(1);}});
  if(priceMin)activeFilters.push({key:"priceMin",label:`Min: €${priceMin}`,clear:()=>{setPriceMin("");setCurrentPage(1);}});
  if(priceMax)activeFilters.push({key:"priceMax",label:`Max: €${priceMax}`,clear:()=>{setPriceMax("");setCurrentPage(1);}});
  if(buyNow)activeFilters.push({key:"buyNow",label:"Buy Now",clear:()=>{setBuyNow(false);setCurrentPage(1);}});
  if(liveOnly)activeFilters.push({key:"live",label:"LIVE only",clear:()=>{setLiveOnly(false);setCurrentPage(1);}});

  const formatTime=(seconds:number)=>`00:${String(seconds).padStart(2,"0")}`;
  const liveCar=auctionCars.find(car=>car.status==="live");

  return <main id="main-content" className="inventoryPage" data-design-task="D11" data-design-filter-task="D12" data-design-url-task="D13" data-design-pagination-task="D14" data-result-count={filtered.length} data-current-page={currentPage}>
    <div className="inv2TopUtility"><div className="inv2UtilityLive"><i/> ENCHEV LIVE NETWORK <span>·</span> Real-time updates</div><div className="inv2UtilityRight"><span>BG · EUR</span><a href="/support">Help</a><a href="/transport">Transport</a></div></div>

    <header className="inventoryHeader">
      <a href="/" className="inventoryLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="inventorySearch"><span>⌕</span><input value={query} onChange={e=>{setQuery(e.target.value);setCurrentPage(1);}} placeholder="Search марка, модел, VIN, LOT, повреда или локация..." aria-label="Търсене по марка, модел, VIN или LOT"/><button>Search</button></div>
      <div className="inventoryAccount"><a href={accountNavigation.profile}>Login / Profile</a><a className="registerBtn" href={accountNavigation.register}>Register</a></div>
    </header>

    <nav className="inventoryNav" aria-label="Основна навигация"><a href="/">Home</a>{primaryNavigation.map(item=><a key={item.key} className={`${item.key==="inventory"?"active":""} ${item.key==="live"?"navLive":""}`.trim()} href={item.href}>{item.label}</a>)}</nav>

    <section className="inv2Hero">
      <div className="inventoryIntro"><div><span>ENCHEV MARKETPLACE</span><h1>Vehicles from international auctions</h1><p>Filter, watch and bid. LIVE лотът има 10-секунден брояч; всяка нова оферта връща времето на 10 секунди.</p></div></div>
      <div className="inv2HeroStats"><div className="inv2HeroStat"><b>{cars.length}</b><span>active lots</span></div><div className="inv2HeroStat"><b>{cars.filter(c=>c.buyNow>0).length}</b><span>buy now</span></div><div className="inv2HeroStat"><b>{formatTime(remaining)}</b><span>live timer</span></div></div>
    </section>

    <div className="inv2Quickbar"><div className="inv2Chips"><button className={`inv2Chip ${activeFilters.length===0?"active":""}`} onClick={resetFilters}>All</button><button className={`inv2Chip ${liveOnly?"active":""}`} onClick={()=>{setLiveOnly(v=>!v);setCurrentPage(1);}}>● LIVE</button><button className={`inv2Chip ${buyNow?"active":""}`} onClick={()=>{setBuyNow(v=>!v);setCurrentPage(1);}}>Buy Now</button><button className={`inv2Chip ${brand==="BMW"?"active":""}`} onClick={()=>{setBrand(brand==="BMW"?"All":"BMW");setCurrentPage(1);}}>BMW</button><button className={`inv2Chip ${brand==="Mercedes"?"active":""}`} onClick={()=>{setBrand(brand==="Mercedes"?"All":"Mercedes");setCurrentPage(1);}}>Mercedes</button><button className={`inv2Chip ${region==="САЩ"?"active":""}`} onClick={()=>{setRegion(region==="САЩ"?"All":"САЩ");setCurrentPage(1);}}>САЩ</button><button className={`inv2Chip ${region==="Европа"?"active":""}`} onClick={()=>{setRegion(region==="Европа"?"All":"Европа");setCurrentPage(1);}}>Европа</button></div><div><button type="button" className="inv2SaveSearch" onClick={()=>{
      if(typeof window==="undefined")return;
      try{
        const key="enchev-demo-saved-searches-v1";
        const previous=JSON.parse(localStorage.getItem(key)||"[]") as string[];
        const url=window.location.pathname+window.location.search;
        const updated=[url,...previous.filter(item=>item!==url)].slice(0,30);
        localStorage.setItem(key,JSON.stringify(updated));
        setSaveSearchFeedback("Preview search saved on this device");
      }catch{setSaveSearchFeedback("Local browser storage unavailable");}
    }}>♡ Save search</button>{saveSearchFeedback&&<small role="status" aria-live="polite">{saveSearchFeedback}</small>}</div></div>

    {activeFilters.length>0&&<div className="inv2ActiveFilters" aria-label="Активни филтри" data-active-filter-count={activeFilters.length}>
      <span className="inv2ActiveFiltersLabel">Активни филтри</span>
      <div className="inv2ActiveFilterList">{activeFilters.map(filter=><button type="button" className="inv2ActiveFilterChip" key={filter.key} onClick={filter.clear} aria-label={`Премахни филтър ${filter.label}`}><span>{filter.label}</span><b aria-hidden="true">×</b></button>)}</div>
      <button type="button" className="inv2ClearAll" onClick={resetFilters}>Clear всички</button>
    </div>}

    <button className="inv2MobileFiltersToggle" type="button" aria-controls="inventory-filter-panel" aria-expanded={mobileFiltersOpen} onClick={()=>setMobileFiltersOpen(open=>!open)}>
      <span>⚙ Filters</span><strong>{mobileFiltersOpen?"Close":"Open"}</strong>
    </button>

    <div className="inventoryShell">
      <aside id="inventory-filter-panel" className={`inventoryFilters ${mobileFiltersOpen?"isMobileOpen":""}`} aria-label="Filters за инвентара">
        <div className="filterTitle"><b>Search filters</b><button onClick={resetFilters}>Clear{activeFilters.length>0?` (${activeFilters.length})`:""}</button></div>
        <label className="filterSearchLabel">Search results<input value={query} onChange={e=>{setQuery(e.target.value);setCurrentPage(1);}} placeholder="BMW, EA-10482, WBS3R9..."/></label>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Quick filters</b><small>LIVE / BUY NOW</small></div><label><input type="checkbox" checked={liveOnly} onChange={e=>{setLiveOnly(e.target.checked);setCurrentPage(1);}}/> LIVE only</label><label><input type="checkbox" checked={buyNow} onChange={e=>{setBuyNow(e.target.checked);setCurrentPage(1);}}/> Buy Now</label></div>
        <div className="filterBlock filterBlock--select"><b>Make</b><select className="inv2Select" value={brand} onChange={e=>{setBrand(e.target.value);setCurrentPage(1);}} aria-label="Филтър по марка">{["All",...brands].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Model</b><select className="inv2Select" value={model} onChange={e=>{setModel(e.target.value);setCurrentPage(1);}} aria-label="Филтър по модел">{models.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Year</b><small>{Math.min(yearFrom,yearTo)}–{Math.max(yearFrom,yearTo)}</small></div><div className="inv2Range"><input type="number" min="2010" max="2026" value={yearFrom} onChange={e=>{setYearFrom(Number(e.target.value)||2010);setCurrentPage(1);}} aria-label="Year от"/><input type="number" min="2010" max="2026" value={yearTo} onChange={e=>{setYearTo(Number(e.target.value)||2026);setCurrentPage(1);}} aria-label="Year до"/></div></div>
        <div className="filterBlock filterBlock--select"><b>Region</b><select className="inv2Select" value={region} onChange={e=>{setRegion(e.target.value);setCurrentPage(1);}} aria-label="Филтър по регион">{["All",...regions].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Location</b><select className="inv2Select" value={location} onChange={e=>{setLocation(e.target.value);setCurrentPage(1);}} aria-label="Филтър по локация">{locations.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Primary damage</b><select className="inv2Select" value={damage} onChange={e=>{setDamage(e.target.value);setCurrentPage(1);}} aria-label="Филтър по повреда">{damages.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Title status</b><select className="inv2Select" value={titleStatus} onChange={e=>{setTitleStatus(e.target.value);setCurrentPage(1);}} aria-label="Филтър по статус на талона">{titleStatuses.map(x=><option key={x} value={x}>{x==="All"?x:x==="Clean"?"Clean title":"Salvage title"}</option>)}</select></div>
        <div className="filterBlock filterBlock--select"><b>Auction status</b><select className="inv2Select" value={auctionStatus} onChange={e=>{setAuctionStatus(e.target.value as FilterStatus);setCurrentPage(1);}} aria-label="Филтър по статус на търга">{["All",...auctionStatuses].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Price</b><small>EUR</small></div><div className="inv2Range"><input type="number" min="0" step="100" value={priceMin} onChange={e=>{setPriceMin(e.target.value);setCurrentPage(1);}} placeholder="Min €" aria-label="Minimum price"/><input type="number" min="0" step="100" value={priceMax} onChange={e=>{setPriceMax(e.target.value);setCurrentPage(1);}} placeholder="Max €" aria-label="Maximum price"/></div></div>
        <div className="filterBlock collapsed"><b>Vehicle type</b><span>+</span></div><div className="filterBlock collapsed"><b>Engine</b><span>+</span></div><div className="filterBlock collapsed"><b>Transmission</b><span>+</span></div><div className="filterBlock collapsed"><b>Mileage</b><span>+</span></div><div className="filterBlock collapsed"><b>Auction date</b><span>+</span></div>
      </aside>

      <section className="inventoryResults" aria-label="Резултати от инвентара">
        <div className="inventoryToolbar">
          <div className="inv2ResultMeta" aria-live="polite"><b>{filtered.length} results</b><span className="inv2ResultRange">{filtered.length>0?`Showing ${rangeStart}–${rangeEnd} от ${filtered.length}`:"Няма резултати за показване"}</span><span className="inv2ResultLive">{liveCar?`LIVE: ${liveCar.title} · ${formatTime(remaining)}`:"Няма активен LIVE лот"}</span></div>
          <div className="inventoryToolbarControls">
            <div className="inv2ViewSwitch" role="group" aria-label="Изглед на резултатите">
              <button type="button" className={viewMode==="grid"?"active":""} onClick={()=>setViewMode("grid")} aria-pressed={viewMode==="grid"} aria-label="Покажи като мрежа">▦</button>
              <button type="button" className={viewMode==="list"?"active":""} onClick={()=>setViewMode("list")} aria-pressed={viewMode==="list"} aria-label="Покажи като списък">☰</button>
            </div>
            <select className="inv2SortSelect" value={sort} onChange={e=>{setSort(e.target.value as SortMode);setCurrentPage(1);}} aria-label="Сортиране на резултатите"><option value="recommended">Recommended</option><option value="priceLow">Price: low → high</option><option value="priceHigh">Price: high → low</option><option value="yearNewest">Year: newest → oldest</option><option value="yearOldest">Year: oldest → newest</option></select>
          </div>
        </div>

        <div className={`inventoryGrid ${viewMode==="list"?"inventoryGrid--list":""}`} data-view={viewMode}>{paged.map(car=><article className={`inventoryCard ${car.status==="sold"?"soldCard":""} ${car.status==="live"?"liveCard":""} ${car.status==="next"?"nextCard":""}`} key={car.lot}>
          <div className="inventoryImage">
            <img src={car.image} alt={car.title}/>
            {car.lot==="EA-10603"&&<a className="inventoryDemoPhotoCredit" href={GOLF_GTI_DEMO_PHOTO_CREDIT} target="_blank" rel="noopener noreferrer">Demo GTI photo ↗</a>}
            <span className={`inventoryBadge ${car.status}`}>{car.stateBadge}</span>
            {car.status!=="sold"&&<span className="inventoryTimer">◷ {car.status==="live"?formatTime(remaining):car.status==="next"?"СЛЕДВАЩ":"UPCOMING"}</span>}
            <button type="button" className="inventoryHeart" aria-pressed={savedLots.includes(car.lot)} aria-label={savedLots.includes(car.lot)?`Remove ${car.title} from preview watchlist`:`Save ${car.title} to preview watchlist`} onClick={()=>toggleSaved(car)}>{savedLots.includes(car.lot)?"♥":"♡"}</button>
            {car.status==="sold"&&<div className="soldStamp">SOLD</div>}
            {car.status==="live"&&<div className="liveBidOrb"><span className="liveBidText">NEW BID</span><span className="liveSaleText">ПРОДАВА СЕ<br/>НА ЖИВО</span><i>◉</i><strong className="liveCountdown">{remaining}</strong><small>СЕК</small></div>}
          </div>
          <div className="inventoryCardBody">
            <div className="inventoryLot">LOT {car.lot}<span>● VERIFIED</span></div><h2>{car.title}</h2>
            <dl><div><dt>Mileage</dt><dd>{car.mileage}</dd></div><div><dt>Повреда</dt><dd>{car.damage}</dd></div><div><dt>Location</dt><dd>{car.location}</dd></div></dl>
            <button className="detailsBtn">More details <span>⌄</span></button>
            {car.status==="sold"?<><div className="saleEnded">Sale ended</div><div className="inventoryActions soldActions"><button className="soldDetailsBtn">View details</button></div></>:<><div className="inventoryPrice"><span>{car.status==="next"?"Starting bid":"Current bid"}</span><b>€{car.price.toLocaleString("bg-BG")}</b></div><div className="inventoryActions">{car.buyNow>0&&car.status!=="next"&&<button type="button" className="buyBtn" onClick={()=>window.location.assign(`/lot/${car.lot}`)}>Preview Buy Now · €{car.buyNow.toLocaleString("bg-BG")}</button>}<button className={`bidBtn ${car.status==="next"?"nextBidBtn":""}`} disabled={car.status==="next"} onClick={()=>car.status==="live"?placeBid(car.lot):window.location.assign(`/lot/${car.lot}`)}>{car.status==="live"?"Demo bid +€100":car.status==="next"?"Next lot":"View bid options"} <span>→</span></button></div></>}
          </div>
        </article>)}</div>

        {filtered.length===0&&<div className="emptyInventory"><b>Няма намерени автомобили</b><span>Промени филтрите или търсенето.</span></div>}
        {filtered.length>0&&<nav className="inv2Pagination" aria-label="Страници с резултати"><button type="button" onClick={()=>setCurrentPage(page=>Math.max(1,page-1))} disabled={currentPage===1} aria-label="Предишна страница">‹</button>{pageNumbers.map(page=><button type="button" key={page} onClick={()=>setCurrentPage(page)} aria-current={currentPage===page?"page":undefined} aria-label={`Page ${page}`}>{page}</button>)}<button type="button" onClick={()=>setCurrentPage(page=>Math.min(totalPages,page+1))} disabled={currentPage===totalPages} aria-label="Nextа страница">›</button><span className="inv2PaginationStatus">Page {currentPage} / {totalPages}</span></nav>}
      </section>
    </div>
  </main>
}
