"use client";

import { useEffect, useMemo, useState } from "react";

const cars = [
  {lot:"EA-10482",title:"2018 BMW M4 F82",brand:"BMW",location:"Sofia, BG",damage:"Minor dents",mileage:"82 410 km",time:"2ч 18м",price:12750,buyNow:18900,badge:"ПРОДАДЕНО",status:"sold",image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10511",title:"2021 Mercedes-Benz GLC",brand:"Mercedes",location:"Munich, DE",damage:"Front end",mileage:"64 900 km",time:"4ч 06м",price:18400,buyNow:24900,badge:"ПРОДАДЕНО",status:"sold",image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10539",title:"2022 Audi RS3 Sportback",brand:"Audi",location:"Crewe, UK",damage:"Minor scratches",mileage:"41 280 km",time:"1ч 42м",price:21900,buyNow:0,badge:"ПРОДАВА СЕ НА ЖИВО",status:"live",image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10603",title:"2026 Volkswagen Golf GTI",brand:"Volkswagen",location:"London, UK",damage:"Clean title",mileage:"9 870 km",time:"5ч 44м",price:16250,buyNow:20500,badge:"CLEAN TITLE",status:"open",image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10627",title:"2020 BMW X5 xDrive40i",brand:"BMW",location:"Texas, USA",damage:"Rear end",mileage:"96 210 km",time:"7ч 12м",price:15100,buyNow:22400,badge:"RUN & DRIVE",status:"open",image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10644",title:"2019 Mercedes-AMG C43",brand:"Mercedes",location:"Florida, USA",damage:"Side",mileage:"72 030 km",time:"9ч 25м",price:13800,buyNow:19800,badge:"ПРОДАВА СЕ НА ЖИВО",status:"live",image:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10671",title:"2021 Audi Q7 55 TFSI",brand:"Audi",location:"New Jersey, USA",damage:"Normal wear",mileage:"58 440 km",time:"11ч 03м",price:19900,buyNow:26900,badge:"BUY NOW",status:"open",image:"https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=1200&q=82"},
  {lot:"EA-10702",title:"2023 Porsche Macan S",brand:"Porsche",location:"California, USA",damage:"Front end",mileage:"21 540 km",time:"13ч 48м",price:28750,buyNow:0,badge:"PREMIUM",status:"open",image:"https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=82"},
];

