"use client";

import { useEffect, useMemo, useState } from "react";

const LOT_SECONDS = 10;
const cars = [
  {lot:"EA-10482",title:"2018 BMW M4 F82",brand:"BMW",location:"Sofia, BG",region:"Европа",damage:"Minor dents",mileage:"82 410 km",price:12750,buyNow:18900,badge:"RUN & DRIVE",image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10511",title:"2021 Mercedes-Benz GLC",brand:"Mercedes",location:"Munich, DE",region:"Европа",damage:"Front end",mileage:"64 900 km",price:18400,buyNow:24900,badge:"BUY NOW",image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10539",title:"2022 Audi RS3 Sportback",brand:"Audi",location:"Crewe, UK",region:"Европа",damage:"Minor scratches",mileage:"41 280 km",price:21900,buyNow:0,badge:"HOT LOT",image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10603",title:"2026 Volkswagen Golf GTI",brand:"Volkswagen",location:"London, UK",region:"Европа",damage:"Clean title",mileage:"9 870 km",price:16250,buyNow:20500,badge:"CLEAN TITLE",image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10627",title:"2020 BMW X5 xDrive40i",brand:"BMW",location:"Texas, USA",region:"САЩ",damage:"Rear end",mileage:"96 210 km",price:15100,buyNow:22400,badge:"RUN & DRIVE",image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10644",title:"2019 Mercedes-AMG C43",brand:"Mercedes",location:"Florida, USA",region:"САЩ",damage:"Side",mileage:"72 030 km",price:13800,buyNow:19800,badge:"HOT LOT",image:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10671",title:"2021 Audi Q7 55 TFSI",brand:"Audi",location:"New Jersey, USA",region:"САЩ",damage:"Normal wear",mileage:"58 440 km",price:19900,buyNow:26900,badge:"BUY NOW",image:"https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10702",title:"2023 Porsche Macan S",brand:"Porsche",location:"California, USA",region:"САЩ",damage:"Front end",mileage:"21 540 km",price:28750,buyNow:0,badge:"PREMIUM",image:"https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=82"},
];

type AuctionStatus = "sold" | "live" | "next" | "open";

