"use client";

import {useEffect,useMemo,useState} from "react";
import {stage1Areas} from "./stage1-data";
import type {Stage1Offer} from "./stage1-data";
import "./stage1-business-plan.css";

type Override=Partial<Pick<Stage1Offer,"setupExpense"|"setupLabor"|"monthlyExpense"|"monthlyLabor"|"enabled">>;
type MoneyKey="setupExpense"|"setupLabor"|"monthlyExpense"|"monthlyLabor";
const euros=(number:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(number);
const toNumber=(v:string)=>Math.max(0,Math.min(1000000,Number(v)||0));
const aggregate=(offers:Stage1Offer[])=>offers.reduce((total,item)=>({
  setupExpense:total.setupExpense+(item.enabled?item.setupExpense:0),
  setupLabor:total.setupLabor+(item.enabled?item.setupLabor:0),
  monthlyExpense:total.monthlyExpense+(item.enabled?item.monthlyExpense:0),
  monthlyLabor:total.monthlyLabor+(item.enabled?item.monthlyLabor:0)
}),{setupExpense:0,setupLabor:0,monthlyExpense:0,monthlyLabor:0});

function MoneyInput({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){
  return <label className="s1-money-field"><span>{label}</span><div><input type="number" min="0" max="1000000" step="10" value={value} onChange={event=>onChange(toNumber(event.target.value))} aria-label={label}/><small>€</small></div></label>;
}
function Pager({at,total,change,label}:{at:number;total:number;change:(n:number)=>void;label:string}){
  return <div className="s1-pager" aria-label={label}>
    <button type="button" onClick={()=>change(at-1)} disabled={at===0}>‹ Назад</button>
    <span>{label} · {at+1} / {Math.max(total,1)}</span>
    <button type="button" onClick={()=>change(at+1)} disabled={at+1>=total}>Напред ›</button>
  </div>;
}
export default function StageOneBusinessPlan(){
  const [categoryPage,setCategoryPage]=useState(0);
  const [activeCategory,setActiveCategory]=useState<string|null>(null);
  const [expandedOffer,setExpandedOffer]=useState<string|null>(null);
  const [includeDescription,setIncludeDescription]=useState(false);
  const [editPrices,setEditPrices]=useState(false);
  const [overrides,setOverrides]=useState<Record<string,Override>>({});

  useEffect(()=>{
    const oldBody=document.body.style.overflow,oldHtml=document.documentElement.style.overflow;
    document.body.style.overflow="hidden";document.documentElement.style.overflow="hidden";
    return ()=>{document.body.style.overflow=oldBody;document.documentElement.style.overflow=oldHtml;};
  },[]);

  const current=stage1Areas.find(x=>x.id===activeCategory);
  const normalized=useMemo(()=>stage1Areas.map(area=>({
    ...area,
    offers:area.offers.map(item=>({...item,...overrides[item.id]}))
  })),[overrides]);
  const currentOffers=normalized.find(x=>x.id===activeCategory)?.offers||[];
  const areaTotal=aggregate(currentOffers);
  const allTotal=aggregate(normalized.flatMap(x=>x.offers));
  const visibleCategories=stage1Areas.slice(categoryPage*4,(categoryPage+1)*4);

  const selectCategory=(id:string)=>{
    setActiveCategory(id);
    setIncludeDescription(false);setEditPrices(false);
    const area=stage1Areas.find(x=>x.id===id);
    setExpandedOffer(area?.offers[0]?.id||null);
  };
  const save=(id:string,key:MoneyKey,value:number)=>setOverrides(prev=>({...prev,[id]:{...prev[id],[key]:value}}));
  const toggle=(id:string,value:boolean)=>setOverrides(prev=>({...prev,[id]:{...prev[id],enabled:value}}));
  const chooseOffer=(id:string)=>{
    setExpandedOffer(current=>current===id?null:id);
    setIncludeDescription(false);
    setEditPrices(false);
  };

  return <main className="s1-root" lang="bg">
    <header className="s1-header">
      <div className="s1-brand"><span className="s1-mark">◈</span> БИЗНЕС ПЛАН <span className="s1-stage">ЕТАП 1 · БЪЛГАРИЯ</span></div>
      <a href="/" className="s1-back" aria-label="Към началната страница">← Сайт</a>
    </header>

    <section className="s1-screen" aria-label="Бизнес план етап 1">
      <div className="s1-grid">
        {visibleCategories.map(category=><button type="button" className="s1-category" key={category.id} onClick={()=>selectCategory(category.id)} aria-label={"Отвори "+category.title}>
          <div className="s1-category-line"><span className="s1-icon">{category.icon}</span><small>{category.id}/16</small></div>
          <strong>{category.title}</strong>
          <p>{category.tag}</p>
          <div className="s1-category-open">ОТВОРИ <span>＋</span></div>
        </button>)}

        {current&&<div className="s1-overlay" role="region" aria-label={"Разгънат раздел "+current.title}>
          <div className="s1-accordion">
            <div className="s1-accordion-head">
              <div className="s1-accordion-title">
                <button type="button" className="s1-close" onClick={()=>setActiveCategory(null)} aria-label="Затвори раздела">←</button>
                <span className="s1-icon">{current.icon}</span>
                <h1>{current.title}</h1>
              </div>
              <button className="s1-dismiss" type="button" onClick={()=>setActiveCategory(null)} aria-label="Затвори">×</button>
            </div>
            <div className="s1-caption">Етап 1 · България · {currentOffers.length} услуги</div>
            <div className="s1-divider"/>
            <div className="s1-offer-list" role="list" aria-label={"Всички "+currentOffers.length+" услуги в раздел "+current.title}>
              {currentOffers.map(offer=><article className={"s1-offer "+(expandedOffer===offer.id?"s1-offer-expanded":"")} key={offer.id}>
                <button type="button" className="s1-offer-trigger" onClick={()=>chooseOffer(offer.id)} aria-expanded={expandedOffer===offer.id}>
                  <strong>{offer.title}</strong><span className="s1-caret">{expandedOffer===offer.id?"⌃":"›"}</span>
                </button>
                {expandedOffer===offer.id&&<div className="s1-offer-detail">
                  <p className="s1-desc">{offer.description}</p>
                  <button className="s1-more" type="button" onClick={()=>{setIncludeDescription(v=>!v);setEditPrices(false);}}>{includeDescription?"← Покажи цените":"+ Какво включва"}</button>
                  {includeDescription?<div className="s1-includes">{offer.includes.slice(0,3).map((item,i)=><div key={i}><span>✓</span>{item}</div>)}</div>:
                    editPrices?<div className="s1-edit-grid">
                      <MoneyInput label="Месечен бюджет" value={offer.monthlyExpense} onChange={n=>save(offer.id,"monthlyExpense",n)}/>
                      <MoneyInput label="Месечен труд" value={offer.monthlyLabor} onChange={n=>save(offer.id,"monthlyLabor",n)}/>
                      <MoneyInput label="Начални разходи" value={offer.setupExpense} onChange={n=>save(offer.id,"setupExpense",n)}/>
                      <MoneyInput label="Начален труд" value={offer.setupLabor} onChange={n=>save(offer.id,"setupLabor",n)}/>
                    </div>:
                    <div className="s1-cost">
                      <div><span>{offer.expenseLabel}</span><b>{euros(offer.monthlyExpense)}/месец</b></div>
                      <div><span>Наш труд</span><b>{euros(offer.monthlyLabor)}/месец</b></div>
                      <div className="s1-cost-total"><strong>Общо</strong><b>{euros(offer.monthlyExpense+offer.monthlyLabor)}/месец</b></div>
                    </div>}
                  <div className="s1-cost-footer">
                    <span>Първоначално: <b>{euros(offer.setupExpense+offer.setupLabor)}</b></span>
                    <label><input type="checkbox" checked={offer.enabled} onChange={e=>toggle(offer.id,e.target.checked)}/> Включи</label>
                  </div>
                  {!includeDescription&&<button className="s1-edit" type="button" onClick={()=>setEditPrices(x=>!x)}>{editPrices?"← Покажи цените":"✎ Редактирай разходите"}</button>}
                </div>}
              </article>)}
            </div>
            <div className="s1-offer-footer">
              <div className="s1-area-total"><span>Общо за раздела</span><b>{euros(areaTotal.monthlyExpense+areaTotal.monthlyLabor)}/месец</b></div>
            </div>
          </div>
        </div>}
      </div>
    </section>

    <footer className="s1-footer">
      {!current?<Pager at={categoryPage} total={4} change={setCategoryPage} label="Раздели"/>:
        <div className="s1-total-row"><span>Общо Етап 1 · всички включени услуги</span><b>{euros(allTotal.monthlyExpense+allTotal.monthlyLabor)}/месец</b></div>}
      <span className="s1-disclaimer">Примерни цени без ДДС · не са одобрени оферти</span>
    </footer>
  </main>;
}
