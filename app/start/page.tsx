"use client";

import { FormEvent, useEffect, useState } from "react";
import "./start.css";

type Locale = "bg" | "en";
type Step = {
  number:string; title:{bg:string;en:string}; description:{bg:string;en:string};
  href:string; action:{bg:string;en:string}; state:{bg:string;en:string};
};
const steps:Step[] = [
  {number:"01",title:{bg:"Регистрация на купувача",en:"Buyer registration"},description:{bg:"Личен или фирмен акаунт, потвърден имейл и сигурен вход.",en:"Personal or business account, verified email and secure sign-in."},href:"/register",action:{bg:"Регистрация",en:"Register"},state:{bg:"Активация в процес",en:"Activation pending"}},
  {number:"02",title:{bg:"Проверка и депозит",en:"Verification and deposit"},description:{bg:"Проверка на самоличността, допускане до търг и депозит само по официална платежна заявка.",en:"Identity checks, auction eligibility and a deposit only against an approved payment request."},href:"/payments#verification",action:{bg:"Изисквания",en:"Requirements"},state:{bg:"Нужна е активация",en:"Activation required"}},
  {number:"03",title:{bg:"Избиране на автомобил",en:"Choose a vehicle"},description:{bg:"Истински обяви с VIN, снимки, история, състояние и документи от продавача.",en:"Verified listings with VIN, photos, history, condition and seller documents."},href:"/auctions",action:{bg:"Виж търговете",en:"See auctions"},state:{bg:"Няма реални лотове",en:"No real lots yet"}},
  {number:"04",title:{bg:"Участие в LIVE търг",en:"Join a LIVE auction"},description:{bg:"Наддаване със сървърен таймер и правила само след одобрено участие.",en:"Server-authoritative bidding with clear rules after approval."},href:"/auctions",action:{bg:"LIVE търгове",en:"LIVE auctions"},state:{bg:"Очаква активен търг",en:"Awaiting live auction"}},
  {number:"05",title:{bg:"Спечелване на автомобила",en:"Win the vehicle"},description:{bg:"Потвърден победител, финална цена и индивидуална поръчка в профила.",en:"Confirmed winner, final amount and buyer-specific order in the account."},href:"/profile#my-auctions",action:{bg:"Моите търгове",en:"My auctions"},state:{bg:"Изисква реален резултат",en:"Requires real auction result"}},
  {number:"06",title:{bg:"Плащане и документи",en:"Payment and documents"},description:{bg:"Проверена фактура, Stripe карта или Revolut след активация, договори и освобождаване на автомобила.",en:"Verified invoice, Stripe card or Revolut after activation, agreements and vehicle release."},href:"/payments",action:{bg:"Плащания",en:"Payments"},state:{bg:"Плащанията са изключени",en:"Payments disabled"}},
  {number:"07",title:{bg:"Транспорт и получаване",en:"Transport and collection"},description:{bg:"Оферта, товарене, транспорт, документи за доставка и получаване.",en:"Quote, pickup, shipping, delivery documents and collection."},href:"/transport",action:{bg:"Транспорт",en:"Transport"},state:{bg:"Наличен е демо калкулатор",en:"Demo estimator available"}},
];

const labels = {
  bg:{
    eyebrow:"E&A · КЛИЕНТСКИ ЦЕНТЪР",headline:"От регистрацията",accent:"до ключовете.",description:"Един подреден процес за всеки купувач. Всяка стъпка има собствена страница и ясно показва дали услугата вече е активирана.",
    signIn:"Вход",register:"Регистрация",auctions:"Търгове",process:"7 стъпки за покупка",status:"Текущ статус",
    pending:"Реалните наддавания, депозитите и покупките все още не са активирани. Няма да поискаме плащане без проверена заявка.",
    earlyTitle:"Ранен достъп",earlyText:"Остави имейл и заяви интерес към платформата. Това не създава купувачески акаунт и не дава право за наддаване.",
    email:"Имейл адрес",consent:"Съгласен/съгласна съм имейлът ми да бъде използван за контакт относно ранния достъп.",send:"Запиши ме",sending:"Записване…",
    confirmation:"Заявката е приета. Това е предварително записване, не регистрация за търгове.",
    accountStatus:"Потребителски акаунти",active:"Активирани",inactive:"Все още неактивни",checking:"Проверка…",
    note:"Демо функционалностите са отделени от истинските търгове и плащания.",details:"Документи",help:"Помощ"
  },
  en:{
    eyebrow:"E&A · BUYER JOURNEY",headline:"From registration",accent:"to the keys.",description:"One clear journey for every buyer. Each step has a dedicated destination and an honest activation status.",
    signIn:"Sign in",register:"Register",auctions:"Auctions",process:"7 steps to ownership",status:"Current status",
    pending:"Real-money bids, deposits and purchases are not enabled yet. No payment is requested without a verified order.",
    earlyTitle:"Early access",earlyText:"Leave your email to express interest. This is not a buyer account and does not grant bidding eligibility.",
    email:"Email address",consent:"I agree that my email may be used to contact me about early access.",send:"Join early access",sending:"Submitting…",
    confirmation:"Your interest was recorded. This is not an auction registration.",
    accountStatus:"Buyer accounts",active:"Enabled",inactive:"Not enabled yet",checking:"Checking…",
    note:"Demo functionality is kept separate from real auctions and payments.",details:"Documents",help:"Help"
  }
} as const;

