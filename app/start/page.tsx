"use client";

import {FormEvent,useEffect,useState} from "react";
import EaOfficialLogo from "../components/EaOfficialLogo";
import {PUBLIC_EARLY_ACCESS_ENABLED} from "../config/early-access";
import "./start.css";

type Locale="bg"|"en";
type IconKey="user"|"shield"|"car"|"gavel"|"trophy"|"card"|"truck"|"play"|"check"|"chevron"|"headset"|"sun"|"moon"|"arrow"|"close";
const strokes:Record<IconKey,string>={
 user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2",
 shield:"m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6zM8 12l3 3 5-6",
 car:"M4 16h16l-2-7H6zM7 9l1-4h8l1 4M5 16v3m14-3v3",
 gavel:"m14 3 7 7M12 5l7 7M7 10l7 7M3 14l7 7M9 9l6-6 6 6-6 6z",
 trophy:"M7 4h10v8a5 5 0 0 1-10 0V4ZM7 6H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 17v4M8 21h8",
 card:"M3 5h18v14H3zM3 10h18M7 15h4",
 truck:"M3 5h12v11H3zM15 9h4l3 4v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
 play:"m8 5 11 7-11 7z",
 check:"m5 12 4 4L19 6",
 chevron:"m9 18 6-6-6-6",
 headset:"M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v7H4zM17 13h3v7h-3zM17 21h-4",
 sun:"M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 moon:"M20 15.7A8.8 8.8 0 0 1 8.3 4 8.8 8.8 0 1 0 20 15.7Z",
 arrow:"M5 12h14m-6-6 6 6-6 6",
 close:"M5 5l14 14M19 5 5 19"
};
function I({name,size=22}:{name:IconKey;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={strokes[name]}/></svg>;}

type Step={icon:IconKey;href:string;title:{bg:string;en:string};description:{bg:string;en:string};detail:{bg:string;en:string};state:{bg:string;en:string}};
const steps:Step[]=[
 {icon:"user",href:"/register",title:{bg:"Регистрация",en:"Registration"},description:{bg:"Създай личен или фирмен профил.",en:"Create a personal or business account."},detail:{bg:"Регистрирай личен или фирмен акаунт, потвърди имейла си и влез сигурно в профила.",en:"Create an individual or business account, verify your email and sign in securely."},state:{bg:"Регистрацията зависи от активацията на услугата.",en:"Registration depends on service activation."}},
 {icon:"shield",href:"/verification",title:{bg:"Потвърждение",en:"Verification"},description:{bg:"Самоличност и допускане.",en:"Identity and buyer eligibility."},detail:{bg:"Попълни необходимите данни за идентификация (KYC/KYB). Ако за конкретен търг се изисква депозит, той се плаща само след официално потвърждение.",en:"Complete identity/business checks. Any deposit is payable only after an approved official request."},state:{bg:"Проверката и депозитите още не са активирани.",en:"Verification and deposits are not yet enabled."}},
 {icon:"car",href:"/vehicles",title:{bg:"Избор на автомобил",en:"Choose a car"},description:{bg:"Снимки, история и VIN.",en:"Photos, history and VIN."},detail:{bg:"Разгледай каталога и данните за всеки одобрен автомобил: снимки, VIN, състояние, история и документи, когато са предоставени.",en:"Explore approved listings, images, VIN, condition, history and available seller documents."},state:{bg:"Каталогът показва само потвърдени реални лотове.",en:"The catalogue shows only approved real listings."}},
 {icon:"gavel",href:"/auctions",title:{bg:"Наддаване",en:"Live auction"},description:{bg:"Участвай в LIVE търг.",en:"Take part in a LIVE auction."},detail:{bg:"След одобрение за участие можеш да наддаваш в реален търг с ясни правила, стъпки за оферта и сървърен таймер.",en:"After approval, bid in live auctions with transparent rules and a server-controlled clock."},state:{bg:"Понастоящем има демонстрация, а не реални парични оферти.",en:"Current bidding is a demo, not a real-money auction."}},
 {icon:"trophy",href:"/my-auctions",title:{bg:"Спечелване",en:"Winning"},description:{bg:"Резултат и поръчка.",en:"Result and buyer order."},detail:{bg:"При официално потвърден победител се създава поръчка с финална цена и информация за следващите действия в профила.",en:"When a winning bid is confirmed, a buyer order contains the final amount and next steps."},state:{bg:"Нужен е действителен завършен търг.",en:"Requires a completed real auction."}},
 {icon:"card",href:"/payments",title:{bg:"Плащане",en:"Payment"},description:{bg:"Фактура и документи.",en:"Invoice and documents."},detail:{bg:"Плащането става само срещу проверена поръчка и фактура. Плащане с карта или Revolut ще бъде възможно след официално активиране.",en:"Pay only against a verified order and invoice. Card and Revolut options depend on official activation."},state:{bg:"Реалните плащания не са активирани.",en:"Real payments are not enabled."}},
 {icon:"truck",href:"/transport",title:{bg:"Доставка",en:"Delivery"},description:{bg:"Транспорт и получаване.",en:"Transport and collection."},detail:{bg:"Заяви оферта за транспорт, планирай товарене и получи документите за доставка и предаване на автомобила.",en:"Request a transport quote, organize collection and receive delivery and handover documentation."},state:{bg:"Наличен е демонстрационен калкулатор.",en:"A demonstration estimator is available."}}
];
const faq=[
 {q:{bg:"Какъв депозит е необходим?",en:"Is a deposit required?"},a:{bg:"Размерът и условията за депозит се определят за конкретния търг. Не превеждай средства без официална проверена платежна заявка. Депозитната система още не е активирана.",en:"Deposit rules depend on the specific auction. Never pay without an official verified request. Deposits are not yet enabled."}},
 {q:{bg:"Как се извършва плащането?",en:"How do payments work?"},a:{bg:"След потвърдена покупка ще се издава фактура и ще се посочват разрешените методи на плащане. В момента реалните плащания са изключени.",en:"A confirmed purchase will receive an invoice and approved payment methods. Real payments are currently disabled."}},
 {q:{bg:"Колко време отнема доставката?",en:"How long does delivery take?"},a:{bg:"Срокът зависи от държавата, маршрута, превозвача и готовността на автомобила. Транспортният отдел изготвя индивидуална оферта.",en:"Delivery time depends on location, route, carrier and vehicle readiness. A quote is prepared individually."}}
];
const copy={
 bg:{hero:"КАК СЕ",accent:"КУПУВА",eyebrow:"СТЪПКА ПО СТЪПКА",lead:"Лесен, сигурен и прозрачен процес за покупка на автомобил от търг.",guide:"Виж процеса стъпка по стъпка",benefits:"Какво получаваш?",benefitList:["Информация за одобрените автомобили","Прозрачни правила за наддаване","Проверени заявки за плащане","Съдействие за транспорт и документи","Поддръжка на български език"],faq:"Често задавани въпроси",help:"Нуждаеш се от помощ?",helpText:"Съдействие във всяка стъпка.",contact:"Свържи се с нас",more:"Разгледай стъпката",early:"Ранен достъп",email:"Имейл адрес",consent:"Съгласен/съгласна съм да получа информация за ранния достъп.",submit:"Запиши ме",sending:"Изпращане…",confirmed:"Заявката за ранен достъп е приета. Това не е регистрация за реален търг.",disclaimer:"ДЕМО РЕЖИМ · Реалните наддавания, депозити и плащания още не са активирани.",prev:"Назад",next:"Следваща",done:"Готово"},
 en:{hero:"HOW TO",accent:"BUY",eyebrow:"STEP BY STEP",lead:"A clear and secure journey from finding a vehicle to collection.",guide:"Explore the buying process",benefits:"What do you get?",benefitList:["Information about approved vehicles","Clear bidding rules","Verified payment requests","Transport and document support","Buyer assistance"],faq:"Frequently asked questions",help:"Need assistance?",helpText:"Support at every step.",contact:"Contact support",more:"Open this step",early:"Early access",email:"Email address",consent:"I agree to receive updates about early access.",submit:"Join waitlist",sending:"Submitting…",confirmed:"Early access request received. This is not registration for a real auction.",disclaimer:"DEMO MODE · Real bidding, deposits and payments are not yet enabled.",prev:"Previous",next:"Next",done:"Done"}
} as const;

export default function BuyerStartPage(){
 const [locale,setLocale]=useState<Locale>("bg");
 const [appearance,setAppearance]=useState<"dark"|"light">("dark");
 const [guide,setGuide]=useState<number|null>(null);
 const [question,setQuestion]=useState<number|null>(null);
 const [early,setEarly]=useState(false);
 const [email,setEmail]=useState("");
 const [consent,setConsent]=useState(false);
 const [sending,setSending]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [success,setSuccess]=useState(false);
 const c=copy[locale];
 useEffect(()=>{
  try{const a=localStorage.getItem("ea-vehicles-appearance-v1");if(a==="dark"||a==="light")setAppearance(a);}catch{}
  const beforeHtml=document.documentElement.style.overflow;
  const beforeBody=document.body.style.overflow;
  document.documentElement.style.overflow="hidden";
  document.body.style.overflow="hidden";
  return()=>{document.documentElement.style.overflow=beforeHtml;document.body.style.overflow=beforeBody};
 },[]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){setGuide(null);setQuestion(null);setEarly(false);}
  };
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[]);
 function toggleAppearance(){
  const next=appearance==="dark"?"light":"dark";
  setAppearance(next);
  try{localStorage.setItem("ea-vehicles-appearance-v1",next)}catch{}
 }
 async function signup(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!PUBLIC_EARLY_ACCESS_ENABLED||sending||!consent||!email.trim())return;
  setSending(true);setFeedback("");setSuccess(false);
  try{
   const res=await fetch("/api/ea-early-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),consent:true,website:""})});
   const body=await res.json();
   if(!res.ok||body.ok!==true)throw new Error(typeof body.message==="string"?body.message:"Request not accepted");
   setSuccess(true);setFeedback(c.confirmed);setEmail("");setConsent(false);
  }catch(error){setFeedback(error instanceof Error?error.message:"Connection problem");}
  finally{setSending(false);}
 }
 return <main id="main-content" className="eaBuyViewport" data-appearance={appearance}>
  <div className="eaBuyShell">
   <header className="eaBuyHeader">
    <a href="/" className="eaBuyLogo" aria-label="E&A Начало"><EaOfficialLogo/></a>
    <nav className="eaBuyNav" aria-label="Основни раздели">
     <a href="/">{locale==="bg"?"Начало":"Home"}</a>
     <a href="/vehicles">{locale==="bg"?"Автомобили":"Vehicles"}</a>
     <a href="/auctions">LIVE</a>
     <a href="/vehicles#ea-market-catalog">{locale==="bg"?"Каталог":"Catalogue"}</a>
     <a href="/start" className="active" aria-current="page">{locale==="bg"?"Как се купува":"How to buy"}</a>
     <a href="/transport">{locale==="bg"?"Транспорт":"Transport"}</a>
     <a href="/support">{locale==="bg"?"Поддръжка":"Support"}</a>
    </nav>
    <div className="eaBuyHeaderTools">
     <div className="eaBuyLang" role="group" aria-label="Език"><button type="button" aria-pressed={locale==="bg"} onClick={()=>setLocale("bg")}>BG</button><button type="button" aria-pressed={locale==="en"} onClick={()=>setLocale("en")}>EN</button></div>
     <button className="eaBuyThemeButton" type="button" onClick={toggleAppearance} aria-label={appearance==="dark"?"Светъл режим":"Тъмен режим"}><I name={appearance==="dark"?"sun":"moon"} size={18}/></button>
     <a className="eaBuyProfile" href="/login" aria-label="Вход"><I name="user" size={20}/></a>
    </div>
   </header>
   <nav className="eaBuyMobileNav" aria-label="Бърза навигация"><a href="/vehicles">{locale==="bg"?"Автомобили":"Vehicles"}</a><a href="/auctions"><span className="eaBuyLiveDot"/> LIVE</a><a href="/vehicles#ea-market-catalog">{locale==="bg"?"Каталог":"Catalogue"}</a><a href="/start" className="active" aria-current="page">{locale==="bg"?"Как се купува":"How to buy"}</a></nav>
   <section className="eaBuyHero" aria-label={locale==="bg"?"Как се купува":"How to buy"}>
    <div className="eaBuyHeroContent"><span className="eaBuyEyebrow">{c.eyebrow}</span><h1>{c.hero}<br/><em>{c.accent}</em></h1><p>{c.lead}</p></div>
    <span className="eaBuyHeroCaption">E&A · EAST AND WEST AUCTIONEERS GROUP</span>
   </section>
   <section className="eaBuySteps" aria-label={locale==="bg"?"Седем стъпки за покупка":"Seven steps to buy"}>
    {steps.map((step,i)=><button type="button" onClick={()=>setGuide(i)} className="eaBuyStep" key={step.href} aria-label={(i+1)+". "+step.title[locale]+". "+step.description[locale]}>
      <span className="eaBuyStepNumber">{i+1}</span>
      <span className="eaBuyStepIcon"><I name={step.icon} size={29}/></span>
      <span className="eaBuyStepText"><strong>{step.title[locale]}</strong><small>{step.description[locale]}</small></span>
      <span className="eaBuyStepArrow" aria-hidden="true"><I name="chevron" size={15}/></span>
    </button>)}
   </section>
   <section className="eaBuyMid">
    <button className="eaBuyGuide" type="button" onClick={()=>setGuide(0)} aria-label={c.guide}>
      <span className="eaBuyGuideHeading">{c.guide}</span>
      <span className="eaBuyGuidePlay"><I name="play" size={25}/></span>
      <span className="eaBuyGuideBottom">01 — 07 <I name="arrow" size={19}/></span>
    </button>
    <div className="eaBuyBenefits">
     <h2>{c.benefits}</h2>
     <ul>{c.benefitList.map(item=><li key={item}><span className="eaBuyCheck"><I name="check" size={12}/></span><span>{item}</span></li>)}</ul>
    </div>
   </section>
   <section className="eaBuyBottom">
    <div className="eaBuyFaq"><h2>{c.faq}</h2><div className="eaBuyFaqList">{faq.map((item,i)=><button type="button" key={i} onClick={()=>setQuestion(i)}><span>{item.q[locale]}</span><I name="chevron" size={17}/></button>)}</div><button className="eaBuyFaqMobile" type="button" onClick={()=>setQuestion(0)}>{c.faq}<I name="chevron" size={18}/></button></div>
    <div className="eaBuyContact"><div className="eaBuyContactIcon"><I name="headset" size={29}/></div><div><h2>{c.help}</h2><p>{c.helpText}</p></div><a href="/support"><I name="headset" size={18}/>{c.contact}</a></div>
   </section>
   <footer className="eaBuyFoot"><span>{c.disclaimer}</span>{PUBLIC_EARLY_ACCESS_ENABLED&&<button type="button" onClick={()=>setEarly(true)}>{c.early} <I name="arrow" size={15}/></button>}</footer>
  </div>
  {(guide!==null||question!==null||(PUBLIC_EARLY_ACCESS_ENABLED&&early))&&<div className="eaBuyModalBackdrop" onClick={()=>{setGuide(null);setQuestion(null);setEarly(false)}} role="presentation">
   <div className="eaBuyModal" role="dialog" aria-modal="true" aria-label={guide!==null?steps[guide].title[locale]:question!==null?faq[question].q[locale]:c.early} onClick={event=>event.stopPropagation()}>
    <button type="button" className="eaBuyModalClose" onClick={()=>{setGuide(null);setQuestion(null);setEarly(false)}} aria-label="Затвори"><I name="close" size={21}/></button>
    {guide!==null&&<div className="eaBuyModalStep">
      <span className="eaBuyModalKicker">E&A / {String(guide+1).padStart(2,"0")} — 07</span>
      <span className="eaBuyModalIcon"><I name={steps[guide].icon} size={32}/></span>
      <h2>{steps[guide].title[locale]}</h2><p>{steps[guide].detail[locale]}</p><small>{steps[guide].state[locale]}</small>
      <a className="eaBuyModalAction" href={steps[guide].href}>{c.more} <I name="arrow" size={18}/></a>
      <div className="eaBuyModalStepper"><button type="button" disabled={guide===0} onClick={()=>setGuide(n=>n===null?0:Math.max(0,n-1))}>{c.prev}</button><span>{guide+1} / 7</span><button type="button" onClick={()=>guide===steps.length-1?setGuide(null):setGuide(n=>n===null?0:Math.min(steps.length-1,n+1))}>{guide===steps.length-1?c.done:c.next} →</button></div>
     </div>}
    {question!==null&&<div className="eaBuyModalFaq"><span className="eaBuyModalKicker">E&A / FAQ</span><h2>{faq[question].q[locale]}</h2><p>{faq[question].a[locale]}</p><a className="eaBuyModalAction" href="/support">{c.contact} <I name="arrow" size={18}/></a><div className="eaBuyModalStepper"><button type="button" onClick={()=>setQuestion((question+faq.length-1)%faq.length)}>{c.prev}</button><span>{question+1} / {faq.length}</span><button type="button" onClick={()=>setQuestion((question+1)%faq.length)}>{c.next} →</button></div></div>}
    {PUBLIC_EARLY_ACCESS_ENABLED&&early&&<form className="eaBuyModalEarly" onSubmit={signup}><span className="eaBuyModalKicker">E&A · PRIVATE BUYER ACCESS</span><h2>{c.early}</h2><p>{locale==="bg"?"Предварително записване за информация. Не дава право за наддаване.":"Request updates about early access. This does not grant bidding rights."}</p><label htmlFor="ea-buy-email">{c.email}</label><input id="ea-buy-email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/><label className="eaBuyConsent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>{c.consent}</label><button className="eaBuyModalAction" type="submit" disabled={!consent||sending}>{sending?c.sending:c.submit} →</button>{feedback&&<p role="status" className={success?"eaBuySuccess":"eaBuyError"}>{feedback}</p>}</form>}
   </div>
  </div>}
 </main>;
}
