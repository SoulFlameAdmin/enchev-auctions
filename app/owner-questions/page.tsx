"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {enchevQuestions,interviewTopics} from "./questions";
import "./questions.css";

type Status="new"|"asked"|"answered"|"approved";
type Answer={status:Status;answer:string;owner:string;nextStep:string;due:string;updatedAt:string};
type Entries=Record<string,Answer>;
const STORAGE="enchev-owner-interview-v1";
const defaults:Answer={status:"new",answer:"",owner:"",nextStep:"",due:"",updatedAt:""};
const statusNames:Record<Status,string>={new:"За задаване",asked:"Зададен",answered:"Получен отговор",approved:"Писмено решение"};
const validIds=new Set(enchevQuestions.map(q=>q.id));
function sanitize(raw:unknown):Entries{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
  const out:Entries={};
  for(const [id,val] of Object.entries(raw)){
    if(!validIds.has(id)||!val||typeof val!=="object"||Array.isArray(val))continue;
    const x=val as Record<string,unknown>;
    const status=(["new","asked","answered","approved"].includes(String(x.status))?x.status:"new") as Status;
    const answer=typeof x.answer==="string"?x.answer.slice(0,4000):"";
    out[id]={status:status==="approved"&&!answer.trim()?"asked":status,answer,
      owner:typeof x.owner==="string"?x.owner.slice(0,150):"",
      nextStep:typeof x.nextStep==="string"?x.nextStep.slice(0,1000):"",
      due:typeof x.due==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x.due)?x.due:"",
      updatedAt:typeof x.updatedAt==="string"?x.updatedAt.slice(0,40):""};
  }
  return out;
}
function saveDownload(body:string,filename:string,mime:string){
  const url=URL.createObjectURL(new Blob([body],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
const csv=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"';

export default function OwnerQuestions(){
  const [ready,setReady]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [configured,setConfigured]=useState(false);
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [entries,setEntries]=useState<Entries>({});
  const [loaded,setLoaded]=useState(false);
  const [topic,setTopic]=useState("all");
  const [status,setStatus]=useState("all");
  const [priorityOnly,setPriorityOnly]=useState(false);
  const [query,setQuery]=useState("");
  const [notice,setNotice]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    let active=true;
    fetch("/api/ea-early-access/admin/session",{credentials:"same-origin",cache:"no-store"})
      .then(r=>r.json()).then(x=>{if(active){setAuthorized(x.authenticated===true);setConfigured(x.configured===true);}})
      .catch(()=>{if(active)setError("Няма връзка с администраторската услуга.");})
      .finally(()=>{if(active)setReady(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!authorized)return;
    try{setEntries(sanitize(JSON.parse(localStorage.getItem(STORAGE)||"{}")));}catch{setEntries({});}
    setLoaded(true);
  },[authorized]);
  useEffect(()=>{
    if(authorized&&loaded){
      try{localStorage.setItem(STORAGE,JSON.stringify(entries));}
      catch{setNotice("Неуспешно локално съхранение. Експортирай файла.");}
    }
  },[authorized,entries,loaded]);
  async function login(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    try{
      const r=await fetch("/api/ea-early-access/admin/session",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({password})
      });
      const x=await r.json();if(!r.ok||!x.ok)throw Error(x.message||"Невалиден администраторски код.");
      setPassword("");setAuthorized(true);
    }catch(e){setError(e instanceof Error?e.message:"Грешка при вход.");}
    finally{setBusy(false);}
  }
  async function logout(){
    await fetch("/api/ea-early-access/admin/session",{method:"DELETE",credentials:"same-origin"});
    setAuthorized(false);setLoaded(false);setEntries({});
  }
  function change(id:string,patch:Partial<Answer>){
    setEntries(prev=>{
      const next={...defaults,...(prev[id]||{}),...patch,updatedAt:new Date().toISOString()};
      if(next.status==="approved"&&!next.answer.trim()){next.status="answered";setNotice("За писмено решение е нужен записан отговор.");}
      return {...prev,[id]:next};
    });
  }
  const filtered=useMemo(()=>enchevQuestions.filter(q=>
    (topic==="all"||topic===q.topic) &&
    (status==="all"||(entries[q.id]?.status||"new")===status) &&
    (!priorityOnly||q.priority==="P0") &&
    (!query.trim()||[q.text,q.id,q.topic,entries[q.id]?.answer||""].join(" ").toLocaleLowerCase("bg-BG").includes(query.toLocaleLowerCase("bg-BG").trim()))
  ),[topic,status,priorityOnly,query,entries]);
  const stats=useMemo(()=>{
    const counts={new:0,asked:0,answered:0,approved:0};
    for(const q of enchevQuestions)counts[entries[q.id]?.status||"new"]++;
    return counts;
  },[entries]);
  function exportJSON(){
    saveDownload(JSON.stringify({schemaVersion:1,kind:"ENCHEV_OWNER_QUESTIONS",exportedAt:new Date().toISOString(),entries},null,2),
      "enchev-owner-questions-private.json","application/json;charset=utf-8");
  }
  function exportCSV(){
    const header=["ID","Приоритет","Тема","Въпрос","Статус","Отговор","Отговорник","Следваща стъпка","Срок","Обновено"];
    const body=enchevQuestions.map(q=>{const e=entries[q.id]||defaults;return [q.id,q.priority,q.topic,q.text,statusNames[e.status],e.answer,e.owner,e.nextStep,e.due,e.updatedAt].map(csv).join(",");});
    saveDownload("\uFEFF"+[header.map(csv).join(","),...body].join("\r\n"),"enchev-owner-questions-private.csv","text/csv;charset=utf-8");
  }
  async function importJSON(file?:File){
    if(!file)return;
    try{
      if(file.size>2000000)throw Error("Твърде голям файл.");
      const data=JSON.parse(await file.text());
      if(data.kind!=="ENCHEV_OWNER_QUESTIONS"||data.schemaVersion!==1)throw Error("Неподдържан формат.");
      const cleaned=sanitize(data.entries);
      setEntries(cleaned);setNotice("Импортирани са "+Object.keys(cleaned).length+" отговора. Данните са само в този браузър.");
    }catch{setNotice("Грешен JSON архив — няма извършена промяна.");}
    if(fileRef.current)fileRef.current.value="";
  }
  function copyPending(){
    const lines=filtered.filter(q=>["new","asked"].includes(entries[q.id]?.status||"new")).map(q=>q.id+" · "+q.text);
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(lines.join("\n")).then(()=>setNotice("Копирани са "+lines.length+" въпроса.")).catch(()=>setNotice("Копирането не е налично."));
    else setNotice("Копирането не се поддържа. Използвай CSV.");
  }
  return <main id="main-content" className="eqPage">
    <header className="eqHeader">
      <div><span>E&A · INTERNAL DECISION CENTER</span><h1>Въпроси към Енчев</h1><p>Единен дневен ред, отговори, отговорници и решения за цялата аукционна компания.</p></div>
      <Link href="/">← КЪМ COMMAND CENTER</Link>
    </header>
    {!ready?<p className="eqInfo" role="status">Проверка на администраторски достъп…</p>:
     !authorized?<section className="eqLogin"><h2>Само за екипа</h2><p>Въпросите са вътрешна управленска информация. Влез с установения администраторски код за Enchev.</p>
       {!configured&&<p role="alert" className="eqError">Администраторският достъп не е конфигуриран. Свържи го в защитените настройки на Enchev.</p>}
       <form onSubmit={login}><label htmlFor="eqSecret">Административен код</label><input id="eqSecret" type="password" required minLength={32} disabled={!configured} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Въведи кода"/><button disabled={!configured||busy} type="submit">{busy?"Проверка…":"Влез"}</button></form>
       {error&&<p role="alert" className="eqError">{error}</p>}
     </section>:
     <section className="eqWorkspace">
       <div className="eqNotice"><strong>Локално съхранение:</strong> Отговорите се пазят само в този браузър, не се синхронизират между устройствата. За споделяне експортирай защитения файл. Не въвеждай пароли, банкови данни или лични документи.</div>
       <div className="eqStats" aria-label="Статус на въпросите">
         <div><span>ВСИЧКИ</span><b>{enchevQuestions.length}</b></div>
         <div><span>НЕЗАДАДЕНИ</span><b>{stats.new}</b></div>
         <div><span>ЗАДАДЕНИ</span><b>{stats.asked}</b></div>
         <div><span>ОТГОВОРЕНИ</span><b>{stats.answered}</b></div>
         <div><span>ПИСМЕНИ РЕШЕНИЯ</span><b>{stats.approved}</b></div>
       </div>
       <div className="eqToolbar">
         <div className="eqToolGroup">
           <button type="button" onClick={()=>{setPriorityOnly(true);setStatus("new");setTopic("all");}}>⚡ ВАЖНИ ЗА СРЕЩАТА</button>
           <button type="button" onClick={copyPending}>Копирай нерешените</button>
           <button type="button" onClick={exportJSON}>Експорт JSON</button>
           <button type="button" onClick={exportCSV}>Експорт CSV</button>
           <label className="eqUpload">Импорт JSON<input ref={fileRef} type="file" accept="application/json,.json" onChange={e=>importJSON(e.target.files?.[0])}/></label>
           <button type="button" className="eqLogout" onClick={logout}>Изход</button>
         </div>
         <div className="eqFilters"><label>Търсене<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Тема, въпрос, записан отговор…"/></label>
           <label>Тема<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">Всички теми</option>{interviewTopics.map(t=><option key={t.id} value={t.title}>{t.title}</option>)}</select></label>
           <label>Статус<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Всички</option>{Object.entries(statusNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
           <label className="eqCheck"><input type="checkbox" checked={priorityOnly} onChange={e=>setPriorityOnly(e.target.checked)}/> Само P0</label>
         </div>
       </div>
       {notice&&<p className="eqInfo" role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Скрий съобщението">×</button></p>}
       <p className="eqCount">Показани {filtered.length} от {enchevQuestions.length} въпроса · P0 означава първи приоритет, не вече потвърдено решение.</p>
       <div className="eqList">
         {filtered.map(q=>{
           const e=entries[q.id]||defaults;
           return <details className="eqCard" key={q.id}>
             <summary><span className="eqId">{q.id}</span><div><small>{q.topic} · {q.priority}</small><h2>{q.text}</h2></div><span className={"eqChip is-"+e.status}>{statusNames[e.status]}</span></summary>
             <div className="eqDetails">
               <label>Статус<select value={e.status} onChange={x=>change(q.id,{status:x.target.value as Status})}>{Object.entries(statusNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
               <label className="eqWide">Какво отговори Енчев?<textarea rows={3} value={e.answer} onChange={x=>change(q.id,{answer:x.target.value})} placeholder="Запиши буквалния отговор или решение, без да предполагаш."/></label>
               <label>Отговорник<input value={e.owner} onChange={x=>change(q.id,{owner:x.target.value})} placeholder="Енчев / Митко / Борко / друг"/></label>
               <label>Срок<input type="date" value={e.due} onChange={x=>change(q.id,{due:x.target.value})}/></label>
               <label className="eqWide">Следваща стъпка<input value={e.nextStep} onChange={x=>change(q.id,{nextStep:x.target.value})} placeholder="Кой какво изпълнява и до кога?"/></label>
               <small className="eqSaved">{e.updatedAt?"Последно обновяване: "+new Date(e.updatedAt).toLocaleString("bg-BG"):"Все още няма записан отговор."}</small>
             </div>
           </details>;
         })}
         {!filtered.length&&<p className="eqInfo">Няма въпроси по избрания филтър.</p>}
       </div>
       <footer className="eqFooter"><strong>Правило:</strong> „Писмено решение“ се използва само за действително договорен и документиран отговор. Този панел не променя MASTER SYSTEM PLAN, не активира финансови операции и не служи като юридическо становище.</footer>
     </section>}
  </main>;
}