export default function InventoryPage(){
  const [query,setQuery]=useState("");
  const [brand,setBrand]=useState("Всички");
  const [buyNow,setBuyNow]=useState(false);
  const [liveOnly,setLiveOnly]=useState(false);
  const [sort,setSort]=useState("recommended");

  useEffect(()=>{
    const q=new URLSearchParams(window.location.search).get("q");
    if(q)setQuery(q);
  },[]);

  const filtered=useMemo(()=>{
    let list=cars.filter(car=>{
      const q=query.trim().toLowerCase();
      const matchesQuery=!q||`${car.title} ${car.lot} ${car.location}`.toLowerCase().includes(q);
      const matchesBrand=brand==="Всички"||car.brand===brand;
      const matchesBuy=!buyNow||car.buyNow>0;
      const matchesLive=!liveOnly||car.status==="live";
      return matchesQuery&&matchesBrand&&matchesBuy&&matchesLive;
    });
    if(sort==="priceLow") list=[...list].sort((a,b)=>a.price-b.price);
    if(sort==="priceHigh") list=[...list].sort((a,b)=>b.price-a.price);
    return list;
  },[query,brand,buyNow,liveOnly,sort]);

  return <main className="inventoryPage">
    <header className="inventoryHeader">
      <a href="/" className="inventoryLogo"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="inventorySearch"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Търси марка, модел, VIN или LOT..."/><button>Търси</button></div>
      <div className="inventoryAccount"><button>Вход</button><button className="registerBtn">Регистрация</button></div>
    </header>
    <nav className="inventoryNav"><a href="/">Начало</a><a className="active" href="/inventory">Инвентар</a><a href="/#how">Как работи</a><a href="/#contact">Транспорт</a><a href="/#contact">Помощ</a></nav>

    <section className="inventoryIntro"><div><span>ENCHEV MARKETPLACE</span><h1>Инвентар от автомобилни търгове</h1><p>Филтрирай, сравнявай и отвори лот за участие в търг или Buy Now.</p></div><div className="inventoryCounter"><b>{filtered.length}</b><span>показани лота</span></div></section>

    <div className="inventoryShell">
      <aside className="inventoryFilters">
        <div className="filterTitle"><b>Филтри</b><button onClick={()=>{setBrand("Всички");setBuyNow(false);setLiveOnly(false);setQuery("");}}>Изчисти</button></div>
        <label className="filterSearchLabel">Търси в резултатите<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="BMW, EA-10482..."/></label>
        <div className="filterBlock"><b>Марка</b>{["Всички","BMW","Mercedes","Audi","Volkswagen","Porsche"].map(x=><button key={x} onClick={()=>setBrand(x)} className={brand===x?"selected":""}><span>{x}</span><small>{x==="Всички"?cars.length:cars.filter(c=>c.brand===x).length}</small></button>)}</div>
        <div className="filterBlock"><b>Тип продажба</b><label><input type="checkbox" checked={liveOnly} onChange={e=>setLiveOnly(e.target.checked)}/> Само LIVE</label><label><input type="checkbox" checked={buyNow} onChange={e=>setBuyNow(e.target.checked)}/> Buy Now</label></div>
        <div className="filterBlock"><b>Локация</b><button><span>САЩ</span><small>4</small></button><button><span>Европа</span><small>4</small></button></div>
        <div className="filterBlock collapsed"><b>Основна повреда</b><span>+</span></div>
        <div className="filterBlock collapsed"><b>Година</b><span>+</span></div>
        <div className="filterBlock collapsed"><b>Пробег</b><span>+</span></div>
      </aside>

      <section className="inventoryResults">
        <div className="inventoryToolbar"><div><b>{filtered.length} резултата</b><span>Актуални demo лотове за интерфейса</span></div><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Препоръчани</option><option value="priceLow">Цена: ниска → висока</option><option value="priceHigh">Цена: висока → ниска</option></select></div>
        <div className="inventoryGrid">{filtered.map(car=><article className={`inventoryCard ${car.status==="sold"?"soldCard":""} ${car.status==="live"?"liveCard":""}`} key={car.lot}>
          <div className="inventoryImage">
            <img src={car.image} alt={car.title}/>
            <span className={`inventoryBadge ${car.status==="live"?"live":""} ${car.status==="sold"?"sold":""}`}>{car.badge}</span>
            {car.status!=="sold"&&<span className="inventoryTimer">◷ {car.time}</span>}
            <button className="inventoryHeart">♡</button>
            {car.status==="sold"&&<div className="soldStamp">SOLD</div>}
            {car.status==="live"&&<div className="liveBidOrb"><span className="liveBidText">NEW BID</span><span className="liveSaleText">ПРОДАВА СЕ<br/>НА ЖИВО</span><i>◉</i></div>}
          </div>
          <div className="inventoryCardBody">
            <div className="inventoryLot">LOT {car.lot}<span>● VERIFIED</span></div>
            <h2>{car.title}</h2>
            <dl><div><dt>Пробег</dt><dd>{car.mileage}</dd></div><div><dt>Повреда</dt><dd>{car.damage}</dd></div><div><dt>Локация</dt><dd>{car.location}</dd></div></dl>
            <button className="detailsBtn">Повече детайли <span>⌄</span></button>
            {car.status==="sold" ? <><div className="saleEnded">Продажбата приключи</div><div className="inventoryActions soldActions"><button className="soldDetailsBtn">Виж детайлите</button></div></> : <><div className="inventoryPrice"><span>Текуща ставка</span><b>€{car.price.toLocaleString("bg-BG")}</b></div><div className="inventoryActions">{car.buyNow>0&&<button className="buyBtn">Купи €{car.buyNow.toLocaleString("bg-BG")}</button>}<button className="bidBtn">{car.status==="live"?"Присъедини се към живия търг":"Оферирай"} <span>→</span></button></div></>}
          </div>
        </article>)}</div>
        {filtered.length===0&&<div className="emptyInventory"><b>Няма намерени автомобили</b><span>Промени филтрите или търсенето.</span></div>}
      </section>
    </div>
  </main>
}