export default function InventoryPage(){
  const [query,setQuery]=useState("");
  const [brand,setBrand]=useState("Всички");
  const [region,setRegion]=useState("Всички");
  const [buyNow,setBuyNow]=useState(false);
  const [liveOnly,setLiveOnly]=useState(false);
  const [sort,setSort]=useState("recommended");
  const [activeIndex,setActiveIndex]=useState(1);
  const [remaining,setRemaining]=useState(LOT_SECONDS);
  const [bidPrices,setBidPrices]=useState<Record<string,number>>(()=>Object.fromEntries(cars.map(car=>[car.lot,car.price])));

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search).get("q");
    if(q)setQuery(q);
  },[]);

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

  const placeBid=(lot:string)=>{
    setBidPrices(current=>({...current,[lot]:(current[lot]??cars.find(car=>car.lot===lot)?.price??0)+100}));
    setRemaining(LOT_SECONDS);
  };

  const resetFilters=()=>{setBrand("Всички");setRegion("Всички");setBuyNow(false);setLiveOnly(false);setQuery("");};

  const filtered=useMemo(()=>{
    let list=auctionCars.filter(car=>{
      const q=query.trim().toLowerCase();
      const matchesQuery=!q||`${car.title} ${car.lot} ${car.location} ${car.damage}`.toLowerCase().includes(q);
      const matchesBrand=brand==="Всички"||car.brand===brand;
      const matchesRegion=region==="Всички"||car.region===region;
      const matchesBuy=!buyNow||car.buyNow>0;
      const matchesLive=!liveOnly||car.status==="live";
      return matchesQuery&&matchesBrand&&matchesRegion&&matchesBuy&&matchesLive;
    });
    if(sort==="priceLow")list=[...list].sort((a,b)=>a.price-b.price);
    if(sort==="priceHigh")list=[...list].sort((a,b)=>b.price-a.price);
    return list;
  },[auctionCars,query,brand,region,buyNow,liveOnly,sort]);

  const formatTime=(seconds:number)=>`00:${String(seconds).padStart(2,"0")}`;
  const liveCar=auctionCars.find(car=>car.status==="live");

  return <main className="inventoryPage">
    <div className="inv2TopUtility"><div className="inv2UtilityLive"><i/> ENCHEV LIVE NETWORK <span>·</span> Обновяване в реално време</div><div className="inv2UtilityRight"><span>BG · EUR</span><span>Помощ</span><span>Транспорт</span></div></div>

    <header className="inventoryHeader">
      <a href="/" className="inventoryLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="inventorySearch"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Търси марка, модел, VIN, LOT, повреда или локация..."/><button>Търси</button></div>
      <div className="inventoryAccount"><button>Вход</button><button className="registerBtn">Регистрация</button></div>
    </header>

    <nav className="inventoryNav"><a href="/">Начало</a><a className="active" href="/inventory">Инвентар</a><a className="navLive" href="/inventory">Търгове на живо</a><a href="/#how">Как да купя</a><a href="/#contact">Транспорт</a><a href="/#contact">История на МПС</a><a href="/#contact">Поддръжка</a></nav>

    <section className="inv2Hero">
      <div className="inventoryIntro"><div><span>ENCHEV MARKETPLACE</span><h1>Автомобили от международни търгове</h1><p>Филтрирай, следи и наддавай. LIVE лотът има 10-секунден брояч; всяка нова оферта връща времето на 10 секунди.</p></div></div>
      <div className="inv2HeroStats"><div className="inv2HeroStat"><b>{cars.length}</b><span>активни лота</span></div><div className="inv2HeroStat"><b>{cars.filter(c=>c.buyNow>0).length}</b><span>buy now</span></div><div className="inv2HeroStat"><b>{formatTime(remaining)}</b><span>live таймер</span></div></div>
    </section>

    <div className="inv2Quickbar"><div className="inv2Chips"><button className={`inv2Chip ${!liveOnly&&!buyNow&&brand==="Всички"?"active":""}`} onClick={resetFilters}>Всички</button><button className={`inv2Chip ${liveOnly?"active":""}`} onClick={()=>setLiveOnly(v=>!v)}>● LIVE</button><button className={`inv2Chip ${buyNow?"active":""}`} onClick={()=>setBuyNow(v=>!v)}>Buy Now</button><button className={`inv2Chip ${brand==="BMW"?"active":""}`} onClick={()=>setBrand(brand==="BMW"?"Всички":"BMW")}>BMW</button><button className={`inv2Chip ${brand==="Mercedes"?"active":""}`} onClick={()=>setBrand(brand==="Mercedes"?"Всички":"Mercedes")}>Mercedes</button><button className={`inv2Chip ${region==="САЩ"?"active":""}`} onClick={()=>setRegion(region==="САЩ"?"Всички":"САЩ")}>САЩ</button><button className={`inv2Chip ${region==="Европа"?"active":""}`} onClick={()=>setRegion(region==="Европа"?"Всички":"Европа")}>Европа</button></div><button className="inv2SaveSearch">♡ Запази търсенето</button></div>

    <div className="inventoryShell">
      <aside className="inventoryFilters">
        <div className="filterTitle"><b>Филтри за търсене</b><button onClick={resetFilters}>Изчисти</button></div>
        <label className="filterSearchLabel">Търси в резултатите<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="BMW, EA-10482, Sofia..."/></label>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Бързи филтри</b><small>LIVE / BUY NOW</small></div><label><input type="checkbox" checked={liveOnly} onChange={e=>setLiveOnly(e.target.checked)}/> Само LIVE</label><label><input type="checkbox" checked={buyNow} onChange={e=>setBuyNow(e.target.checked)}/> Buy Now</label></div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Година</b><small>2010–2026</small></div><div className="inv2Range"><input defaultValue="2010"/><input defaultValue="2026"/></div></div>
        <div className="filterBlock"><b>Марка</b>{["Всички","BMW","Mercedes","Audi","Volkswagen","Porsche"].map(x=><button key={x} onClick={()=>setBrand(x)} className={brand===x?"selected":""}><span>{x}</span><small>{x==="Всички"?cars.length:cars.filter(c=>c.brand===x).length}</small></button>)}</div>
        <div className="filterBlock"><b>Регион</b>{["Всички","САЩ","Европа"].map(x=><button key={x} onClick={()=>setRegion(x)} className={region===x?"selected":""}><span>{x}</span><small>{x==="Всички"?cars.length:cars.filter(c=>c.region===x).length}</small></button>)}</div>
        <div className="filterBlock"><div className="inv2FilterGroupTitle"><b>Цена</b><small>EUR</small></div><div className="inv2Range"><input placeholder="От"/><input placeholder="До"/></div></div>
        <div className="filterBlock"><b>Основна повреда</b><button><span>Front end</span><small>2</small></button><button><span>Minor scratches</span><small>2</small></button><button><span>Rear end</span><small>1</small></button><button><span>Clean title</span><small>1</small></button></div>
        <div className="filterBlock collapsed"><b>Тип на талона</b><span>+</span></div><div className="filterBlock collapsed"><b>Тип превозно средство</b><span>+</span></div><div className="filterBlock collapsed"><b>Двигател</b><span>+</span></div><div className="filterBlock collapsed"><b>Скоростна кутия</b><span>+</span></div><div className="filterBlock collapsed"><b>Пробег</b><span>+</span></div><div className="filterBlock collapsed"><b>Дата на търга</b><span>+</span></div>
      </aside>

      <section className="inventoryResults">
        <div className="inventoryToolbar"><div><b>{filtered.length} резултата</b><span>{liveCar?`LIVE: ${liveCar.title} · ${formatTime(remaining)}`:"Няма активен LIVE лот"}</span></div><div className="inv2ViewSwitch"><button className="active">▦</button><button>☰</button></div><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Препоръчани</option><option value="priceLow">Цена: ниска → висока</option><option value="priceHigh">Цена: висока → ниска</option></select></div>

        <div className="inventoryGrid">{filtered.map(car=><article className={`inventoryCard ${car.status==="sold"?"soldCard":""} ${car.status==="live"?"liveCard":""} ${car.status==="next"?"nextCard":""}`} key={car.lot}>
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
        {filtered.length>0&&<div className="inv2Pagination"><button>‹</button><button className="active">1</button><button>2</button><button>3</button><span>…</span><button>12</button><button>›</button></div>}
      </section>
    </div>
  </main>
}
