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
  useEffect(()=>{setQuery(new URLSearchParams(window.location.search).get("q")||"");},[]);
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
      <header className="eaVehicleHero">
        <div className="eaVehicleEyebrow"><span aria-hidden="true" className="eaVehicleEyebrowMark"/> E&A · ПРОВЕРЕНИ АВТОМОБИЛИ</div>
        <h1><span>ИЗБЕРИ</span><em>АВТОМОБИЛ.</em></h1>
        <p className="eaVehicleLead">Автомобили с проверени обяви, одобрени за публикуване. Реалният каталог и демонстрационните търгове са разделени.</p>
        <nav className="eaVehicleActions" aria-label="Бързи действия">
          <a className="eaVehicleActionPrimary" href="/auctions">Търгове на живо <span aria-hidden="true">↗</span></a>
          <a className="eaVehicleActionSecondary" href="/start">Как се купува <span aria-hidden="true">↗</span></a>
          <a className="eaVehicleActionProfile" href="/profile">Моят профил <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <div className="eaVehicleSearch">
        <div className="eaVehicleSearchHeading">
          <label htmlFor="ea-vehicle-search">Намери автомобил</label>
          <span>МАРКА · МОДЕЛ · НОМЕР НА ЛОТ</span>
        </div>
        <div className="eaVehicleInputWrap">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 5 5"/></svg>
          <input id="ea-vehicle-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: BMW, Mercedes, EA-12345" autoComplete="off"/>
        </div>
      </div>
      {mode==="loading"?<div className="eaVehicleNotice eaVehicleNoticeLoading" role="status"><span className="eaVehicleNoticeIcon" aria-hidden="true">◌</span><div><h2>Проверяваме каталога</h2><p>Зареждаме само одобрените обяви.</p></div></div>:
       mode==="inactive"?<div className="eaVehicleNotice" role="status"><span className="eaVehicleNoticeKicker">СЪСТОЯНИЕ НА КАТАЛОГА</span><h2>Подготвяме реалните обяви.</h2><p>Каталогът още не е активиран. Тук ще се появяват само проверени и одобрени автомобили — без демонстрационни лотове, представяни за реални.</p><a href="/start#early-access">Заяви ранен достъп <span aria-hidden="true">↗</span></a></div>:
       mode==="error"?<div className="eaVehicleNotice" role="alert"><span className="eaVehicleNoticeKicker">ВРЪЗКА С КАТАЛОГА</span><h2>Каталогът е временно недостъпен.</h2><p>Не можем да потвърдим данните за автомобилите. Опитай отново по-късно.</p></div>:
       filtered.length===0?<div className="eaVehicleNotice" role="status"><span className="eaVehicleNoticeKicker">ПРОВЕРЕНИ ОБЯВИ</span><h2>{query?"Няма резултати за това търсене.":"Все още няма публикувани автомобили."}</h2><p>Показваме само одобрени обяви от проверени продавачи. Демо лотовете са отделно.</p><a href="/auctions">Разгледай търговете <span aria-hidden="true">↗</span></a></div>:
       <><div className="eaVehicleResultsCount" role="status">{filtered.length} {filtered.length===1?"автомобил":"автомобила"} в каталога</div><div className="eaVehicleGrid">{filtered.map(l=><article key={l.id} className="eaVehicleCard">
         <span>ЛОТ {l.lot_number} · {l.status.toUpperCase()}</span><h2>{l.title}</h2><p>{[l.model_year,l.country_code,l.condition_summary].filter(Boolean).join(" · ")}</p>
         <strong>{l.starting_price===null?"Начална цена: очаква се":new Intl.NumberFormat("bg-BG",{style:"currency",currency:l.price_currency}).format(l.starting_price)}</strong>
         <div><a href={"/vehicles/"+l.id}>Детайли ↗</a><button type="button" disabled={saving===l.id} onClick={()=>void save(l.id)}>{saving===l.id?"Записване…":"☆ Запази"}</button></div>
       </article>)}</div></>}
      {feedback&&<p role="status" className="eaVehicleFeedback">{feedback}</p>}
    </section>
  </main>;
}
