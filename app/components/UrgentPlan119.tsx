"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import plan from "../data/urgent-119-days.json";
import legalCatalog from "../data/urgent-legal-foundation-v1.json";
import LegalFoundationCenter from "./LegalFoundationCenter";
import DailyQuestions119 from "./DailyQuestions119";
import "./urgent-plan-119.css";

type Status="planned"|"working"|"blocked"|"done";
type Test="none"|"pass"|"fail";
type Task={id:string;date:string;weekday:string;week:number;stream:string;priority:string;owner:string;plannedHours:number;title:string;passCriteria:string;dependency:string};
type Entry={status:Status;test:Test;evidence:string;notes:string;actualHours:number;updatedAt:string};
type EntryMap=Record<string,Entry>;
type Filter="week"|"all"|"overdue"|"blocked"|"done";
const tasks=plan.tasks as Task[];
const legalByDay=legalCatalog.requirements.reduce<Record<string,string[]>>((out,r)=>{(out[r.linkedDay]??=[]).push(r.id);return out;},{});
const STORAGE="enchev-urgent-119-v1";
const base:Entry={status:"planned",test:"none",evidence:"",notes:"",actualHours:0,updatedAt:""};
const statusLabels:Record<Status,string>={planned:"Планирано",working:"В работа",blocked:"Блокирано",done:"Прието"};
const fmt=(date:string)=>new Intl.DateTimeFormat("bg-BG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
function dayInSofia(n:number){return n?new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Sofia",year:"numeric",month:"2-digit",day:"2-digit"}).format(n):plan.startsOn;}
function clean(data:unknown):EntryMap {
  if(!data||typeof data!=="object"||Array.isArray(data))return {};
  const out:EntryMap={}, source=data as Record<string,unknown>;
  for(const task of tasks){
    const x=source[task.id];if(!x||typeof x!=="object"||Array.isArray(x))continue;
    const v=x as Record<string,unknown>;
    let status=(["planned","working","blocked","done"].includes(String(v.status))?v.status:"planned") as Status;
    const test=(["none","pass","fail"].includes(String(v.test))?v.test:"none") as Test;
    const evidence=typeof v.evidence==="string"?v.evidence.slice(0,4000):"";
    const notes=typeof v.notes==="string"?v.notes.slice(0,2000):"";
    const hrs=Number(v.actualHours);
    if(status==="done"&&(test!=="pass"||!evidence.trim()))status="working";
    out[task.id]={status,test,evidence,notes,actualHours:Number.isFinite(hrs)?Math.max(0,Math.min(200,hrs)):0,updatedAt:typeof v.updatedAt==="string"?v.updatedAt.slice(0,40):""};
  }
  return out;
}
function download(content:string,name:string,type:string){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement("a");link.href=url;link.download=name;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function csv(v:unknown){return '"'+String(v??"").replaceAll('"','""')+'"';}

export default function UrgentPlan119({onClose,onOpenMaster}:{onClose:()=>void;onOpenMaster:()=>void}){
  const [entries,setEntries]=useState<EntryMap>({});
  const [loaded,setLoaded]=useState(false);
  const [now,setNow]=useState(0);
  const [filter,setFilter]=useState<Filter>("week");
  const [chosenWeek,setChosenWeek]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [notice,setNotice]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    try{setEntries(clean(JSON.parse(localStorage.getItem(STORAGE)||"{}")))}catch{setEntries({})}
    setLoaded(true);setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    const storage=(e:StorageEvent)=>{if(e.key===STORAGE){try{setEntries(clean(JSON.parse(e.newValue||"{}")))}catch{}}};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};
    window.addEventListener("storage",storage);window.addEventListener("keydown",key);
    return()=>{clearInterval(timer);window.removeEventListener("storage",storage);window.removeEventListener("keydown",key)};
  },[onClose]);
  useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE,JSON.stringify(entries))}catch{setNotice("Съхранението не е достъпно. Експортирай отчета.")}}},[entries,loaded]);
  const today=dayInSofia(now),active=tasks.find(t=>t.date===today)||tasks.find(t=>t.date>today)||tasks[tasks.length-1];
  const week=chosenWeek??active.week;
  const leftMs=now?Math.max(0,Date.parse(plan.deadline)-now):0;
  const leftH=now?Math.floor(leftMs/3600000):null,leftMin=now?Math.floor(leftMs%3600000/60000):null;
  const accepted=(id:string)=>entries[id]?.status==="done"&&entries[id]?.test==="pass"&&Boolean(entries[id]?.evidence.trim());
  const done=tasks.filter(t=>accepted(t.id)).length;
  const blocked=tasks.filter(t=>entries[t.id]?.status==="blocked").length;
  const late=tasks.filter(t=>t.date<today&&!accepted(t.id)).length;
  const remainingWork=tasks.filter(t=>!accepted(t.id)).reduce((n,t)=>n+t.plannedHours,0);
  const spent=tasks.reduce((n,t)=>n+(entries[t.id]?.actualHours||0),0);
  const pct=Math.round(done/tasks.length*100);
  const weeks=useMemo(()=>{
    const m=new Map<number,Task[]>();
    tasks.forEach(t=>m.set(t.week,[...(m.get(t.week)||[]),t]));
    return [...m].map(([number,items])=>({number,items,start:items[0].date,end:items[items.length-1].date,done:items.filter(t=>accepted(t.id)).length}));
  },[entries]);
  const visible=tasks.filter(t=>{
    if(filter==="week"&&t.week!==week)return false;
    if(filter==="overdue"&&!(t.date<today&&!accepted(t.id)))return false;
    if(filter==="blocked"&&entries[t.id]?.status!=="blocked")return false;
    if(filter==="done"&&!accepted(t.id))return false;
    const q=search.trim().toLowerCase();
    return !q||(t.id+" "+t.date+" "+t.title+" "+t.owner+" "+t.stream+" "+t.passCriteria+" "+t.dependency).toLowerCase().includes(q);
  });
  function change(id:string,patch:Partial<Entry>){
    setEntries(prev=>{
      const next={...(prev[id]||base),...patch,updatedAt:new Date().toISOString()};
      if(next.status==="done"&&(next.test!=="pass"||!next.evidence.trim()))next.status="working";
      return {...prev,[id]:next};
    });
  }
  function changeStatus(id:string,status:Status){
    if(status==="done"&&(entries[id]?.test!=="pass"||!entries[id]?.evidence.trim())){setNotice(id+": за приемане са задължителни PASS и доказателство.");return;}
    setNotice("");change(id,{status});
  }
  function exportJson(){download(JSON.stringify({schemaVersion:1,plan:"ENCHEV_119_DAY",exportedAt:new Date().toISOString(),entries},null,2),"enchev-119-progress.json","application/json;charset=utf-8");}
  function exportCsv(){
    const cols=["ID","Дата","Седмица","Отговорник","Задача","Критерий PASS","Статус","Тест","Доказателство","План часове","Реални часове","Блокер","Обновено"];
    const rows=tasks.map(t=>{const e=entries[t.id]||base;return [t.id,t.date,t.week,t.owner,t.title,t.passCriteria,statusLabels[e.status],e.test.toUpperCase(),e.evidence,t.plannedHours,e.actualHours,e.notes,e.updatedAt].map(csv).join(",")});
    download("\uFEFF"+[cols.map(csv).join(","),...rows].join("\r\n"),"enchev-119-report.csv","text/csv;charset=utf-8");
  }
  async function importJson(file?:File){
    if(!file)return;
    try{
      if(file.size>1000000)throw Error("size");
      const obj=JSON.parse(await file.text());
      if(obj.schemaVersion!==1||obj.plan!=="ENCHEV_119_DAY")throw Error("format");
      setEntries(clean(obj.entries));setNotice("Импортът е успешен. Данните се пазят в този браузър.");
    }catch{setNotice("Невалиден архив. Нужен е експортиран ENCHEV_119_DAY JSON файл.");}
    if(fileRef.current)fileRef.current.value="";
  }
  return <section className="urgentOverlay" role="dialog" aria-modal="true" aria-label="Спешен план до първи март">
    <header className="urgentHeader"><div><span className="urgentEyebrow">ENCHEV AUCTIONS · ПРИОРИТЕТ №1</span><h1>СПЕШЕН ПЛАН <em>119 ДНИ</em></h1><p>03.11.2026 — 01.03.2027 · 17 седмици · преди MASTER PLAN</p></div>
      <div className="urgentHeaderActions"><button type="button" onClick={()=>window.location.assign("/auction-readiness")}>D001 · ПРОВЕРКА НА ОСНОВАТА ↗</button><button type="button" onClick={onOpenMaster}>MASTER PLAN →</button><button type="button" className="urgentClose" aria-label="Затвори" onClick={onClose}>×</button></div>
    </header>
    <div className="urgentHero"><div className="urgentClock"><span>ОСТАВАЩО ВРЕМЕ ДО 1 МАРТ · 09:00 СОФИЯ</span>
      <strong>{leftH===null?"—":leftH.toLocaleString("bg-BG")} <small>часа</small> {leftMin===null?"":String(leftMin).padStart(2,"0")} <small>мин</small></strong>
      <p>Обновява се всяка секунда · Europe/Sofia (EET)</p></div>
      <div className="urgentToday"><span>ТЕКУЩА ЗАДАЧА</span><b>{active.id} · {fmt(active.date)}</b><p>{active.title}</p>
        <button type="button" onClick={()=>{setFilter("week");setChosenWeek(active.week);document.getElementById("urgent-tasks")?.scrollIntoView({behavior:"smooth"})}}>Отвори деня ↓</button></div></div>
    <div className="urgentMetrics">
      <div><span>ПРИЕТИ ЗАДАЧИ</span><b>{done}<small> / 119</small></b></div>
      <div><span>ИЗПЪЛНЕНИЕ</span><b>{pct}%</b></div>
      <div><span>ОСТАВАЩА ПЛАНОВА РАБОТА</span><b>{remainingWork}<small> екипни ч.</small></b></div>
      <div><span>ОТЧЕТЕНИ ЧАСОВЕ</span><b>{spent.toLocaleString("bg-BG")}<small> ч.</small></b></div>
      <div><span>ПРОСРОЧЕНИ / БЛОКИРАНИ</span><b>{late}<small> / {blocked}</small></b></div>
    </div><div className="urgentProgress" role="progressbar" aria-label="Приети задачи" aria-valuenow={done} aria-valuemin={0} aria-valuemax={119}><i style={{width:pct+"%"}}/></div>
    <div className="urgentAudit"><b>ОДИТ КЪМ 02.11.2026</b><p>WEB/API HTTP 200 · Realtime/Worker/Redis HTTP 503 · Auth unavailable · MASTER: 308 GREEN / 6 YELLOW · Closed Demo: 35 RED.</p><small>Проверена моментна снимка, не live мониторинг. Ръчният PASS в този панел не е независима CI сертификация.</small></div>
    <DailyQuestions119 today={today} onOpenTask={(dayId)=>{const day=tasks.find(t=>t.id===dayId);if(!day)return;setFilter("week");setChosenWeek(day.week);window.setTimeout(()=>{const element=document.getElementById("urgent-task-"+dayId) as HTMLDetailsElement|null;if(element){element.open=true;element.scrollIntoView({behavior:"smooth",block:"center"});}},120);}} />
    <LegalFoundationCenter />
    <div className="urgentTitle"><div><small>01 / СЕДМИЦИ</small><h2>17 контролни периода</h2></div><p>Избери седмица и провери всеки ден.</p></div>
    <nav className="urgentWeeks" aria-label="Седмици">{weeks.map(w=><button type="button" key={w.number} className={filter==="week"&&week===w.number?"active":""} onClick={()=>{setFilter("week");setChosenWeek(w.number)}}>
      <span>W{String(w.number).padStart(2,"0")}</span><b>{w.done}/{w.items.length}</b><small>{w.start.slice(5)} – {w.end.slice(5)}</small><i style={{width:Math.round(w.done/w.items.length*100)+"%"}}/></button>)}</nav>
    <div className="urgentTitle" id="urgent-tasks"><div><small>02 / ДНЕВНИ ЗАДАЧИ</small><h2>Задача · тест · доказателство</h2></div><p>Приема се само след PASS и записано доказателство.</p></div>
    <div className="urgentToolbar"><div className="urgentFilters">{([["week","Седмица"],["all","Всички 119"],["overdue","Просрочени"],["blocked","Блокирани"],["done","Приети"]] as const).map(([k,label])=><button type="button" key={k} onClick={()=>setFilter(k)} className={filter===k?"active":""}>{label}</button>)}</div>
      <input aria-label="Търси задачи" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Търси задача, тест, отговорник, дата..."/></div>
    <p className="urgentCount">Показани {visible.length} от 119 · Седмица {week}</p>
    <div className="urgentList">{visible.length===0&&<div className="urgentEmpty">Няма задачи в избрания филтър.</div>}
      {visible.map(task=>{const entry=entries[task.id]||base,overdue=task.date<today&&!accepted(task.id);
        return <details id={"urgent-task-"+task.id} className={"urgentTask urgent-"+entry.status} key={task.id}>
          <summary><span className="urgentDate"><strong>{task.id}</strong><b>{fmt(task.date)}</b><small>{task.weekday} · W{task.week}</small></span>
            <span className="urgentTaskName"><b>{task.title}</b><small>{task.owner} · {task.plannedHours} ч. · {task.priority}</small></span>
            <span className={"urgentPill urgentPill-"+entry.status}>{statusLabels[entry.status]}{overdue?" · ПРОСРОЧЕНО":""}</span><span>⌄</span></summary>
          <div className="urgentTaskBody"><div className="urgentDetails"><span>ПОТОК</span><b>{task.stream}</b><span>ЗАВИСИМОСТ</span><b>{task.dependency||"Начална задача"}</b>{legalByDay[task.id]?.length>0&&<><span>LEGAL ОСНОВА</span><b>{legalByDay[task.id].join(", ")} · проверките са в LEGAL & COMPLIANCE по-горе</b></>}</div>
            <div className="urgentTest"><small>КРИТЕРИЙ ЗА ПРИЕМАНЕ / ТЕСТ</small><p>{task.passCriteria}</p></div>
            <div className="urgentInputs">
              <label>Статус<select value={entry.status} onChange={e=>changeStatus(task.id,e.target.value as Status)}><option value="planned">Планирано</option><option value="working">В работа</option><option value="blocked">Блокирано</option><option value="done">Прието</option></select></label>
              <label>Тест<select value={entry.test} onChange={e=>change(task.id,{test:e.target.value as Test})}><option value="none">НЕ Е ТЕСТВАНО</option><option value="pass">PASS</option><option value="fail">FAIL</option></select></label>
              <label>Вложени екипни часове<input type="number" min={0} max={200} step={0.5} value={entry.actualHours} onChange={e=>change(task.id,{actualHours:Math.max(0,Math.min(200,Number(e.target.value)||0))})}/></label>
              <label className="urgentWide">Доказателство · CI run / commit / URL / видео<input value={entry.evidence} maxLength={4000} onChange={e=>change(task.id,{evidence:e.target.value})} placeholder="Проверим идентификатор или линк"/></label>
              <label className="urgentWide">Блокер / резултат / следваща стъпка<textarea rows={2} maxLength={2000} value={entry.notes} onChange={e=>change(task.id,{notes:e.target.value})} placeholder="Добави детайли по задачата"/></label>
            </div><div className="urgentTaskEnd"><small>Обновено: {entry.updatedAt?new Date(entry.updatedAt).toLocaleString("bg-BG",{timeZone:"Europe/Sofia"}):"Няма запис"}</small><button type="button" disabled={accepted(task.id)} onClick={()=>changeStatus(task.id,"done")}>{accepted(task.id)?"✓ Прието":"Приеми след PASS"}</button></div>
          </div>
        </details>})}</div>
    <footer className="urgentFooter"><div><b>ЗАДЪЛЖИТЕЛНИ ПРАВИЛА</b><p>Без PASS и доказателство няма статус „Прието“. Неприетите изминали дни остават просрочени. Този изпълнителен график е отделен от замразения MASTER PLAN с 4 374 точки.</p><p>Записването засега е <strong>само в този браузър</strong>. За пренос между устройства използвай JSON архив. Облачна синхронизация изисква защитен администраторски вход.</p></div>
      <div className="urgentExport"><button type="button" onClick={exportCsv}>CSV отчет</button><button type="button" onClick={exportJson}>JSON архив</button><button type="button" onClick={()=>fileRef.current?.click()}>Импорт JSON</button><input type="file" hidden ref={fileRef} accept=".json,application/json" onChange={e=>void importJson(e.target.files?.[0])}/></div></footer>
    {notice&&<div className="urgentNotice" role="status"><span>{notice}</span><button type="button" aria-label="Затвори известието" onClick={()=>setNotice("")}>×</button></div>}
  </section>;
}
