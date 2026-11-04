"use client";
import {useEffect,useMemo,useState} from "react";
import {sections,marketConfig} from "./data";
import {detailed,enabledByLevel,lineCost,masterSources,staffByLevel} from "./master-plan-data";
import type {MarketLevel} from "./master-plan-data";
import "./full-screen-business-plan.css";

type Market="BG"|"ES"|"EU";
type Channel="meta"|"search"|"youtube"|"tiktok";
type Area="overview"|"services"|"tasks"|"team"|"finance"|"marketing"|"phone"|"docs";
type CostField="startupOther"|"monthlyOther"|"initMitko"|"initBorko"|"monthlyMitko"|"monthlyBorko";
type CostOverrides=Partial<Record<CostField,number>>;
const channels:Channel[]=["meta","search","youtube","tiktok"];
const channelNames:Record<Channel,string>={meta:"Facebook + Instagram",search:"Google Search",youtube:"YouTube / Shorts",tiktok:"TikTok Ads"};
const stages=[{id:"90",name:"Дни 1–90",detail:"D003 и правен GO, първи проверени продавачи, първи лотове и контролирани тестове."},{id:"180",name:"Дни 91–180",detail:"Стабилен B2B пилот, CRM, Call Center, реални оферти за транспорт и финансови сверявания."},{id:"365",name:"Дни 181–365",detail:"Устойчиви продажби в България и подготовка за Испания при доказана икономика."}];
const euro=(x:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(x);
const nf=(x:number)=>new Intl.NumberFormat("bg-BG",{maximumFractionDigits:0}).format(Math.round(x));
const clamp=(n:number,max=1000000)=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
const nav=(arr:{id:Area,label:string}[])=>arr;

function Num({label,value,onChange,step=1,max=1000000}: {label:string;value:number;onChange:(n:number)=>void;step?:number;max?:number}){
 return <label className="zf-field"><span>{label}</span><input type="number" value={value} min="0" max={max} step={step} onChange={e=>onChange(clamp(Number(e.target.value),max))}/></label>;
}
function PageArrows({at,total,onChange,label}:{at:number;total:number;onChange:(v:number)=>void;label?:string}){
 return <div className="zf-pager"><button type="button" disabled={at===0} onClick={()=>onChange(at-1)} aria-label="Предишно">‹ Назад</button><span>{label?label+" · ":""}{at+1} / {Math.max(total,1)}</span><button type="button" disabled={at+1>=total} onClick={()=>onChange(at+1)}>Напред ›</button></div>;
}
export default function FullScreenBusinessPlan(){
 const [pageSize,setPageSize]=useState(4);
 const [page,setPage]=useState(0);
 const [selected,setSelected]=useState("");
 const [tab,setTab]=useState<Area>("overview");
 const [serviceIdx,setServiceIdx]=useState(0);
 const [servicePart,setServicePart]=useState<"scope"|"cost">("scope");
 const [trackIdx,setTrackIdx]=useState(0);
 const [teamIdx,setTeamIdx]=useState(0);
 const [docIdx,setDocIdx]=useState(0);
 const [marketingPage,setMarketingPage]=useState(0);
 const [callPage,setCallPage]=useState(0);
 const [menuOpen,setMenuOpen]=useState(false);
 const [level,setLevel]=useState<MarketLevel>("bg");
 const [market,setMarket]=useState<Market>("BG");
 const [spent,setSpent]=useState<Record<Channel,number>>({...marketConfig.BG.defaultSpend});
 const [videoCount,setVideoCount]=useState(6);
 const [videoPrice,setVideoPrice]=useState(130);
 const [sales,setSales]=useState(1);
 const [support,setSupport]=useState(1);
 const [marketers,setMarketers]=useState(1);
 const [workspaceSeats,setWorkspaceSeats]=useState(5);
 const [seo,setSeo]=useState(250);
 const [crm,setCrm]=useState(110);
 const [phoneTools,setPhoneTools]=useState(80);
 const [hourM,setHourM]=useState(20);
 const [hourB,setHourB]=useState(15);
 const [reserve,setReserve]=useState(10);
 const [markup,setMarkup]=useState(25);
 const [costOverrides,setCostOverrides]=useState<Record<string,CostOverrides>>({});
 const [activeOverrides,setActiveOverrides]=useState<Record<string,boolean>>({});
 const [twilioEnabled,setTwilioEnabled]=useState(false);
 const [callMinutes,setCallMinutes]=useState(4);
 const [callCounts,setCallCounts]=useState({bg:200,es:0,eu:0});
 const [callRates,setCallRates]=useState({bg:.22,es:.06,eu:.12});
 const [twilioBase,setTwilioBase]=useState(20);
 const [staffFte,setStaffFte]=useState<Record<string,number>>({});
 const [staffPrices,setStaffPrices]=useState<Record<string,number>>({});

 useEffect(()=>{
  const prevBody=document.body.style.overflow,prevHtml=document.documentElement.style.overflow;
  document.body.style.overflow="hidden";document.documentElement.style.overflow="hidden";
  const resize=()=>{setPageSize(window.innerWidth>=950?8:4);};
  resize();window.addEventListener("resize",resize);
  return ()=>{document.body.style.overflow=prevBody;document.documentElement.style.overflow=prevHtml;window.removeEventListener("resize",resize);};
 },[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){if(menuOpen)setMenuOpen(false);else if(selected)setSelected("");}};
  window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
 },[menuOpen,selected]);

 const section=sections.find(s=>s.id===selected);
 const detail=section?detailed[section.id]:undefined;
 const lastPage=Math.max(0,Math.ceil(sections.length/pageSize)-1);
 const safePage=Math.min(page,lastPage);
 const visible=sections.slice(safePage*pageSize,(safePage+1)*pageSize);
 const open=(id:string)=>{
  setSelected(id);setTab("overview");setServiceIdx(0);setTrackIdx(0);setTeamIdx(0);setDocIdx(0);setMarketingPage(0);setCallPage(0);setServicePart("scope");setMenuOpen(false);
  setPage(Math.floor(sections.findIndex(x=>x.id===id)/pageSize));
 };
 const setMarketLevel=(lv:MarketLevel)=>{
  setLevel(lv);const m:Market=lv==="bg"?"BG":"EU";setMarket(m);
  setSpent({...marketConfig[m].defaultSpend});setVideoPrice(marketConfig[m].video);
  setStaffFte({});setStaffPrices({});
  if(lv==="eu"){setTwilioEnabled(true);setCallCounts({bg:200,es:350,eu:200});}
  else {setTwilioEnabled(false);setCallCounts({bg:200,es:0,eu:0});}
 };
 const costRows=useMemo(()=>sections.flatMap(s=>s.services.map((item,i)=>{
   const id=s.id+"."+String(i+1).padStart(2,"0");
   const base=lineCost(s,item,i),cost={...base,...costOverrides[id]};
   return {id,section:s,service:item,cost,active:activeOverrides[id]??enabledByLevel(cost,level)};
 })),[costOverrides,activeOverrides,level]);
 const updateCost=(key:string,k:CostField,value:number)=>setCostOverrides(v=>({...v,[key]:{...v[key],[k]:value}}));
 const marketingCfg=marketConfig[market];
 const adMonthly=channels.reduce((n,c)=>n+spent[c],0);
 const videoMonthly=videoCount*videoPrice;
 const staffMarketing=sales*marketingCfg.staff.sales+support*marketingCfg.staff.support+marketers*marketingCfg.staff.marketing;
 const toolsMonthly=workspaceSeats*6.8+seo+crm+phoneTools;
 const roster=staffByLevel[level].map(x=>({id:x.id,name:x.name,fte:staffFte[x.id]??x.count,price:staffPrices[x.id]??x.monthly}));
 const personnel=roster.reduce((n,x)=>n+x.fte*x.price,0)+staffMarketing;
 const twilioMonthly=twilioEnabled?twilioBase+callMinutes*(callCounts.bg*callRates.bg+callCounts.es*callRates.es+callCounts.eu*callRates.eu):0;
 const setupOut=costRows.reduce((n,x)=>n+(x.active?x.cost.startupOther:0),0);
 const initMitko=costRows.reduce((n,x)=>n+(x.active?x.cost.initMitko:0),0);
 const initBorko=costRows.reduce((n,x)=>n+(x.active?x.cost.initBorko:0),0);
 const monthlyOut=costRows.reduce((n,x)=>n+(x.active?x.cost.monthlyOther:0),0);
 const monthlyMHours=costRows.reduce((n,x)=>n+(x.active?x.cost.monthlyMitko:0),0);
 const monthlyBHours=costRows.reduce((n,x)=>n+(x.active?x.cost.monthlyBorko:0),0);
 const laborInit=initMitko*hourM+initBorko*hourB, laborMonth=monthlyMHours*hourM+monthlyBHours*hourB;
 const setupBase=setupOut+laborInit,monthBase=monthlyOut+laborMonth+adMonthly+videoMonthly+toolsMonthly+personnel+twilioMonthly;
 const setupQuote=setupBase*(1+reserve/100)+laborInit*markup/100;
 const monthlyQuote=monthBase*(1+reserve/100)+laborMonth*markup/100;
 const selectedCost=section?costRows.filter(x=>x.section.id===section.id):[];
 const selectedItem=selectedCost[Math.min(serviceIdx,Math.max(0,selectedCost.length-1))];
 const currentCosts=selectedCost.filter(x=>x.active).reduce((n,x)=>({setup:n.setup+x.cost.startupOther+x.cost.initMitko*hourM+x.cost.initBorko*hourB,monthly:n.monthly+x.cost.monthlyOther+x.cost.monthlyMitko*hourM+x.cost.monthlyBorko*hourB}),{setup:0,monthly:0});
 const tabs=nav([{id:"overview",label:"План"},{id:"services",label:"Услуги"},{id:"tasks",label:"Задачи"},{id:"team",label:"Екип"},{id:"finance",label:"Цена"},...(selected==="02"?[{id:"marketing" as const,label:"Реклама"}]:[]),...(selected==="07"?[{id:"phone" as const,label:"Twilio"}]:[]),{id:"docs",label:"Документи"}]);
 const changeTab=(t:Area)=>{setTab(t);setServicePart("scope");};

 const share=(sectionId:string)=>sectionId==="02";
 const channel=channels[Math.min(3,marketingPage)],channelSpend=spent[channel];
 const lows=channel==="search"?channelSpend/marketingCfg.cpc.search[1]:(channelSpend/marketingCfg.cpm[channel][1])*1000;
 const highs=channel==="search"?channelSpend/marketingCfg.cpc.search[0]:(channelSpend/marketingCfg.cpm[channel][0])*1000;
 const fmtRange=nf(lows)+" – "+nf(highs);
 const currentCall=(["bg","es","eu"] as const)[Math.min(2,callPage)];
 const callLabel={bg:"България",es:"Испания",eu:"Други държави от ЕС"}[currentCall];
 const updateSpend=(c:Channel,n:number)=>setSpent(v=>({...v,[c]:n}));
 const activeService=(key:string)=>setActiveOverrides(v=>({...v,[key]:!selectedItem?.active}));
 const goPage=(n:number)=>{setSelected("");setPage(Math.max(0,Math.min(lastPage,n)));};

 return <main className="zf-root" lang="bg" aria-label="SOULFLAME бизнес план без скрол">
   <header className="zf-header">
     <button className="zf-brand" onClick={()=>{setMenuOpen(true);setSelected("");}} type="button" aria-label="SOULFLAME меню">SOULFLAME <span>☰</span></button>
     <span className="zf-header-label">{selected?section?.title:"16 бизнес направления"}</span>
     <a className="zf-home" href="/" aria-label="Към ENCHEV AUCTIONS">← ENCHEV</a>
   </header>

   <section className="zf-stage" aria-label="Карти на бизнес плана">
    <div className="zf-grid">
     {visible.map(s=><button key={s.id} className="zf-card" onClick={()=>open(s.id)} type="button" aria-label={"Отвори "+s.title}>
       <div className="zf-card-index"><span>{s.icon}</span><small>{s.id}/16</small></div>
       <strong>{s.title}</strong><small className="zf-card-description">{s.tagline}</small>
       <span className="zf-card-open">ПОДРОБНОСТИ <b>＋</b></span>
     </button>)}
     {section&&<article className="zf-expanded" role="region" aria-label={"Подробности за "+section.title}>
      <div className="zf-exp-title"><button onClick={()=>setSelected("")} type="button" aria-label="Затвори избрания раздел">‹ Карти</button><div><span>{section.id} / 16</span><h1>{section.title}</h1></div><button onClick={()=>setSelected("")} className="zf-close" type="button" aria-label="Затвори">×</button></div>
      <nav className="zf-tabs" aria-label="Съдържание на раздела">{tabs.map(t=><button type="button" key={t.id} className={tab===t.id?"active":""} onClick={()=>changeTab(t.id)} aria-current={tab===t.id?"page":undefined}>{t.label}</button>)}</nav>
      <div className="zf-panel">
       {tab==="overview"&&<div className="zf-panel-content zf-overview">
         <span className="zf-kicker">МИСИЯ И ЕТАПИ</span><h2>{section.goal}</h2>
         <div className="zf-bullet-stack">{section.steps.map((step,i)=><p key={i}><b>{i+1<10?"0"+(i+1):i+1}</b>{step}</p>)}</div>
         <div className="zf-notice">{section.risk}</div>
       </div>}
       {tab==="services"&&selectedItem&&<div className="zf-panel-content zf-service">
         <div className="zf-subhead"><span className="zf-kicker">УСЛУГА {selectedItem.id}</span><div className="zf-chips"><button className={servicePart==="scope"?"on":""} onClick={()=>setServicePart("scope")}>Обхват</button><button className={servicePart==="cost"?"on":""} onClick={()=>setServicePart("cost")}>Цени и труд</button></div></div>
         <h2>{selectedItem.service.name}</h2>
         {servicePart==="scope"?<><p>{selectedItem.service.detail}</p><div className="zf-service-facts"><div><span>ИЗПЪЛНИТЕЛ</span><b>{selectedItem.service.team}</b></div><div><span>ЕТАП</span><b>{selectedItem.cost.stage==="eu"?"Ниво 2 · Европа":selectedItem.cost.stage==="future"?"Бъдещо":"Ниво 1 · България"}</b></div></div><p className="zf-muted">Ориентировъчни предложени цени без ДДС.</p></>
          :<><div className="zf-service-facts"><div><span>ПЪРВОНАЧАЛНА ОФЕРТА</span><b>{euro(selectedItem.service.setup[0])} – {euro(selectedItem.service.setup[1])}</b></div><div><span>МЕСЕЧЕН ДИАПАЗОН</span><b>{euro(selectedItem.service.monthly[0])} – {euro(selectedItem.service.monthly[1])}</b></div></div>
          <div className="zf-two-fields"><Num label="Външни разходи · старт (€)" value={selectedItem.cost.startupOther} onChange={x=>updateCost(selectedItem.id,"startupOther",x)}/><Num label="Външни разходи · месечно (€)" value={selectedItem.cost.monthlyOther} onChange={x=>updateCost(selectedItem.id,"monthlyOther",x)}/></div>
          <div className="zf-service-facts zf-compact-facts"><div><span>МОЙ ТРУД · СТАРТ</span><b>{selectedItem.cost.initMitko} ч. × {euro(hourM)}</b></div><div><span>ТРУД БОРКО · СТАРТ</span><b>{selectedItem.cost.initBorko} ч. × {euro(hourB)}</b></div></div>
          <label className="zf-opt"><input type="checkbox" disabled={selectedItem.cost.stage==="future"} checked={selectedItem.active} onChange={()=>activeService(selectedItem.id)}/> Включи тази услуга в общата сметка</label></>}
        </div>}
       {tab==="tasks"&&detail&&<div className="zf-panel-content zf-tasks">
         <span className="zf-kicker">КОНКРЕТНО ИЗПЪЛНЕНИЕ</span>
         <h2>{detail.tracks[trackIdx]?.name}</h2>
         <div className="zf-bullet-stack">{detail.tracks[trackIdx]?.tasks.map((task,i)=><p key={i}><b>✓</b>{task}</p>)}</div>
         <p className="zf-proof"><b>Приемане:</b> {detail.tracks[trackIdx]?.proof}</p>
       </div>}
       {tab==="team"&&section&&<div className="zf-panel-content zf-team">
         <span className="zf-kicker">ХОРА И ОТГОВОРНОСТИ</span>
         <h2>Енчев → Митко и Борко → нашите екипи</h2>
         <div className="zf-role"><span>ИЗПЪЛНИТЕЛ {teamIdx+1} / {section.team.length}</span><strong>{section.team[teamIdx]}</strong></div>
         <div className="zf-service-facts zf-compact-facts"><div><span>МИТКО</span><b>Управление и стратегия</b></div><div><span>БОРКО</span><b>Разработка и инженеринг</b></div></div>
         <p className="zf-muted">Правомощията и възнагражденията се определят писмено. Постоянният персонал е включен веднъж в общата цена.</p>
       </div>}
       {tab==="finance"&&<div className="zf-panel-content zf-finance">
         <span className="zf-kicker">ПЪЛНА КОНСОЛИДИРАНА СМЕТКА</span>
         <div className="zf-level"><button className={level==="bg"?"on":""} onClick={()=>setMarketLevel("bg")}>Ниво 1 · България</button><button className={level==="eu"?"on":""} onClick={()=>setMarketLevel("eu")}>Ниво 2 · Европа</button></div>
         <div className="zf-finance-kpis"><div><span>ЕДНОКРАТНО ЗА ВСИЧКО</span><strong>{euro(setupQuote)}</strong></div><div><span>ОБЩО МЕСЕЧНО</span><strong>{euro(monthlyQuote)}</strong></div><div><span>ПЪРВИ 12 МЕСЕЦА</span><strong>{euro(setupQuote+monthlyQuote*12)}</strong></div></div>
         <div className="zf-finance-tabs"><button className={servicePart==="scope"?"on":""} onClick={()=>setServicePart("scope")}>Разбивка</button><button className={servicePart==="cost"?"on":""} onClick={()=>setServicePart("cost")}>Моят труд</button></div>
         {servicePart==="scope"?
          <div className="zf-cost-rows"><p>Нашите хора <b>{euro(personnel)} / мес.</b></p><p>Реклама + видео <b>{euro(adMonthly+videoMonthly)} / мес.</b></p><p>Софтуер, външни услуги и Twilio <b>{euro(toolsMonthly+monthlyOut+twilioMonthly)} / мес.</b></p><p>Труд Митко и Борко <b>{euro(laborMonth)} / мес.</b></p></div>
          :<div className="zf-cost-editor"><Num label="Митко €/час" value={hourM} onChange={setHourM}/><Num label="Борко €/час" value={hourB} onChange={setHourB}/><Num label="Резерв %" value={reserve} max={100} onChange={setReserve}/><Num label="Надценка върху труд %" value={markup} max={200} onChange={setMarkup}/></div>}
         <p className="zf-muted">Цените са сценарни без ДДС. Включен е трудът на екипите само веднъж. Няма покупка на автовози или гарантирана печалба.</p>
       </div>}
       {tab==="marketing"&&<div className="zf-panel-content zf-marketing">
         <span className="zf-kicker">РЕАЛЕН МАРКЕТИНГ · МОДЕЛИРАН БЮДЖЕТ</span>
         <div className="zf-market-select"><button onClick={()=>{setMarket("BG");setSpent({...marketConfig.BG.defaultSpend});setVideoPrice(marketConfig.BG.video);}}>България</button><button onClick={()=>{setMarket("ES");setSpent({...marketConfig.ES.defaultSpend});setVideoPrice(marketConfig.ES.video);}}>Испания</button><button onClick={()=>{setMarket("EU");setSpent({...marketConfig.EU.defaultSpend});setVideoPrice(marketConfig.EU.video);}}>ЕС</button><span>{market}</span></div>
         {marketingPage<4?
          <><h2>{channelNames[channel]}</h2><Num label="Рекламен бюджет / месец (€)" value={channelSpend} onChange={n=>updateSpend(channel,n)}/>
          <div className="zf-service-facts zf-compact-facts"><div><span>{channel==="search"?"МОДЕЛНИ КЛИКОВЕ":"МОДЕЛНИ ПОКАЗВАНИЯ"}</span><b>{fmtRange}</b></div><div><span>САМО ТАЗИ ПЛАТФОРМА</span><b>{euro(channelSpend)}/мес.</b></div></div>
          <p className="zf-muted">Показвания ≠ уникални хора. Прогнозата е по условни CPM/CPC, не от Ads Manager. Рекламите не гарантират клиенти.</p></>
         :marketingPage===4?
          <><h2>Видео, Reels, Shorts</h2><div className="zf-two-fields"><Num label="Брой видеа / мес." value={videoCount} max={200} onChange={setVideoCount}/><Num label="Труд и монтаж / видео (€)" value={videoPrice} onChange={setVideoPrice}/></div>
          <div className="zf-service-facts zf-compact-facts"><div><span>ВИДЕА ОБЩО</span><b>{videoCount}</b></div><div><span>ПРОИЗВОДСТВО НА МЕСЕЦ</span><b>{euro(videoMonthly)}</b></div></div></>
         :marketingPage===5?
          <><h2>Търговци, Support, Marketing</h2><div className="zf-two-fields"><Num label="Sales хора" value={sales} max={100} onChange={setSales}/><Num label="Support хора" value={support} max={100} onChange={setSupport}/><Num label="Marketing хора" value={marketers} max={100} onChange={setMarketers}/><Num label="Google Workspace акаунти" value={workspaceSeats} max={250} onChange={setWorkspaceSeats}/></div></>
         :<><h2>Общ месечен маркетинг</h2><div className="zf-cost-rows"><p>Реклами <b>{euro(adMonthly)}</b></p><p>Видеа <b>{euro(videoMonthly)}</b></p><p>Хора <b>{euro(staffMarketing)}</b></p><p>Google Workspace, SEO, CRM, телефония <b>{euro(toolsMonthly)}</b></p><p><strong>Общо</strong><b>{euro(adMonthly+videoMonthly+staffMarketing+toolsMonthly)}</b></p></div></>}
       </div>}
       {tab==="phone"&&<div className="zf-panel-content zf-phone">
         <span className="zf-kicker">TWILIO · МЕЖДУНАРОДНИ РАЗГОВОРИ</span>
         <h2>{callLabel}</h2>
         <label className="zf-opt"><input type="checkbox" checked={twilioEnabled} onChange={e=>setTwilioEnabled(e.target.checked)}/> Включи Twilio в общата сметка</label>
         <div className="zf-two-fields"><Num label="Обаждания / месец" value={callCounts[currentCall]} onChange={n=>setCallCounts(v=>({...v,[currentCall]:n}))}/><Num label="Примерна тарифа €/минута" step={.01} max={10} value={callRates[currentCall]} onChange={n=>setCallRates(v=>({...v,[currentCall]:n}))}/><Num label="Минути / обаждане" value={callMinutes} max={120} onChange={setCallMinutes}/><Num label="Платформа / мес. (€)" value={twilioBase} onChange={setTwilioBase}/></div>
         <div className="zf-service-facts zf-compact-facts"><div><span>ТАЗИ ДЪРЖАВА / МЕС.</span><b>{euro(callCounts[currentCall]*callMinutes*callRates[currentCall])}</b></div><div><span>ВСИЧКИ РАЗГОВОРИ</span><b>{euro(twilioMonthly)}</b></div></div>
         <p className="zf-muted">Примерни тарифи; действителните такси са според Twilio, маршрути, номера и законен B2B контакт. Няма активни обаждания.</p>
       </div>}
       {tab==="docs"&&detail&&<div className="zf-panel-content zf-docs">
         <span className="zf-kicker">MASTER SYSTEM И ДОКУМЕНТАЦИЯ</span>
         <h2>{masterSources[docIdx].label}</h2>
         <p>{masterSources[docIdx].desc}</p>
         <a className="zf-doc-link" href={masterSources[docIdx].href} target="_blank" rel="noreferrer">Отвори документа ↗</a>
         <div className="zf-notice">Свързани фази: {detail.phases.map(x=>"P"+x).join(" · ")}. Документите не доказват, че задачите са завършени.</div>
       </div>}
      </div>
      <div className="zf-detail-footer">
       {tab==="services"?<PageArrows at={serviceIdx} total={selectedCost.length} onChange={n=>{setServiceIdx(n);setServicePart("scope");}} label="Услуги"/>:
        tab==="tasks"&&detail?<PageArrows at={trackIdx} total={detail.tracks.length} onChange={setTrackIdx} label="Задачи"/>:
        tab==="team"?<PageArrows at={teamIdx} total={section.team.length} onChange={setTeamIdx} label="Екип"/>:
        tab==="marketing"?<PageArrows at={marketingPage} total={7} onChange={setMarketingPage} label="Маркетинг"/>:
        tab==="phone"?<PageArrows at={callPage} total={3} onChange={setCallPage} label="Държава"/>:
        tab==="docs"?<PageArrows at={docIdx} total={masterSources.length} onChange={setDocIdx} label="Документи"/>:
        <div className="zf-pager zf-static-footer"><span>SOULFLAME · {section.id}/16</span><button onClick={()=>changeTab("services")}>Виж услуги ›</button></div>}
      </div>
     </article>}
    </div>
   </section>
   <footer className="zf-bottom">
     {!selected?<><PageArrows at={safePage} total={lastPage+1} onChange={goPage} label="Раздели"/><div className="zf-dots" aria-hidden="true">{Array.from({length:lastPage+1},(_,i)=><i className={i===safePage?"active":""} key={i}/>)}</div></>:
       <div className="zf-bottom-note">Без скрол · Подробностите са в избраната карта</div>}
   </footer>

   {menuOpen&&<div className="zf-menu-shade" role="presentation"><div className="zf-menu-modal" role="dialog" aria-modal="true" aria-label="Меню SoulFlame">
     <header><b>SOULFLAME</b><button onClick={()=>setMenuOpen(false)} aria-label="Затвори менюто">×</button></header>
     <div className="zf-menu-grid">{visible.map(s=><button key={s.id} onClick={()=>open(s.id)}><span>{s.id}</span><b>{s.title}</b></button>)}</div>
     <PageArrows at={safePage} total={lastPage+1} onChange={goPage} label="Меню"/>
     <button className="zf-menu-close" onClick={()=>setMenuOpen(false)}>Затвори</button>
   </div></div>}
  </main>;
}
