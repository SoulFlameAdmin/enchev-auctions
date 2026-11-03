"use client";
import {useEffect,useMemo,useState} from "react";
import benchmark from "../data/urgent-auction-benchmark-v1.json";
import "./urgent-auction-benchmark.css";

type State="planned"|"working"|"blocked"|"verified";
type Test="none"|"pass"|"fail";
type RecordEntry={status:State;test:Test;evidence:string;notes:string;updatedAt:string};
type Store=Record<string,RecordEntry>;
type Filter="P0"|"all"|"verified"|"blocked";
const STORE_KEY="enchev-urgent-benchmark-parity-v1";
const DEFAULT:RecordEntry={status:"planned",test:"none",evidence:"",notes:"",updatedAt:""};
const accepted=(x?:RecordEntry)=>Boolean(x?.status==="verified"&&x.test==="pass"&&x.evidence.trim());
const statusLabels:Record<State,string>={planned:"За изграждане",working:"В работа",blocked:"Блокирано",verified:"Доказано"};
const featureIds=new Set(benchmark.features.map(f=>f.id));

function readRecords(raw:unknown):Store {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
  const result:Store={};
  for(const [id,entry] of Object.entries(raw)){
    if(!featureIds.has(id)||!entry||typeof entry!=="object"||Array.isArray(entry))continue;
    const x=entry as Record<string,unknown>;
    const status=(["planned","working","blocked","verified"].includes(String(x.status))?x.status:"planned") as State;
    const test=(["none","pass","fail"].includes(String(x.test))?x.test:"none") as Test;
    const evidence=typeof x.evidence==="string"?x.evidence.slice(0,1600):"";
    const notes=typeof x.notes==="string"?x.notes.slice(0,2000):"";
    const value:RecordEntry={status,test,evidence,notes,updatedAt:typeof x.updatedAt==="string"?x.updatedAt.slice(0,40):""};
    if(value.status==="verified"&&!accepted(value))value.status="working";
    result[id]=value;
  }
  return result;
}

