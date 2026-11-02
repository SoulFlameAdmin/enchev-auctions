"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import data from "../data/urgent-daily-questions-v1.json";
import legal from "../data/urgent-legal-foundation-v1.json";
import "./urgent-daily-questions.css";

type Status="open"|"working"|"answered"|"blocked";
type Answer={status:Status;answer:string;owner:string;evidence:string;updatedAt:string};
type Answers=Record<string,Answer>;
type ViewFilter="all"|"open"|"blocked"|"answered";
type Question=(typeof data.questions)[number];
type PlanDay=(typeof data.days)[number];
const STORAGE="enchev-daily-answers-v1";
const LABEL:Record<Status,string>={open:"За решение",working:"В работа",answered:"Отговорено",blocked:"Блокирано"};
const BASE:Answer={status:"open",answer:"",owner:"",evidence:"",updatedAt:""};
const questionById=new Map<string,Question>(data.questions.map(q=>[q.id,q]));
const legalById=new Map(legal.requirements.map(x=>[x.id,x]));
function sanitize(raw:unknown):Answers{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
 const vals=raw as Record<string,unknown>,out:Answers={};
 for(const q of data.questions){
  const v=vals[q.id];if(!v||typeof v!=="object"||Array.isArray(v))continue;
  const row=v as Record<string,unknown>,txt=(k:string,n:number)=>typeof row[k]==="string"?row[k].slice(0,n):"";
  const status=Object.keys(LABEL).includes(String(row.status))?row.status as Status:"open";
  out[q.id]={status,answer:txt("answer",3000),owner:txt("owner",160),evidence:txt("evidence",2000),updatedAt:txt("updatedAt",40)};
  if(out[q.id].status==="answered"&&!isAccepted(out[q.id]))out[q.id].status="working";
 }
 return out;
}
function isAccepted(a:Answer|undefined){return !!a&&a.status==="answered"&&!!a.answer.trim()&&!!a.owner.trim()&&!!a.evidence.trim();}
function fileDownload(s:string,name:string,mime:string){
 const url=URL.createObjectURL(new Blob([s],{type:mime}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function quote(x:unknown){return '"'+String(x??"").replaceAll('"','""')+'"';}
function formatDay(date:string){return new Intl.DateTimeFormat("bg-BG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));}
export default function DailyQuestions119({today,onOpenTask}:{today:string;onOpenTask:(dayId:string)=>void}){
 const [chosenId,setChosenId]=useState("D001");
 const [chosenManually,setChosenManually]=useState(false);
 const [answers,setAnswers]=useState<Answers>({});
 const [loaded,setLoaded]=useState(false);
 const [filter,setFilter]=useState<ViewFilter>("all");
 const [showCarryOver,setShowCarryOver]=useState(false);
 const [showLegal,setShowLegal]=useState(true);
 const [notice,setNotice]=useState("");
 const importRef=useRef<HTMLInputElement>(null);
 const index=data.days.findIndex(d=>d.dayId===chosenId);
 const day:PlanDay=data.days[Math.max(0,index)];
 const todayDay=data.days.find(d=>d.date===today)||data.days.find(d=>d.date>today)||data.days[data.days.length-1];
 useEffect(()=>{if(!chosenManually)setChosenId(todayDay.dayId);},[todayDay.dayId,chosenManually]);
 useEffect(()=>{
  try{setAnswers(sanitize(JSON.parse(localStorage.getItem(STORAGE)||"{}")));}catch{setAnswers({});}
  setLoaded(true);
  const update=(e:StorageEvent)=>{if(e.key===STORAGE){try{setAnswers(sanitize(JSON.parse(e.newValue||"{}")));}catch{setAnswers({});}}};
  window.addEventListener("storage",update);return()=>window.removeEventListener("storage",update);
 },[]);
 useEffect(()=>{if(loaded){try{localStorage.setItem(STORAGE,JSON.stringify(answers));}catch{setNotice("Съхранението е недостъпно — експортирай отговорите.")}}},[answers,loaded]);
 const questions=useMemo(()=>day.questionIds.map(id=>questionById.get(id)).filter((x):x is Question=>!!x),[day]);
 const accepted=questions.filter(q=>isAccepted(answers[q.id])).length;
 const blockers=questions.filter(q=>answers[q.id]?.status==="blocked").length;
 const carry=data.questions.filter(q=>q.date<day.date&&q.priority==="P0"&&!isAccepted(answers[q.id]));
 const previousCarry=carry.length;
 const shown=questions.filter(q=>filter==="all"||(filter==="open"&&!isAccepted(answers[q.id]))||(filter==="blocked"&&answers[q.id]?.status==="blocked")||(filter==="answered"&&isAccepted(answers[q.id])));
 const related=day.relatedLegalIds.map(id=>legalById.get(id)).filter((x):x is NonNullable<typeof x>=>!!x);
 const questionPct=Math.round(accepted/questions.length*100);
 function navigate(next:string){if(!data.days.some(x=>x.dayId===next))return;setChosenId(next);setChosenManually(true);setNotice("");}
 function update(id:string,patch:Partial<Answer>){
  setAnswers(prev=>{
   const question=questionById.get(id);if(!question)return prev;
   const next={...(prev[id]||{...BASE,owner:question.owner}),...patch,updatedAt:new Date().toISOString()};
   if(next.status==="answered"&&!isAccepted(next)){next.status="working";setNotice(id+": нужен е конкретен отговор, отговорник и доказателство. Това не е тест PASS.");}
   return {...prev,[id]:next};
  });
 }
 function mark(id:string,status:Status){
  const q=questionById.get(id);if(!q)return;
  const a=answers[id]||{...BASE,owner:q.owner};
  if(status==="answered"&&(!a.answer.trim()||!a.owner.trim()||!a.evidence.trim())){
   setNotice(id+": попълни отговор, отговорник и доказателство, преди да маркираш „Отговорено“.");return;
  }
  setNotice("");update(id,{status});
 }
 function exportJson(){fileDownload(JSON.stringify({schemaVersion:1,plan:"ENCHEV_DAILY_119_QUESTIONS",exportedAt:new Date().toISOString(),answers},null,2),"enchev-daily-119-answers.json","application/json;charset=utf-8");}
 function exportCsv(){
  const head=["ID","Дата","Задача","Категория","Приоритет","Въпрос","Отговорник","Статус","Отговор","Доказателство","Обновено"];
  const lines=data.questions.map(q=>{const a=answers[q.id];return [q.id,q.date,q.dayId,q.category,q.priority,q.question,a?.owner||q.owner,a?.status||"open",a?.answer||"",a?.evidence||"",a?.updatedAt||""].map(quote).join(",");});
  fileDownload("\ufeff"+[head.map(quote).join(","),...lines].join("\r\n"),"enchev-daily-119-questions.csv","text/csv;charset=utf-8");
 }
 async function importJson(file?:File){
  if(!file)return;
  try{
   if(file.size>2_000_000)throw Error("size");
   const parsed=JSON.parse(await file.text());
   if(parsed.schemaVersion!==1||parsed.plan!=="ENCHEV_DAILY_119_QUESTIONS")throw Error("format");
   setAnswers(sanitize(parsed.answers));setNotice("Архивът е зареден и ще се запази локално в този браузър.");
  }catch{setNotice("Невалиден архив. Използвай ENCHEV_DAILY_119_QUESTIONS JSON.");}
  if(importRef.current)importRef.current.value="";
 }
 function legalFocus(id:string){
  window.dispatchEvent(new CustomEvent("enchev-legal-focus",{detail:{id}}));
  document.getElementById("legal-requirements")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 return <section className="dailyQ" id="daily-questions" aria-label="Дневни въпроси по спешния план">
  <header className="dailyQHeader"><div><span>ПРОЕКТЕН КОНТРОЛ / 119 ДНИ · 1 190 ВЪПРОСА</span><h2>ДНЕВНИ ВЪПРОСИ <em>НА ВСЕКИ ЕТАП</em></h2>
   <p>Виждаш всичко, което трябва да решим за днешната разработка — техническо, бизнес, законово, финансово, тестове и рискове.</p></div>
   <div className="dailyQExport"><button type="button" onClick={exportCsv}>CSV</button><button type="button" onClick={exportJson}>JSON архив</button><button type="button" onClick={()=>importRef.current?.click()}>Импорт</button><input ref={importRef} hidden type="file" accept=".json,application/json" onChange={e=>void importJson(e.target.files?.[0])}/></div>
  </header>
  <div className="dailyQDateBar">
   <button type="button" disabled={index===0} onClick={()=>navigate(data.days[index-1]?.dayId)}>‹ Предишен</button>
   <label>Ден и конкретна задача<select aria-label="Избери ден за въпросите" value={day.dayId} onChange={e=>navigate(e.target.value)}>{data.days.map(d=><option key={d.dayId} value={d.dayId}>{d.dayId} · {d.date} · {d.task.slice(0,75)}</option>)}</select></label>
   <button type="button" disabled={index===data.days.length-1} onClick={()=>navigate(data.days[index+1]?.dayId)}>Следващ ›</button>
   <button type="button" className="dailyQToday" onClick={()=>{setChosenManually(false);setChosenId(todayDay.dayId)}}>ДНЕС · {todayDay.dayId}</button>
  </div>
  <div className="dailyQFocus">
   <div><span>{day.dayId} · {formatDay(day.date)} · СЕДМИЦА {day.week}</span><h3>{day.task}</h3><p>Отговорник по задачата: <strong>{day.owner}</strong></p></div>
   <button type="button" onClick={()=>onOpenTask(day.dayId)}>Отвори дневната задача ↓</button>
  </div>
  <div className="dailyQMetrics">
   <div><span>ВЪПРОСИ ЗА ДЕНЯ</span><strong>{questions.length}</strong></div>
   <div><span>ОТГОВОРЕНИ С ДОКАЗАТЕЛСТВО</span><strong>{accepted}/{questions.length}</strong></div>
   <div><span>БЛОКИРАНИ</span><strong>{blockers}</strong></div>
   <div><span>НЕРЕШЕНИ P0 ОТ ПРЕДНИ ДНИ</span><strong>{previousCarry}</strong></div>
   <div><span>СВЪРЗАНИ LEG ВЪПРОСИ</span><strong>{related.length}</strong></div>
  </div>
  <div className="dailyQProgress" role="progressbar" aria-label="Отговорени въпроси за деня" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={accepted}><i style={{width:questionPct+"%"}}/></div>
  <div className="dailyQDisclaimer">Отговорен въпрос ≠ завършена разработка, независим тест или юридическо одобрение. Всички отговори се пазят <b>само в този браузър</b>. Не записвай лични документи, банкови данни или тайни ключове.</div>
  <div className="dailyQHeading"><div><small>ПЪЛЕН СПИСЪК / {day.dayId}</small><h3>10 задължителни въпроса за разработката</h3></div>
   <div className="dailyQFilters">{([["all","Всички"],["open","Нерешени"],["blocked","Блокирани"],["answered","Отговорени"]] as const).map(([k,v])=><button key={k} type="button" className={filter===k?"active":""} onClick={()=>setFilter(k)}>{v}</button>)}</div>
  </div>
  <div className="dailyQList">
   {shown.map(q=>{const v=answers[q.id]||{...BASE,owner:q.owner};return <details key={q.id} className={"dailyQItem "+(v.status==="blocked"?"isBlocked":isAccepted(v)?"isAnswered":"")}>
    <summary><span className="dailyQCode">{q.id}<small>{q.priority}</small></span><div className="dailyQText"><span>{q.category}</span><b>{q.question}</b></div><span className="dailyQStatus">{LABEL[v.status]}</span></summary>
    <div className="dailyQItemBody">
     <p><b>Как ще приемем решението:</b> {q.acceptance}</p>
     <div className="dailyQFields">
      <label className="dailyQWide">Отговор / взето решение<textarea rows={3} value={v.answer} onChange={e=>update(q.id,{answer:e.target.value.slice(0,3000)})} placeholder="Какво решихме? Какви са условията и зависимостите?"/></label>
      <label>Отговорник<input value={v.owner} onChange={e=>update(q.id,{owner:e.target.value.slice(0,160)})}/></label>
      <label>Статус<select value={v.status} onChange={e=>mark(q.id,e.target.value as Status)}>{Object.entries(LABEL).map(([k,label])=><option value={k} key={k}>{label}</option>)}</select></label>
      <label className="dailyQWide">Доказателство / линк към задача, документ, commit или CI<input value={v.evidence} onChange={e=>update(q.id,{evidence:e.target.value.slice(0,2000)})} placeholder="Конкретен URL/номер на решение, без секрети"/></label>
     </div>
     <div className="dailyQItemBottom"><span>{v.updatedAt?new Date(v.updatedAt).toLocaleString("bg-BG",{timeZone:"Europe/Sofia"}):"Няма записано решение"}</span><button type="button" disabled={isAccepted(v)} onClick={()=>mark(q.id,"answered")}>{isAccepted(v)?"✓ Записано":"Запиши като отговорено"}</button></div>
    </div>
   </details>;})}
   {shown.length===0&&<div className="dailyQEmpty">Няма въпроси за избрания филтър.</div>}
  </div>
  <div className="dailyQLegal">
   <div className="dailyQLegalTop"><div><small>LEGAL & COMPLIANCE / СВЪРЗАНО С {day.dayId}</small><h3>{related.length} юридически и оперативни въпроса към тази разработка</h3></div><button type="button" onClick={()=>setShowLegal(x=>!x)}>{showLegal?"Скрий":"Покажи всички"}</button></div>
   {showLegal&&<div className="dailyQLegalGrid">{related.map(r=><button key={r.id} type="button" onClick={()=>legalFocus(r.id)}><span>{r.id} · {r.priority}</span><b>{r.title}</b><small>{r.question}</small></button>)}</div>}
   <p>Тези въпроси се решават и документират в отделния LEGAL & COMPLIANCE регистър. Натисни върху въпрос, за да отвориш неговата точка.</p>
  </div>
  <div className="dailyQCarry">
   <div><span>ПРЕНЕСЕНИ БЛОКЕРИ</span><h3>{previousCarry} нерешени критични въпроса от предишните дни</h3><p>Въпросите остават видими, докато не получите конкретен отговор и доказателство.</p></div>
   <button type="button" onClick={()=>setShowCarryOver(x=>!x)}>{showCarryOver?"Скрий старите въпроси":"Виж всички нерешени P0"}</button>
  </div>
  {showCarryOver&&<div className="dailyQBacklog">{carry.map(q=><button type="button" key={q.id} onClick={()=>{navigate(q.dayId);setFilter("all");document.getElementById("daily-questions")?.scrollIntoView({behavior:"smooth"})}}><b>{q.id} · {q.date}</b><span>{q.question}</span><small>{answers[q.id]?.status==="blocked"?"БЛОКИРАНО":"НЕРЕШЕНО"}</small></button>)}{carry.length===0&&<p>Няма нерешени P0 въпроси от по-ранни дни.</p>}</div>}
  {notice&&<div className="dailyQNotice" role="status"><span>{notice}</span><button type="button" onClick={()=>setNotice("")}>×</button></div>}
 </section>;
}
