"use client";
import {useEffect,useMemo,useState} from "react";
import {sections,marketConfig} from "./data";
import type {PlanSection,Service} from "./data";
import {detailed,enabledByLevel,lineCost,masterSources,staffByLevel} from "./master-plan-data";
import type {MarketLevel,PlanCost,StaffItem} from "./master-plan-data";
import "./master-plan.css";

type MarketingInfo={adMonthly:number;creativeCost:number;toolsCost:number;staffCost:number;sales:number;support:number;marketers:number;market:"BG"|"ES"|"EU"};
type Props={selected:PlanSection; marketing:MarketingInfo; onMarket:(value:"BG"|"ES"|"EU")=>void};
type ModuleItem={key:string;section:PlanSection;service:Service;index:number;cost:PlanCost;active:boolean};
const euro=(n:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0);
const sum=(x:number[])=>x.reduce((a,b)=>a+b,0);
const nfmt=(n:number)=>new Intl.NumberFormat("bg-BG",{maximumFractionDigits:1}).format(n);
const capped=(s:string,max=1000000)=>{const n=Number(s);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0};
const ids=(s:PlanSection,i:number)=>s.id+"."+String(i+1).padStart(2,"0");
const allowedFields: (keyof PlanCost)[]=["startupOther","monthlyOther","initMitko","initBorko","monthlyMitko","monthlyBorko"];
const FIELDS:{field:keyof PlanCost;name:string}[]=[
 {field:"startupOther",name:"Еднократно: доставчици/външна разработка (€)"},
 {field:"initMitko",name:"Еднократно: часове Митко"},
 {field:"initBorko",name:"Еднократно: часове Борко"},
 {field:"monthlyOther",name:"Месечно: външни услуги/софтуер (€)"},
 {field:"monthlyMitko",name:"Месечно: часове Митко"},
 {field:"monthlyBorko",name:"Месечно: часове Борко"}
];
function NumberInput({label,value,onChange,step=1,max=1000000}:{label:string;value:number;onChange:(v:number)=>void;step?:number;max?:number}){
 return <label className="bm-number"><span>{label}</span><input type="number" min="0" step={step} max={max} value={value} onChange={e=>onChange(capped(e.target.value,max))}/></label>;
}
type TaskPhase={id:string;title:string;tasks:{label:string;kind:string;defaultStatus?:string}[];domains?:string[]};
function MasterTasks({active}:{active:string}){
 const [phases,setPhases]=useState<TaskPhase[]>([]);
 const [urgent,setUrgent]=useState<{id:string;title:string;date:string;plannedHours:number;owner:string;passCriteria:string}[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [all,setAll]=useState(false);
 const [search,setSearch]=useState("");
 const [opened,setOpened]=useState<Record<string,boolean>>({});
 const [maxTasks,setMaxTasks]=useState<Record<string,boolean>>({});
 async function load(){
  if(loading||phases.length)return;
  setLoading(true);setError("");
  try{
   const [a,b,c,d,u]=await Promise.all([import("../master-system-expansion-v2/part-1.json"),import("../master-system-expansion-v2/part-2.json"),import("../master-system-expansion-v2/part-3.json"),import("../master-system-expansion-v2/part-4.json"),import("../data/urgent-119-days.json")]);
   setPhases([a,b,c,d].flatMap(p=>p.phases as TaskPhase[]));
   setUrgent(u.tasks as typeof urgent);
  }catch(e){setError("Неуспешно зареждане на MASTER задачите. Опитай отново.");}
  finally{setLoading(false);}
 }
 const shown=phases.filter(p=>all||detailed[active]?.phases.includes(Number(p.id))).filter(p=>!search||p.title.toLowerCase().includes(search.toLowerCase())||p.tasks.some(x=>x.label.toLowerCase().includes(search.toLowerCase())));
 return <section className="bm-master">
  <div className="bm-master-head"><div><span className="bp-overline">РЕАЛНИЯТ SYSTEM TRACKER</span><h3>Подробните MASTER задачи · ниво надолу</h3><p>Разгръщаш фазата → областта → конкретните системни задачи. Включва 3 226 задачи от Expansion v2 и спешния 119-дневен план. Основните 1 054 задачи са достъпни през „Stages“ в главното меню.</p></div><button className="bm-action" onClick={load} disabled={loading}>{loading?"Зареждане…":phases.length?"Заредени фази":"Зареди всички задачи"}</button></div>
  {error&&<p role="alert" className="bm-alert">{error}</p>}
  {phases.length>0&&<><div className="bm-master-filter"><label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Всички фази 62–99</label><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Търси задача, процес, фаза…" aria-label="Търси MASTER задачи"/></div><p className="bm-muted">Показани фази: {shown.length}; общо в Expansion: {phases.reduce((n,p)=>n+p.tasks.length,0)}. Планиран статус ≠ реално изпълнение.</p>
  <div className="bm-master-cards">{shown.map(p=>{const expanded=!!opened[p.id];const tasks=search?p.tasks.filter(t=>t.label.toLowerCase().includes(search.toLowerCase())):p.tasks;const take=maxTasks[p.id]?tasks:tasks.slice(0,16);return <article className="bm-master-card" key={p.id}><button className="bm-master-title" onClick={()=>setOpened(x=>({...x,[p.id]:!x[p.id]}))} aria-expanded={expanded}><span><b>ФАЗА {p.id}</b> {p.title}</span><small>{p.tasks.length} задачи {expanded?"−":"+"}</small></button>{expanded&&<div className="bm-master-body">{p.domains&&<div className="bm-tags">{p.domains.map((d,i)=><span key={i}>{d}</span>)}</div>}<ul>{take.map((t,i)=><li key={i}><span className="bm-status-dot" aria-hidden="true"/> {t.label} <small>{t.kind}</small></li>)}</ul>{tasks.length>16&&<button className="bm-inline" onClick={()=>setMaxTasks(x=>({...x,[p.id]:!x[p.id]}))}>{maxTasks[p.id]?"Покажи по-малко":"Покажи всички "+tasks.length+" задачи"}</button>}</div>}</article>})}</div>
  <details className="bm-urgent"><summary>Спешен план — 119 дневни задачи</summary><div className="bm-urgent-list">{urgent.map(t=><details key={t.id}><summary><strong>{t.id}</strong> {t.date} · {t.title}</summary><p>Отговорник: {t.owner} · План: {t.plannedHours} часа</p><p>Критерий: {t.passCriteria}</p></details>)}</div></details>
  </>}
  <div className="bm-sources">{masterSources.map(x=><a href={x.href} target="_blank" rel="noreferrer" key={x.label}><b>{x.label}</b><small>{x.desc} ↗</small></a>)}</div>
 </section>;
}
export default function MasterPlanBlocks({selected,marketing,onMarket}:Props){
 const [level,setLevel]=useState<MarketLevel>("bg");
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [costEdit,setCostEdit]=useState<Record<string,Partial<PlanCost>>>({});
 const [enabled,setEnabled]=useState<Record<string,boolean>>({});
 const [hoursMitko,setHoursMitko]=useState(20);
 const [hoursBorko,setHoursBorko]=useState(15);
 const [markup,setMarkup]=useState(25);
 const [markupTeam,setMarkupTeam]=useState(false);
 const [reserve,setReserve]=useState(10);
 const [roster,setRoster]=useState<StaffItem[]>(()=>staffByLevel.bg.map(x=>({...x})));
 const [twilioOn,setTwilioOn]=useState(false);
 const [callMinutes,setCallMinutes]=useState(4);
 const [callCount,setCallCount]=useState({bg:200,es:0,eu:0});
 const [rates,setRates]=useState({bg:.22,es:.06,eu:.12});
 const [twilioFixed,setTwilioFixed]=useState(20);
 const [twilioNumber,setTwilioNumber]=useState(0);
 const [includeMarkup,setIncludeMarkup]=useState(true);
 const [showSummary,setShowSummary]=useState(true);
 const rows=useMemo<ModuleItem[]>(()=>sections.flatMap(section=>section.services.map((service,index)=>{const key=ids(section,index);const cost={...lineCost(section,service,index),...costEdit[key]};return {key,section,service,index,cost,active:enabled[key]??enabledByLevel(cost,level)};})),[level,costEdit,enabled]);
 const selectedRows=rows.filter(r=>r.section.id===selected.id);
 const compute=(items:ModuleItem[])=>({
  setupOther:sum(items.map(x=>x.active?x.cost.startupOther:0)),
  recurringOther:sum(items.map(x=>x.active?x.cost.monthlyOther:0)),
  initM:sum(items.map(x=>x.active?x.cost.initMitko:0)),
  initB:sum(items.map(x=>x.active?x.cost.initBorko:0)),
  monthlyM:sum(items.map(x=>x.active?x.cost.monthlyMitko:0)),
  monthlyB:sum(items.map(x=>x.active?x.cost.monthlyBorko:0))
 });
 const costs=compute(rows),part=compute(selectedRows);
 const sectionTotals=selectedRows.reduce((acc,x)=>{if(!x.active)return acc;acc.setup+=x.cost.startupOther+x.cost.initMitko*hoursMitko+x.cost.initBorko*hoursBorko;acc.monthly+=x.cost.monthlyOther+x.cost.monthlyMitko*hoursMitko+x.cost.monthlyBorko*hoursBorko;return acc;},{setup:0,monthly:0});
 const extraStaff=sum(roster.map(x=>x.count*x.monthly));
 const staffTotal=marketing.staffCost+extraStaff;
 const twilio=twilioOn?(callMinutes*(callCount.bg*rates.bg+callCount.es*rates.es+callCount.eu*rates.eu)+twilioFixed+twilioNumber):0;
 const firstLabor=costs.initM*hoursMitko+costs.initB*hoursBorko;
 const monthlyLabor=costs.monthlyM*hoursMitko+costs.monthlyB*hoursBorko;
 const marketingExternal=marketing.adMonthly+marketing.creativeCost+marketing.toolsCost;
 const setupBase=costs.setupOther+firstLabor;
 const monthlyBase=costs.recurringOther+monthlyLabor+marketingExternal+staffTotal+twilio;
 const setupReserve=setupBase*reserve/100;
 const monthlyReserve=monthlyBase*reserve/100;
 const markupOne=includeMarkup?firstLabor*markup/100:0;
 const markupMonthly=includeMarkup?(monthlyLabor+(markupTeam?staffTotal:0))*markup/100:0;
 const oneOffQuote=setupBase+setupReserve+markupOne;
 const monthlyQuote=monthlyBase+monthlyReserve+markupMonthly;
 const annualQuote=oneOffQuote+12*monthlyQuote;
 const monthlyYours=costs.monthlyM*hoursMitko;
 const monthlyBorko=costs.monthlyB*hoursBorko;
 const selectedDetail=detailed[selected.id];
 const highlightCost=selectedRows.filter(x=>x.active).length;
 const setScenario=(s:MarketLevel)=>{setLevel(s);setRoster(staffByLevel[s].map(x=>({...x})));setCallCount(s==="bg"?{bg:200,es:0,eu:0}:{bg:200,es:350,eu:200});setTwilioOn(s==="eu");onMarket(s==="bg"?"BG":"EU");};
 const setCost=(key:string,field:keyof PlanCost,value:number)=>{if(!allowedFields.includes(field))return;setCostEdit(s=>({...s,[key]:{...s[key],[field]:value}}));};
 const reset=()=>{setCostEdit({});setEnabled({});setScenario(level)};
 const saveCSV=()=>{
  const lines=[["Точка","Раздел","Услуга","Активна","Еднократно външни","Месечно външни","Митко първоначални часове","Борко първоначални часове","Митко месечни часове","Борко месечни часове"],...rows.map(x=>[x.key,x.section.title,x.service.name,x.active?"ДА":"НЕ",x.cost.startupOther,x.cost.monthlyOther,x.cost.initMitko,x.cost.initBorko,x.cost.monthlyMitko,x.cost.monthlyBorko]),["", "СОБСТВЕН ТРУД", "", "", firstLabor,monthlyLabor,costs.initM,costs.initB,costs.monthlyM,costs.monthlyB],["", "ПЕРСОНАЛ", "", "",0,staffTotal,"","","",""],["", "МАРКЕТИНГ", "", "",0,marketingExternal,"","","",""],["", "TWILIO", "", "",0,twilio,"","","",""],["", "ОБЩА ОФЕРТА", "", "",oneOffQuote,monthlyQuote,"","","",""]];
  const csv="\uFEFF"+lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="ENCHEV_MASTER_COSTING_"+level.toUpperCase()+".csv";a.click();URL.revokeObjectURL(u);
 };
 return <div className="bm" aria-label="Пълен детайлен бизнес план и калкулатор">
  <div className="bm-heading"><span className="bp-overline">MASTER · 16 ГЛАВИ → УСЛУГИ → ЗАДАЧИ → ТРУД → ОБЩА ЦЕНА</span><h2>Абсолютно целият план, точка по точка</h2><p>Кликни в услуга, за да видиш какво включва, кой я изпълнява и колко струва. Включените точки се сумират в една обща сметка, без да се броят два пъти едни и същи заплати и рекламни бюджети.</p></div>
  <section className="bm-switch" aria-label="Ниво на изпълнение"><div><strong>ИЗБЕРИ БИЗНЕС НИВО</strong><small>Всички 16 глави получават обща финансова конфигурация</small></div><div className="bm-switch-buttons"><button className={level==="bg"?"active":""} onClick={()=>setScenario("bg")}>НИВО 1 · БЪЛГАРИЯ</button><button className={level==="eu"?"active":""} onClick={()=>setScenario("eu")}>НИВО 2 · ЕВРОПА</button></div></section>
  <section className="bm-overview" aria-label="Консолидиран финансов резултат">
   <div className="bm-overview-head"><div><span className="bp-overline">СВЪРЗАН БЮДЖЕТ · ВСИЧКИ 16 РАЗДЕЛА</span><h3>Обща цена за всичко</h3></div><button className="bm-action" onClick={()=>setShowSummary(x=>!x)}>{showSummary?"Скрий разбивката":"Покажи разбивката"}</button></div>
   <div className="bm-total-grid"><div><span>ЕДНОКРАТНО · СТАРТ</span><b>{euro(oneOffQuote)}</b><small>Проектни разходи + труд + резерв + предложена надценка</small></div><div><span>ВСИЧКО МЕСЕЧНО</span><b>{euro(monthlyQuote)}</b><small>Реклами, хора, софтуер, телефония, труд</small></div><div><span>ПЪРВИ 12 МЕСЕЦА</span><b>{euro(annualQuote)}</b><small>При същите месечни нива; не е одобрен бюджет</small></div></div>
   {showSummary&&<>
   <div className="bm-breakdown">
     <div><span>Външни услуги и разработки — старт</span><strong>{euro(costs.setupOther)}</strong></div>
     <div><span>Наш труд Митко — старт ({nfmt(costs.initM)} ч.)</span><strong>{euro(costs.initM*hoursMitko)}</strong></div>
     <div><span>Наш труд Борко — старт ({nfmt(costs.initB)} ч.)</span><strong>{euro(costs.initB*hoursBorko)}</strong></div>
     <div><span>Външни услуги / софтуер — месечно</span><strong>{euro(costs.recurringOther)}</strong></div>
     <div><span>Рекламен бюджет — месечно</span><strong>{euro(marketing.adMonthly)}</strong></div>
     <div><span>Видео производство — месечно</span><strong>{euro(marketing.creativeCost)}</strong></div>
     <div><span>Workspace / SEO / CRM / маркетинг инструменти</span><strong>{euro(marketing.toolsCost)}</strong></div>
     <div><span>Нашите хора · Sales/Support/Marketing</span><strong>{euro(marketing.staffCost)}</strong></div>
     <div><span>Други наши хора (веднъж, централен щат)</span><strong>{euro(extraStaff)}</strong></div>
     <div><span>Труд Митко — месечно ({nfmt(costs.monthlyM)} ч.)</span><strong>{euro(monthlyYours)}</strong></div>
     <div><span>Труд Борко — месечно ({nfmt(costs.monthlyB)} ч.)</span><strong>{euro(monthlyBorko)}</strong></div>
     <div><span>Twilio международни разговори / номер</span><strong>{euro(twilio)}</strong></div>
     <div><span>Резерв · еднократно / месечно ({reserve}%)</span><strong>{euro(setupReserve)} / {euro(monthlyReserve)}</strong></div>
     <div><span>Предложен марж към Енчев · старт / месечно</span><strong>{euro(markupOne)} / {euro(markupMonthly)}</strong></div>
   </div>
   <div className="bm-controls"><NumberInput label="Моят труд — Митко €/час" value={hoursMitko} onChange={setHoursMitko}/><NumberInput label="Труд Борко €/час" value={hoursBorko} onChange={setHoursBorko}/><NumberInput label="Резерв за непредвидени (%)" value={reserve} onChange={v=>setReserve(Math.min(50,v))}/><NumberInput label="Предложена надценка върху труд (%)" value={markup} onChange={v=>setMarkup(Math.min(200,v))}/></div>
   <div className="bm-options"><label><input type="checkbox" checked={includeMarkup} onChange={e=>setIncludeMarkup(e.target.checked)}/> Включи предложен марж в офертата към Енчев</label><label><input type="checkbox" checked={markupTeam} onChange={e=>setMarkupTeam(e.target.checked)}/> Марж и върху персонала, само ако той се фактурира чрез наш изпълнител</label></div>
   <p className="bm-muted">Маржът е предложена надценка, а НЕ чиста печалба. Не са включени приложими данъци, кредитни лихви, купуване на автомобилен инвентар и бъдещи собствени камиони. Външните услуги се отчитат веднъж по модул; постоянните служители — веднъж в централния щат.</p>
   <div className="bm-toolbar"><button className="bm-action" onClick={saveCSV}>↓ Свали цялата сметка · CSV</button><button className="bm-action bm-ghost" onClick={reset}>↺ Върни примерните разчети</button></div>
   </>}
  </section>
  <section className="bm-people" aria-label="Всички наши хора и разходи"><details><summary><b>НАШИТЕ ХОРА · ВСИЧКИ ЕКИПИ</b><span>Отвори единния щат · {euro(staffTotal)} / месец</span></summary><p className="bm-muted">Постоянният персонал се брои веднъж, независимо колко раздела обслужва. Sales, Support и Marketing се управляват в маркетинг калкулатора по-долу.</p><div className="bm-employees"><div className="bm-employee"><b>Sales + Support + Marketing</b><small>{marketing.sales} + {marketing.support} + {marketing.marketers} души · настрой в Маркетинг</small><strong>{euro(marketing.staffCost)} / мес.</strong></div>{roster.map(person=><div className="bm-employee" key={person.id}><div><b>{person.name}</b><small>{person.dept}</small></div><NumberInput label="FTE" value={person.count} step={.5} max={200} onChange={v=>setRoster(prev=>prev.map(x=>x.id===person.id?{...x,count:v}:x))}/><NumberInput label="Цена на 1 FTE € / мес." value={person.monthly} step={100} onChange={v=>setRoster(prev=>prev.map(x=>x.id===person.id?{...x,monthly:v}:x))}/><strong>{euro(person.count*person.monthly)}</strong></div>)}</div><p className="bm-muted">Това са примерни all-in бюджети за трудов капацитет, не договорени заплати. За България и Испания действителните брутни заплати, данъци, осигуровки и договорни особености се проверяват отделно.</p></details></section>
  <section className="bm-twilio" aria-label="Twilio international contact center">
   <details><summary><b>TWILIO · МЕЖДУНАРОДЕН CALL CENTER</b><span>Обаждания до България, Испания и ЕС · {twilioOn?euro(twilio):"планиран, изключен"}</span></summary>
    <label className="bm-opt"><input type="checkbox" checked={twilioOn} onChange={e=>setTwilioOn(e.target.checked)}/> Включи Twilio в общата месечна цена</label>
    <p>Работа с Twilio Programmable Voice, браузърен dialer, контрол на географските разрешения, call logs и CRM. Не са направени реални обаждания и не е свързан акаунт. Цената е сценарна в евро; официалните тарифи на Twilio са в щатски долари и варират по държава, тип номер и произход.</p>
    <div className="bm-call-fields"><NumberInput label="Минути средно на разговор" value={callMinutes} onChange={v=>setCallMinutes(Math.min(120,v))}/><NumberInput label="Платформа / мес. (€)" value={twilioFixed} onChange={setTwilioFixed}/><NumberInput label="Месечна цена на номер(а) (€)" value={twilioNumber} onChange={setTwilioNumber}/></div>
    <div className="bm-call-fields">{([{key:"bg",name:"България"},{key:"es",name:"Испания"},{key:"eu",name:"Други европейски държави"}] as const).map(c=><div className="bm-call-country" key={c.key}><h4>{c.name}</h4><NumberInput label="Разговори месечно" value={callCount[c.key]} onChange={v=>setCallCount(s=>({...s,[c.key]:v}))}/><NumberInput label="Примерна цена €/мин." value={rates[c.key]} step={.01} max={10} onChange={v=>setRates(s=>({...s,[c.key]:v}))}/><strong>{euro(callCount[c.key]*callMinutes*rates[c.key])} / мес.</strong></div>)}</div>
    <p className="bm-muted">Моделът може да изисква допълнителен browser/app leg, запис, transcription и такси за номер според конкретната конфигурация. Преди включване: Twilio акаунт, Geo Permissions само за необходимите low-risk дестинации, дневен лимит, fraud monitoring, законно основание за B2B контакти.</p>
    <div className="bm-refs"><a href="https://www.twilio.com/en-us/voice/pricing/bg" target="_blank" rel="noreferrer">Twilio тарифи България ↗</a><a href="https://www.twilio.com/en-us/voice/pricing/es" target="_blank" rel="noreferrer">Twilio тарифи Испания ↗</a><a href="https://www.twilio.com/docs/voice/api/dialing-permissions-resources" target="_blank" rel="noreferrer">Международни Geo Permissions ↗</a></div>
   </details>
  </section>
  <section className="bm-current">
   <div className="bm-current-head"><div><span className="bp-overline">РАЗДЕЛ {selected.id} / 16</span><h3>{selected.title} · детайли едно в друго</h3><p>Отвори конкретна услуга → виж всички дейности → редактирай разходите и часовете → сумата се обновява навсякъде.</p></div><div className="bm-current-totals"><span>{highlightCost} / {selectedRows.length} активни услуги</span><b>{euro(sectionTotals.setup)} старт</b><b>{euro(sectionTotals.monthly)} / мес.</b></div></div>
   {selected.id==="02"&&<a className="bm-action bm-direct-marketing" href="#bp-marketing">→ Подробен маркетинг калкулатор · реклами, Reels, Workspace и екипи</a>}
   <div className="bm-service-cards">{selectedRows.map(x=>{const open=!!expanded[x.key];const c=x.cost;const sub=detailed[selected.id].tracks[x.index%detailed[selected.id].tracks.length];const once=c.startupOther+c.initMitko*hoursMitko+c.initBorko*hoursBorko;const recurring=c.monthlyOther+c.monthlyMitko*hoursMitko+c.monthlyBorko*hoursBorko;
    return <article className={"bm-service-card "+(x.active?"":"bm-off")} key={x.key}>
     <div className="bm-service-top"><label className="bm-checked"><input type="checkbox" checked={x.active} disabled={c.stage==="future"} onChange={e=>setEnabled(s=>({...s,[x.key]:e.target.checked}))} aria-label={"Включи услуга "+x.service.name}/><span>{x.key}</span></label><span className="bm-phase">{c.stage==="future"?"БЪДЕЩО · НЕ ВКЛЮЧЕНО":c.stage==="eu"?"НИВО 2 · EU":"НИВО 1 · BG"}</span></div>
     <button className="bm-expand" onClick={()=>setExpanded(s=>({...s,[x.key]:!s[x.key]}))} aria-expanded={open}><span><strong>{x.service.name}</strong><small>{x.service.detail}</small></span><span>{open?"−":"+"}</span></button>
     <div className="bm-price-line"><div><span>ЕДНОКРАТНО</span><b>{euro(once)}</b></div><div><span>МЕСЕЧНО</span><b>{euro(recurring)}</b></div></div>
     {open&&<div className="bm-nested">
       <div className="bm-work"><h4>01. Какво включва услугата?</h4><p>{sub.name}</p><ul>{sub.tasks.map((t,i)=><li key={i}>{t}</li>)}</ul><p><strong>Приемане:</strong> {sub.proof}</p></div>
       <div className="bm-work"><h4>02. Хора и отговорници</h4><div className="bm-tags">{selected.team.map(t=><span key={t}>{t}</span>)}<span>Митко / Борко · ръководство</span></div><p>Бизнес резултат: {selectedDetail.income}</p></div>
       <div className="bm-work"><h4>03. Разбий реалната цена</h4><p className="bm-muted">Ориентировъчни числа; настрой спрямо офертата на изпълнителя и часовете. Ако имаме човек в централния щат, неговата заплата се начислява само там.</p><div className="bm-input-grid">{FIELDS.map(f=><NumberInput key={f.field} label={f.name} value={Number(c[f.field])||0} onChange={v=>setCost(x.key,f.field,v)} step={f.field.toLowerCase().includes("hours")?1:1}/>)}</div><div className="bm-expense-result"><span>Външни доставчици + мои часове × {euro(hoursMitko)}/ч + Борко × {euro(hoursBorko)}/ч</span><b>{euro(once)} еднократно · {euro(recurring)} месечно</b></div>{c.laborByRoster&&<p className="bm-flag">Работата на постоянните оператори/служители е включена в централния щат, не втори път в тази услуга.</p>}</div>
       <div className="bm-work"><h4>04. Зависимости и рискове</h4><p>{selectedDetail.gate}</p><ul>{selectedDetail.risks.map((r,i)=><li key={i}>{r}</li>)}</ul></div>
     </div>}
    </article>;
   })}</div>
   <div className="bm-gate"><b>ФИНАЛЕН GO / NO-GO</b><p>{selectedDetail.gate}</p><small>Свързани MASTER фази: {selectedDetail.phases.map(n=>"P"+n).join(" · ")}</small></div>
  </section>
  <MasterTasks active={selected.id}/>
 </div>;
}
