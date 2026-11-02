"use client";
import { useEffect, useMemo, useState } from "react";
import catalog from "../data/urgent-legal-foundation-v1.json";
import "./urgent-legal-foundation.css";

type DecisionStatus = "unresolved"|"design"|"lawyer_review"|"approved"|"blocked"|"not_applicable";
type RecordEntry={status:DecisionStatus;owner:string;reviewer:string;decision:string;evidence:string;testEvidence:string;updatedAt:string};
type Store=Record<string,RecordEntry>;
type Requirement=(typeof catalog.requirements)[number];
type Filter="all"|"p0"|"pending"|"blocked"|"approved";
const KEY="enchev-urgent-legal-foundation-v1";
const DEFAULT:DecisionStatus="unresolved";
const LABEL:Record<DecisionStatus,string>={
 unresolved:"За решение",design:"Проектиране",lawyer_review:"Правен/финансов преглед",approved:"Потвърдено",blocked:"Блокирано",not_applicable:"Неприложимо (обосновано)"
};
const accept=(v?:RecordEntry)=>Boolean(v&&(v.status==="approved"||v.status==="not_applicable")&&v.evidence.trim()&&v.reviewer.trim()&&v.decision.trim()&&(v.status==="not_applicable"||v.testEvidence.trim()));
function sanitize(raw:unknown):Store{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
 const data=raw as Record<string,unknown>, cleaned:Store={};
 for(const req of catalog.requirements){
  const value=data[req.id];if(!value||typeof value!=="object"||Array.isArray(value))continue;
  const v=value as Record<string,unknown>;
  const status:DecisionStatus=Object.keys(LABEL).includes(String(v.status))?v.status as DecisionStatus:DEFAULT;
  const text=(k:string,max=2500)=>typeof v[k]==="string"?String(v[k]).slice(0,max):"";
  cleaned[req.id]={status,owner:text("owner",140),reviewer:text("reviewer",140),decision:text("decision"),evidence:text("evidence"),testEvidence:text("testEvidence"),updatedAt:text("updatedAt",40)};
  if((status==="approved"||status==="not_applicable")&&!accept(cleaned[req.id]))cleaned[req.id].status="lawyer_review";
 }
 return cleaned;
}
function download(body:string,name:string,type:string){
 const url=URL.createObjectURL(new Blob([body],{type}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
const val=(x:unknown)=>'"'+String(x??"").replaceAll('"','""')+'"';

export default function LegalFoundationCenter(){
 const [items,setItems]=useState<Store>({});
 const [ready,setReady]=useState(false);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<Filter>("all");
 const [section,setSection]=useState<number>(0);
 const [expanded,setExpanded]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const focus=(event:Event)=>{
   const id=(event as CustomEvent<{id?:string}>).detail?.id;
   if(typeof id!=="string"||!catalog.requirements.some(r=>r.id===id))return;
   setSection(0);setFilter("all");setSearch(id);setExpanded(true);
   window.setTimeout(()=>document.getElementById("legal-requirements")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
  };
  window.addEventListener("enchev-legal-focus",focus);
  return()=>window.removeEventListener("enchev-legal-focus",focus);
 },[]);
 useEffect(()=>{
  try{setItems(sanitize(JSON.parse(localStorage.getItem(KEY)||"{}")));}catch{setItems({});}
  setReady(true);
 },[]);
 useEffect(()=>{
  if(!ready)return;
  try{localStorage.setItem(KEY,JSON.stringify(items));}catch{setNotice("Локалното съхранение е недостъпно. Експортирай отчета.")}
 },[items,ready]);
 const done=catalog.requirements.filter(x=>accept(items[x.id])).length;
 const p0=catalog.requirements.filter(x=>x.priority==="P0");
 const missingP0=p0.filter(x=>!accept(items[x.id])).length;
 const denied=catalog.requirements.filter(x=>items[x.id]?.status==="blocked").length;
 const gates=catalog.launchGates.map(g=>({...g,missing:g.items.filter(id=>!accept(items[id])).length}));
 const pendingGates=gates.filter(g=>g.missing>0).length;
 const sections=useMemo(()=>catalog.requirements.reduce((map,x)=>{
  const k=x.category; if(!map.find(y=>y.number===k))map.push({number:k,label:x.section,count:0});
  map.find(y=>y.number===k)!.count++;return map;
 },[] as {number:number;label:string;count:number}[]),[]);
 const selected=catalog.requirements.filter(x=>{
  if(section&&x.category!==section)return false;
  if(filter==="p0"&&x.priority!=="P0")return false;
  if(filter==="pending"&&accept(items[x.id]))return false;
  if(filter==="blocked"&&items[x.id]?.status!=="blocked")return false;
  if(filter==="approved"&&!accept(items[x.id]))return false;
  const q=search.toLocaleLowerCase("bg-BG").trim();
  return !q||[x.id,x.title,x.section,x.reason,x.implementation,x.question,x.linkedDay].some(k=>String(k).toLocaleLowerCase("bg-BG").includes(q));
 });
 function patch(id:string,data:Partial<RecordEntry>){
  setItems(prev=>{
   const r=catalog.requirements.find(x=>x.id===id);
   if(!r)return prev;
   const current=prev[id]||{status:DEFAULT,owner:r.owner,reviewer:"",decision:"",evidence:"",testEvidence:"",updatedAt:""};
   const next={...current,...data,updatedAt:new Date().toISOString()};
   if((next.status==="approved"||next.status==="not_applicable")&&!accept(next)){
    next.status="lawyer_review";
    setNotice(id+": за потвърждение попълни решение, проверяващ, доказателство и тест (за неприложимост тест не се изисква).");
   }
   return {...prev,[id]:next};
  });
 }
 function exportJson(){
  download(JSON.stringify({schemaVersion:1,plan:"ENCHEV_LEGAL_163",exportedAt:new Date().toISOString(),items},null,2),"enchev-legal-163-progress.json","application/json;charset=utf-8");
 }
 function exportCsv(){
  const keys=["ID","Раздел","Изискване","Приоритет","Ден","Краен срок","Отговорник","Статус","Решение","Проверяващ","Правно основание/файл","Тест","Защо","В системата","Критерий"];
  const rows=catalog.requirements.map(r=>{
   const e=items[r.id];return [r.id,r.section,r.title,r.priority,r.linkedDay,r.dueDate,e?.owner||r.owner,e?.status||DEFAULT,e?.decision,e?.reviewer,e?.evidence,e?.testEvidence,r.reason,r.implementation,r.acceptance].map(val).join(",");
  });
  download("\ufeff"+[keys.map(val).join(","),...rows].join("\r\n"),"enchev-legal-163.csv","text/csv;charset=utf-8");
 }
 async function importJson(file?:File){
  if(!file)return;
  try{
   if(file.size>1_000_000)throw Error("Too large");
   const data=JSON.parse(await file.text());
   if(data.schemaVersion!==1||data.plan!=="ENCHEV_LEGAL_163")throw Error("Wrong format");
   setItems(sanitize(data.items));setNotice("Архивът е внесен. Записва се локално в този браузър.");
  }catch{setNotice("Невалиден файл или неправилен формат ENCHEV_LEGAL_163.")}
 }
 return <section className="legalFoundation" id="legal-foundation" aria-label="Правна основа на спешния план">
  <header className="legalFoundationHeader">
   <div><small>00 / ПЪРВО ОСНОВАТА · ПРЕДИ РЕАЛНИ СДЕЛКИ</small><h2>⚖️ LEGAL & COMPLIANCE</h2>
    <p>163 правни, финансови, оперативни и технически решения, свързани с 119-дневния Спешен план. Начално състояние: <b>нищо не е потвърдено</b>.</p>
   </div><div className="legalFoundationTools">
    <button type="button" onClick={exportCsv}>CSV отчет</button>
    <button type="button" onClick={exportJson}>JSON архив</button>
    <label className="legalImport">Импорт JSON<input type="file" accept=".json,application/json" onChange={e=>void importJson(e.target.files?.[0])}/></label>
   </div>
  </header>
  <div className="legalImportant">
   <strong>НЕ Е ЮРИДИЧЕСКО ОДОБРЕНИЕ И НЕ Е АКТИВЕН ПЛАТЕЖЕН КОНТРОЛ</strong>
   <p>Този панел е работен регистър. Одобрение в него се въвежда ръчно и не означава, че адвокат или CI действително са проверили действието. Не въвеждайте лични документи, пароли или банкови данни тук. Реални сделки не се активират само чрез отметките.</p>
  </div>
  <div className="legalStats">
   <div><span>ВСИЧКИ ТОЧКИ</span><b>163</b><small>12 тематични раздела</small></div>
   <div><span>С ДОКАЗАТЕЛСТВА В РЕГИСТЪРА</span><b>{done}<small> / 163</small></b><small>локално декларирани</small></div>
   <div><span>НЕПРИЕТИ P0 ТОЧКИ</span><b>{missingP0}</b><small>от {p0.length} критични</small></div>
   <div><span>НЕПОТВЪРДЕНИ GATES</span><b>{pendingGates}<small> / {gates.length}</small></b><small>готовност за старт</small></div>
   <div><span>БЛОКИРАНИ</span><b>{denied}</b><small>изискват действие</small></div>
  </div>
  <div className="legalGateTitle"><div><small>КРИТИЧЕН ПЪТ / GO-NO-GO</small><h3>Нищо с реални пари, преди да е доказано</h3></div></div>
  <div className="legalGates">{gates.map(g=><div className={"legalGate "+(g.missing?"legalGatePending":"legalGateReady")} key={g.id}><span>{g.id} · {g.missing?"НЕПОТВЪРДЕНО":"ДОКУМЕНТИРАНО"}</span><b>{g.label}</b><small>{g.missing} неприети от {g.items.length} · {g.owner}</small></div>)}</div>
  <div className="legalQuickActions">
   <p><strong>Първите пет решения:</strong> бизнес модел и действителен продавач; потребителски права; документи на продавача/колата; паричен поток; нотариус и прехвърляне. Задачите им са означени с LEG и са вързани към съответните дни D008–D084.</p>
   <button type="button" onClick={()=>{setFilter("p0");setSection(1);setExpanded(true);document.getElementById("legal-requirements")?.scrollIntoView({behavior:"smooth",block:"start"})}}>Започни с бизнес модела ↓</button>
  </div>
  <div className="legalRequirementsTop" id="legal-requirements">
   <div><small>ПЪЛЕН РЕГИСТЪР / 163 ТОЧКИ</small><h3>Какво, защо, решение, тест и срок</h3></div>
   <button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?"Скрийте детайлите":"Покажи подробностите"}</button>
  </div>
  <div className="legalSelects">
   <label>Раздел<select value={section} onChange={e=>setSection(Number(e.target.value))}><option value={0}>Всички 12 раздела</option>{sections.map(s=><option key={s.number} value={s.number}>{s.number}. {s.label} ({s.count})</option>)}</select></label>
   <label>Статус<select value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">Всички</option><option value="p0">Критични P0</option><option value="pending">Неприети</option><option value="blocked">Блокирани</option><option value="approved">Потвърдени</option></select></label>
   <label>Търсене<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Нотариус, DAC7, ДДС, LEG-071..."/></label>
  </div>
  <div className="legalCount">{selected.length} от 163 · Данните се пазят само локално в браузъра · Използвайте JSON архив за прехвърляне</div>
  <div className="legalRows">{selected.map((r:Requirement)=>{
   const e=items[r.id]||{status:DEFAULT,owner:r.owner,reviewer:"",decision:"",evidence:"",testEvidence:"",updatedAt:""};
   return <details className={"legalRow "+(accept(e)?"legalRowDone":"")} key={r.id} open={expanded}>
    <summary><span className="legalRowId">{r.id}</span><span className="legalRowLabel"><b>{r.title}</b><small>{r.section} · {r.linkedDay} · срок {r.dueDate} · {r.owner}</small></span><span className={"legalRowPriority "+(r.priority==="P0"?"legalP0":"")}>{r.priority}</span><span className="legalRowStatus">{LABEL[e.status]}</span></summary>
    <div className="legalRowBody">
     <div className="legalQuestion"><strong>КАКВО РЕШАВАМЕ</strong><p>{r.question}</p></div>
     <div className="legalExplain"><div><strong>ЗАЩО Е НЕОБХОДИМО</strong><p>{r.reason}</p></div><div><strong>КАКВО ИЗГРАЖДАМЕ В СИСТЕМАТА</strong><p>{r.implementation}</p></div></div>
     <div className="legalAcceptance"><strong>ТЕСТ / КРИТЕРИЙ ЗА ПРИЕМАНЕ</strong><p>{r.acceptance}</p><small>{r.applicability} · Свързан ден {r.linkedDay}</small></div>
     <div className="legalEdit">
      <label>Статус<select value={e.status} onChange={a=>patch(r.id,{status:a.target.value as DecisionStatus})}>{Object.entries(LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Отговорник<input value={e.owner} onChange={a=>patch(r.id,{owner:a.target.value.slice(0,140)})}/></label>
      <label>Проверяващ / адвокат / счетоводител<input value={e.reviewer} onChange={a=>patch(r.id,{reviewer:a.target.value.slice(0,140)})} placeholder="Кой прие?"/></label>
      <label className="legalWide">Решение / приложимост<textarea rows={2} value={e.decision} onChange={a=>patch(r.id,{decision:a.target.value.slice(0,2500)})} placeholder="Какъв е приетият модел и защо?"/></label>
      <label className="legalWide">Доказателство / документ / становище<input value={e.evidence} onChange={a=>patch(r.id,{evidence:a.target.value.slice(0,2500)})} placeholder="Линк / номер на документ, без лични данни"/></label>
      <label className="legalWide">Резултат от тест / CI / проверка<input value={e.testEvidence} onChange={a=>patch(r.id,{testEvidence:a.target.value.slice(0,2500)})} placeholder="Test ID, commit, протокол, PASS/FAIL"/></label>
     </div>
     <div className="legalRowBottom"><span>{e.updatedAt?"Актуализирано: "+new Date(e.updatedAt).toLocaleString("bg-BG"):"Очаква решение и доказателства"}</span><strong>{accept(e)?"✓ Декларирано с доказателства":"Не е потвърдено"}</strong></div>
    </div>
   </details>;
  })}</div>
  <footer className="legalSources"><b>Официални референтни източници (не заместват индивидуалната правна проверка):</b><div>{catalog.sources.map(s=><a href={s.url} target="_blank" rel="noopener noreferrer" key={s.url}>{s.title}</a>)}</div></footer>
  {notice&&<div className="legalToast" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}
 </section>;
}
