"use client";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import "../vehicles.css";
type Lot={id:string;lot_number:string;title:string;make:string;model:string;model_year:number|null;vin:string|null;country_code:string|null;condition_summary:string|null;starting_price:number|null;price_currency:string;status:string;auction_starts_at:string|null;auction_ends_at:string|null};
export default function VerifiedLotPage(){
 const route=useParams<{id:string}>();
 const [lot,setLot]=useState<Lot|null>(null),[message,setMessage]=useState("Проверяваме обявата…"),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!route.id)return;let stop=false;
   fetch("/api/buyer/catalog/"+encodeURIComponent(route.id),{cache:"no-store"})
   .then(async r=>({status:r.status,json:await r.json()}))
   .then(({status,json})=>{if(stop)return;if(status===200&&json.ok){setLot(json.lot);setMessage("");}else setMessage(json.error||"Няма достъпна обява.");})
   .catch(()=>{if(!stop)setMessage("Тази обява не може да бъде проверена.")});
   return()=>{stop=true};
 },[route.id]);
 async function save(){
  if(!lot||busy)return;setBusy(true);
  try{const r=await fetch("/api/buyer/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({lot_id:lot.id})});
    const res=await r.json();setMessage(res.ok?"Запазено в личния ти профил.":res.error||"Първо влез в профила си.");
  }catch{setMessage("Временна грешка.")}
  finally{setBusy(false);}
 }
 return <main id="main-content" className="eaRealVehicles"><div className="eaRealVehiclesWrap">
  <div className="eaVehicleEyebrow">E&A · VERIFIED LOT DETAILS</div>
  {lot?<><h1>{lot.make.toUpperCase()} <em>{lot.model.toUpperCase()}</em></h1>
    <p>LOT {lot.lot_number} · {lot.status.toUpperCase()} · {lot.country_code||"Локация очаква потвърждение"}</p>
    <div className="eaVehicleNotice"><h2>{lot.title}</h2>
    <p>VIN: {lot.vin||"Не е предоставен"} · Година: {lot.model_year||"—"}</p>
    <p>{lot.condition_summary||"Описанието на състоянието предстои."}</p>
    <p>Начална цена: {lot.starting_price===null?"очаква се":new Intl.NumberFormat("bg-BG",{style:"currency",currency:lot.price_currency}).format(lot.starting_price)}</p>
    <button type="button" disabled={busy} onClick={()=>void save()} style={{padding:"14px 18px",background:"#ca2635",color:"#fff",border:0,cursor:"pointer"}}>{busy?"Записване…":"☆ Запази в профила"}</button>
    {message&&<p role="status">{message}</p>}</div></>:
  <div className="eaVehicleNotice" role="status"><h2>Проверка на автомобил</h2><p>{message}</p></div>}
  <div className="eaVehicleActions"><a href="/vehicles">Всички автомобили ↗</a><a href="/profile">Моят профил ↗</a><a href="/auctions">Търгове ↗</a></div>
 </div></main>;
}