export default function BuyerStartPage(){
  const [locale,setLocale]=useState<Locale>("bg");
  const [authAvailable,setAuthAvailable]=useState<boolean|null>(null);
  const [email,setEmail]=useState("");
  const [consent,setConsent]=useState(false);
  const [sending,setSending]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [success,setSuccess]=useState(false);
  const copy=labels[locale];
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/enchev-auth/session",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
      .then(r=>r.json()).then(data=>setAuthAvailable(data.available===true))
      .catch(()=>{if(!controller.signal.aborted)setAuthAvailable(false)});
    return()=>controller.abort();
  },[]);

  async function signUp(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(sending || !consent || !email.trim())return;
    setSending(true);setSuccess(false);setFeedback("");
    try{
      const r=await fetch("/api/ea-early-access",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:email.trim(),consent:true,website:""}),
      });
      const data=await r.json();
      if(!r.ok||data.ok!==true)throw new Error(typeof data.message==="string"?data.message:"Request not accepted");
      setSuccess(true);setEmail("");setConsent(false);setFeedback(copy.confirmation);
    }catch(err){setFeedback(err instanceof Error?err.message:"Connection problem. Try again.");}
    finally{setSending(false);}
  }

  return <main id="main-content" className="eaStart">
    <div className="eaStartInner">
      <div className="eaStartTop">
        <span className="eaStartKicker">{copy.eyebrow}</span>
        <div className="eaStartTopActions">
          <div className="eaStartLang" role="group" aria-label="Language">
            <button type="button" aria-pressed={locale==="bg"} onClick={()=>setLocale("bg")}>BG</button>
            <button type="button" aria-pressed={locale==="en"} onClick={()=>setLocale("en")}>EN</button>
          </div>
          <a href="/login">{copy.signIn} ↗</a><a className="eaStartRegister" href="/register">{copy.register} ↗</a>
        </div>
      </div>

      <section className="eaStartHero">
        <h1>{copy.headline}<br/><em>{copy.accent}</em></h1>
        <p>{copy.description}</p>
        <div className="eaStartHeroActions">
          <a href="/auctions">{copy.auctions} <span aria-hidden="true">→</span></a>
          <a href="/documents">{copy.details} <span aria-hidden="true">→</span></a>
          <a href="/support">{copy.help} <span aria-hidden="true">→</span></a>
        </div>
      </section>
      <div className="eaStartReadiness" role="status">
        <div><small>{copy.accountStatus}</small><strong>{authAvailable===null?copy.checking:authAvailable?copy.active:copy.inactive}</strong></div>
        <div><small>{copy.status}</small><span>{copy.pending}</span></div>
      </div>

      <section className="eaStartTimeline" aria-labelledby="ea-timeline-title">
        <header><span>01 — 07</span><h2 id="ea-timeline-title">{copy.process}</h2></header>
        <div className="eaStartSteps">
          {steps.map(item=><article className="eaStartStep" key={item.number}>
            <div className="eaStartStepNumber">{item.number}</div>
            <div className="eaStartStepContent"><h3>{item.title[locale]}</h3><p>{item.description[locale]}</p>
              <small>{item.number==="01"&&authAvailable===true?labels[locale].active:item.state[locale]}</small>
            </div>
            <a href={item.href} aria-label={item.action[locale]+" — "+item.title[locale]}>{item.action[locale]} <span aria-hidden="true">↗</span></a>
          </article>)}
        </div>
      </section>

      <section id="early-access" className="eaStartEarly" aria-labelledby="ea-early-title">
        <div><span className="eaStartKicker">E&A PRIVATE BUYER ACCESS</span><h2 id="ea-early-title">{copy.earlyTitle}</h2><p>{copy.earlyText}</p></div>
        <form onSubmit={signUp}>
          <label htmlFor="ea-start-email">{copy.email}</label>
          <input id="ea-start-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/>
          <label className="eaStartConsent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>{copy.consent}</span></label>
          <button type="submit" disabled={!consent||sending}>{sending?copy.sending:copy.send} →</button>
          {feedback&&<p role="status" className={success?"is-success":"is-error"}>{feedback}</p>}
        </form>
      </section>
      <footer className="eaStartFoot"><span>{copy.note}</span><a href="/auctions">AUCTIONS</a><a href="/payments">PAYMENTS</a><a href="/transport">TRANSPORT</a></footer>
    </div>
  </main>;
}
