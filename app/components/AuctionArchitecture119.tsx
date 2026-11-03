"use client";
import {useState} from "react";
import architecture from "../data/urgent-auction-architecture-119-v1.json";
import "./urgent-auction-architecture.css";

export default function AuctionArchitecture119({onOpenTask}:{onOpenTask:(id:string)=>void}){
 const [week,setWeek]=useState(1);
 const [query,setQuery]=useState("");
 const [expanded,setExpanded]=useState(false);
 const stage=architecture.stages[week-1];
 const q=query.trim().toLocaleLowerCase("bg-BG");
 const days=architecture.days.filter(d=>d.week===week&&(!q||[d.id,d.title,d.goal,...d.domainEntities,...d.feeCodes,...d.documentCodes,...d.featureIds].join(" ").toLocaleLowerCase("bg-BG").includes(q)));
 return <section className="arch119" id="architecture-119" aria-label="Аукционна архитектура за 119 дни">
  <header className="arch119Header"><div><span>02 / СИСТЕМНА АРХИТЕКТУРА · ПЛАН ЗА РАЗРАБОТКА</span><h2>119 дни · <em>17 технически етапа</em></h2>
   <p>Регистрация → автомобили → каталог → наддаване → победител → такси → документи → плащания → транспорт.</p></div><strong>СОБСТВЕНА E&A АРХИТЕКТУРА</strong></header>
  <p className="arch119Caution"><b>Това е проектна спецификация, не сертификат за внедряване.</b> Показаните модели/API са целеви и се изграждат поетапно. Вътрешната инфраструктура на конкурентните оператори не е известна. Реални средства и аукциони се разрешават само след юридически, финансов и технически GO.</p>
  <details className="arch119Flow"><summary>Покажи цялата системна архитектура и границите на доверие</summary>
   <p>Web/PWA → Identity & Policy → Auction Command → PostgreSQL (единствен авторитет за bid/winner) → Transactional Outbox → Worker → Redis/WebSocket → Web/PWA.</p>
   <p>Seller Intake → Protected Document Vault → Verified Lot → Auction → Fee Rule Snapshot → Invoice → PSP/Bank Reconciliation → Double-entry Ledger → Release Gate → Yard/Transport → Seller Settlement.</p>
   <div className="arch119Graph">{architecture.graph.map((g,i)=><div key={i}><code>{g.from} → {g.to}</code><span>{g.rule}</span></div>)}</div>
  </details>
  <div className="arch119Toolbar"><label>Етап / седмица<select value={week} onChange={e=>{setWeek(Number(e.target.value));setQuery("");}}>{architecture.stages.map(s=><option value={s.week} key={s.id}>W{String(s.week).padStart(2,"0")} · {s.name}</option>)}</select></label>
   <label>Търсене<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="D057, bid, fee, документ..." /></label>
   <button type="button" onClick={()=>setExpanded(!expanded)}>{expanded?"Скрий техническото":"Покажи всички интерфейси"}</button></div>
  <div className="arch119Stage"><div><small>{stage.id} · ЕТАП {stage.week}/17</small><h3>{stage.name}</h3><p>{stage.domain} · {stage.components.join(", ")}</p></div><p><b>Гейт на етапа:</b> {stage.exitGate}</p></div>
  <div className="arch119Days">
   {days.map(day=><article className="arch119Day" key={day.id}><div className="arch119DayHead"><strong>{day.id} · {day.date}</strong><b>{day.title}</b><button type="button" onClick={()=>onOpenTask(day.id)}>Отвори деня</button></div>
    <p><b>Архитектурна цел:</b> {day.goal}</p>
    <p><b>Критерий и доказателство:</b> {day.testPlan.artifact}</p>
    {expanded&&<div className="arch119Tech"><p><b>Зависимост:</b> {day.dependencyIds.join(", ")||"първи одит"}</p><p><b>Компоненти:</b> {day.targetComponents.join(", ")}</p><p><b>Данни:</b> {day.domainEntities.join(", ")}</p><p><b>API/контракт:</b> {day.interfaceContracts.join("; ")}</p><p><b>Негативен тест:</b> {day.testPlan.negative}</p>
     <p><b>Пазарни изисквания:</b> {day.featureIds.join(", ")||"—"} · <b>Такси:</b> {day.feeCodes.join(", ")||"—"} · <b>Документи:</b> {day.documentCodes.join(", ")||"—"}</p>
     {day.signatureGates.length>0&&<p className="arch119Gate">ПОДПИС: {day.signatureGates.map(g=>g.owner+" · "+g.subject).join("; ")}</p>}</div>}
   </article>)}
   {days.length===0&&<p>Няма резултати в този етап.</p>}
  </div>
  <p className="arch119Foot">119 непроменени дни · 17 архитектурни фази · {architecture.scopeSummary.features} функции · {architecture.scopeSummary.fees} вида такси · {architecture.scopeSummary.documents} документни потока · {architecture.scopeSummary.signatureGates} управленски гейта. Нищо не става автоматично PASS.</p>
 </section>;
}