function downloadJson(value:unknown){
  const payload=JSON.stringify(value,null,2);
  const blob=new Blob([payload],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="enchev-benchmark-parity-evidence.json";
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}

export default function AuctionBenchmarkCenter({onOpenTask}:{onOpenTask:(id:string)=>void}){
  const [entries,setEntries]=useState<Store>({});
  const [loaded,setLoaded]=useState(false);
  const [filter,setFilter]=useState<Filter>("P0");
  const [search,setSearch]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    try{setEntries(readRecords(JSON.parse(localStorage.getItem(STORE_KEY)||"{}")))}catch{setEntries({})}
    setLoaded(true);
    const storage=(event:StorageEvent)=>{
      if(event.key!==STORE_KEY)return;
      try{setEntries(readRecords(JSON.parse(event.newValue||"{}")))}catch{setEntries({})}
    };
    window.addEventListener("storage",storage);return()=>window.removeEventListener("storage",storage);
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    try{localStorage.setItem(STORE_KEY,JSON.stringify(entries))}catch{setNotice("Локалното съхранение не работи. Експортирай доказателствата.")}
  },[entries,loaded]);
  function edit(id:string,patch:Partial<RecordEntry>){
    setEntries(prev=>{
      const next={...(prev[id]||DEFAULT),...patch,updatedAt:new Date().toISOString()};
      if(next.status==="verified"&&!accepted(next)){next.status="working";}
      return {...prev,[id]:next};
    });
  }
  function setStatus(id:string,status:State){
    const entry=entries[id]||DEFAULT;
    if(status==="verified"&&(entry.test!=="pass"||!entry.evidence.trim())){
      setNotice(id+": нужно е PASS и проверимо доказателство, преди да приемеш подточката.");return;
    }
    setNotice("");edit(id,{status});
  }
  const categoryNames=useMemo(()=>[...new Set(benchmark.features.map(x=>x.category))],[]);
  const items=benchmark.features.filter(x=>{
    const q=search.trim().toLocaleLowerCase("bg-BG");
    if(filter==="P0"&&x.priority!=="P0")return false;
    if(filter==="verified"&&!accepted(entries[x.id]))return false;
    if(filter==="blocked"&&entries[x.id]?.status!=="blocked")return false;
    return !q||[x.id,x.category,x.title,x.linkedDay,x.acceptance,...x.legalRefs].join(" ").toLocaleLowerCase("bg-BG").includes(q);
  });
  const completed=benchmark.features.filter(x=>accepted(entries[x.id])).length;
  const blocked=benchmark.features.filter(x=>entries[x.id]?.status==="blocked").length;
  const totalP0=benchmark.features.filter(x=>x.priority==="P0").length;
  const completedP0=benchmark.features.filter(x=>x.priority==="P0"&&accepted(entries[x.id])).length;
  const statusMessage="Това е функционална референтна матрица, НЕ доказателство, че ENCHEV вече изпълнява изискванията. Данните са локални за този браузър и се приемат само с PASS + доказателство.";
  return <section className="benchmarkCenter" aria-label="Аукционна функционална матрица към спешния план" id="benchmark-scope">
    <div className="benchmarkHeading">
      <div><span className="benchmarkEyebrow">01 / ФУНКЦИОНАЛЕН ПАРИТЕТ · APPEND-ONLY</span>
        <h2>Международен аукционен стандарт → ENCHEV <em>1 МАРТ</em></h2>
        <p>Собствена система, документи и тарифи · 119-те основни дни остават непроменени.</p></div>
      <button type="button" onClick={()=>downloadJson({schemaVersion:1,scope:"ENCHEV_COPART_PARITY",exportedAt:new Date().toISOString(),entries})}>ЕКСПОРТ НА ДОКАЗАТЕЛСТВА · JSON</button>
    </div>
    <div className="benchmarkStatGrid">
      <div><small>РЕФЕРЕНТНИ ФУНКЦИИ</small><b>{benchmark.features.length}</b></div>
      <div><small>P0 ДО 1 МАРТ</small><b>{completedP0} / {totalP0}</b></div>
      <div><small>ВИДОВЕ ТАКСИ</small><b>{benchmark.feeComponents.length}</b></div>
      <div><small>ДОКУМЕНТНИ ПОТОЦИ</small><b>{benchmark.documentWorkflows.length}</b></div>
      <div><small>БЛОКИРАНИ</small><b>{blocked}</b></div>
    </div>
    <div className="benchmarkWarning" role="note">{statusMessage}
      <strong> 20-те вида такси са изключени по подразбиране; сумите за ENCHEV са неопределени до подписан ценоразпис.</strong>
    </div>
    <div className="benchmarkControls">
      <div className="benchmarkChips">
        {([["P0","P0 до старт"],["all","Всички"],["blocked","Блокирани"],["verified","Приети"]] as const).map(([key,label])=>
          <button type="button" key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}</button>)}
      </div>
      <input aria-label="Търсене в конкурентен оператор матрицата" placeholder="Търси функция, ден, такса, документ..." value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
    <div className="benchmarkCategoryList">
      {categoryNames.map(category=>{
        const categoryItems=items.filter(x=>x.category===category);
        if(!categoryItems.length)return null;
        return <details className="benchmarkCategory" key={category}>
          <summary><b>{category}</b><span>{categoryItems.filter(x=>accepted(entries[x.id])).length}/{categoryItems.length} доказани</span></summary>
          <div className="benchmarkItems">
            {categoryItems.map(x=>{
              const entry=entries[x.id]||DEFAULT;
              const source=benchmark.sourceLinks[x.sourceKey as keyof typeof benchmark.sourceLinks];
              return <details className="benchmarkItem" key={x.id}>
                <summary><span className="benchmarkId">{x.id}</span><b>{x.title}</b><span className={accepted(entry)?"benchmarkAccepted":"benchmarkPending"}>{accepted(entry)?"✓ PASS":entry.status==="blocked"?"BLOCKED":x.priority}</span></summary>
                <div className="benchmarkBody">
                  <p><strong>Критерий за приемане:</strong> {x.acceptance}</p>
                  <p className="benchmarkMeta">Статус на реализация: {accepted(entry)?"доказан по ръчен протокол":"ПЛАНИРАН, не е доказан"} · {x.legalRefs.join(", ")||"Без директна LEG връзка"}</p>
                  <div className="benchmarkActions"><button type="button" onClick={()=>onOpenTask(x.linkedDay)}>Отвори {x.linkedDay}</button>
                    <a href={source} target="_blank" rel="noopener noreferrer">Официален референтен източник ↗</a></div>
                  <div className="benchmarkEdit">
                    <label>Статус<select value={entry.status} onChange={e=>setStatus(x.id,e.target.value as State)}>{(["planned","working","blocked","verified"] as const).map(s=><option value={s} key={s}>{statusLabels[s]}</option>)}</select></label>
                    <label>Тест<select value={entry.test} onChange={e=>edit(x.id,{test:e.target.value as Test})}><option value="none">НЕ Е ТЕСТВАНО</option><option value="pass">PASS</option><option value="fail">FAIL</option></select></label>
                    <label className="benchmarkWide">Доказателство: CI run, снимка, commit, подписан документ<input value={entry.evidence} onChange={e=>edit(x.id,{evidence:e.target.value.slice(0,1600)})} maxLength={1600} placeholder="https://... или проверим ID"/></label>
                    <label className="benchmarkWide">Бележка / блокер<textarea value={entry.notes} onChange={e=>edit(x.id,{notes:e.target.value.slice(0,2000)})} maxLength={2000} rows={2}/></label>
                  </div>
                </div>
              </details>
            })}
          </div>
        </details>;
      })}
    </div>
    <div className="benchmarkSubmatrices">
      <details><summary>Такси и pricing engine · {benchmark.feeComponents.length} компонента</summary>
        <p>Нито една референтна сума не е тарифа на ENCHEV. Задължителни са versioned rules, net/tax/gross, feeSnapshot, държава, валута и одобрение от Енчев и счетоводител.</p>
        <div className="benchmarkMatrix">{benchmark.feeComponents.map(f=><div key={f.id}><code>{f.code}</code><span>{f.title}</span><button type="button" onClick={()=>onOpenTask(f.linkedDay)}>{f.linkedDay}</button></div>)}</div>
      </details>
      <details><summary>Пълни документни потоци · {benchmark.documentWorkflows.length}</summary>
        <p>Всички шаблони са <strong>неодобрени юридически</strong> до преглед; реалните документи не могат да се генерират като валидни без разрешение.</p>
        <div className="benchmarkMatrix">{benchmark.documentWorkflows.map(d=><div key={d.id}><code>{d.code}</code><span>{d.title}</span><button type="button" onClick={()=>onOpenTask(d.linkedDay)}>{d.linkedDay}</button></div>)}</div>
      </details>
      <details><summary>Решения, подписи и GO/NO-GO · {benchmark.decisionGates.length}</summary>
        <div className="benchmarkMatrix">{benchmark.decisionGates.map(g=><div key={g.byDay}><code>{g.byDay}</code><span>{g.subject} · {g.owner} · НЕПОДПИСАНО</span><button type="button" onClick={()=>onOpenTask(g.byDay)}>Отвори</button></div>)}</div>
      </details>
      <details><summary>Референтни референтни такси — Испания, 06.01.2026</summary>
        <p>Използва се само като публичен benchmark; официалните страници се разминават за таксата за получаване (31,70 € / 45 €), затова не се импортват автоматично.</p>
        <p>Членство Basic/Premium: {benchmark.competitorPricingReference.annualMembershipEUR.basic.toLocaleString("bg-BG")} / {benchmark.competitorPricingReference.annualMembershipEUR.premium.toLocaleString("bg-BG")} € без данък. Buyer fee: 19 диапазона и последен процент {benchmark.competitorPricingReference.buyerFeeHighTier.percent}% при ≥15 500 €. Online bid fee: 3 диапазона.</p>
        <a href={benchmark.sourceLinks.ES_FEES_2026} target="_blank" rel="noopener noreferrer">конкурентен оператор ES — таблиците и датираната версия ↗</a>
      </details>
    </div>
    <p className="benchmarkFoot">Проверени ръчно: {completed} / {benchmark.features.length}. Приемането в този панел не замества независим CI, правно одобрение, финансово GO или проверка на реална сделка.</p>
    {notice&&<div className="benchmarkNotice" role="alert">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Затвори известието">×</button></div>}
  </section>;
}
