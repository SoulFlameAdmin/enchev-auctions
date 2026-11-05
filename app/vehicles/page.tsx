"use client";
import {useEffect,useMemo,useState} from "react";
import "./vehicles.css";

type Lot={id:string;lot_number:string;title:string;make:string;model:string;model_year:number|null;country_code:string|null;condition_summary:string|null;starting_price:number|null;price_currency:string;status:string;auction_starts_at:string|null};
export default function VehiclesPage(){
  const [lots,setLots]=useState<Lot[]>([]);
  const [mode,setMode]=useState<"loading"|"ready"|"inactive"|"error">("loading");
  const [query,setQuery]=useState("");
  const [feedback,setFeedback]=useState("");
  const [saving,setSaving]=useState<string|null>(null);
  useEffect(()=>{
    let stopped=false;
    fetch("/api/buyer/catalog",{cache:"no-store"})
      .then(async r=>({ok:r.ok,body:await r.json()}))
      .then(({ok,body})=>{if(stopped)return;
        if(!ok){setMode(body.available===false?"inactive":"error");return;}
        setLots(Array.isArray(body.lots)?body.lots:[]);
        setMode("ready");
      }).catch(()=>{if(!stopped)setMode("error")});
    return()=>{stopped=true};
  },[]);
  const filtered=useMemo(()=>lots.filter(l=>(l.title+" "+l.make+" "+l.model+" "+l.lot_number).toLowerCase().includes(query.trim().toLowerCase())),[lots,query]);
  async function save(id:string){
    if(saving)return;setSaving(id);setFeedback("");
    try{
      const r=await fetch("/api/buyer/saved",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({lot_id:id})});
      const body=await r.json();
      if(!r.ok||body.ok!==true)throw Error(body.error||"Неуспешен запис.");
      setFeedback("Автомобилът е записан в защитения ти профил.");
    }catch(e){setFeedback(e instanceof Error?e.message:"Неуспешен запис. Първо влез в профила си.");}
    finally{setSaving(null);}
  }
  return <main id="main-content" className="eaRealVehicles">
    <section className="eaRealVehiclesWrap">
      <div className="eaVehicleEyebrow">E&A · VERIFIED VEHICLE MARKETPLACE</div>
      <h1>ИЗБЕРИ <em>АВТОМОБИЛ.</em></h1>
      <p>На тази страница се виждат единствено автомобили, проверени от екипа и одобрени за публикуване. Демо лотовете са отделно.</p>
      <div className="eaVehicleActions"><a href="/profile">Моят профил ↗</a><a href="/auctions">LIVE търгове ↗</a><a href="/start">7 стъпки ↗</a></div>
      <div className="eaVehicleSearch"><label htmlFor="ea-vehicle-search">Търси по марка, модел или номер на лот</label><input id="ea-vehicle-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="BMW, Mercedes, EA-12345…"/></div>
      {mode==="loading"?<div className="eaVehicleNotice" role="status">Проверяваме одобрените обяви…</div>:
       mode==="inactive"?<div className="eaVehicleNotice" role="status"><h2>Каталогът очаква активиране</h2><p>Сигурната връзка с купуваческата база все още не е активирана. Няма да показваме измислени автомобили като реални обяви.</p><a href="/start#early-access">Заяви ранен достъп ↗</a></div>:
       mode==="error"?<div className="eaVehicleNotice" role="alert"><h2>Каталогът е временно недостъпен</h2><p>Не можем да потвърдим данните за автомобилите.</p></div>:
       filtered.length===0?<div className="eaVehicleNotice" role="status"><h2>{query?"Няма резултати по търсенето":"Няма публикувани реални автомобили"}</h2><p>Появяват се само автомобили с проверен продавач и одобрена обява. Демо лотовете не се показват тук.</p><a href="/auctions">Към търговете ↗</a></div>:
       <div className="eaVehicleGrid">{filtered.map(l=><article key={l.id} className="eaVehicleCard">
         <span>LOT {l.lot_number} · {l.status.toUpperCase()}</span><h2>{l.title}</h2><p>{[l.model_year,l.country_code,l.condition_summary].filter(Boolean).join(" · ")}</p>
         <strong>{l.starting_price===null?"Начална цена: очаква се":new Intl.NumberFormat("bg-BG",{style:"currency",currency:l.price_currency}).format(l.starting_price)}</strong>
         <div><a href={"/vehicles/"+l.id}>Детайли ↗</a><button type="button" disabled={saving===l.id} onClick={()=>void save(l.id)}>{saving===l.id?"Записване…":"☆ Запази"}</button></div>
       </article>)}</div>}
      {feedback&&<p role="status" className="eaVehicleFeedback">{feedback}</p>}
    </section>
  </main>;
}
