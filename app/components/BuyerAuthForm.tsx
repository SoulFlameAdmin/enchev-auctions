"use client";

import {FormEvent,useEffect,useState} from "react";
import "./buyer-auth.css";
type Mode="sign-in"|"sign-up";
type ApiReply={ok?:boolean;available?:boolean;error?:string;message?:string;authenticated?:boolean;verificationRequired?:boolean;user?:{id:string;email:string}};
function safeNext(candidate:string|null){
 if(!candidate)return "";
 if(candidate==="/vehicles"||candidate==="/auctions")return candidate;
 if(/^\/vehicles\/[0-9a-f-]{36}$/i.test(candidate))return candidate;
 return "";
}
export default function BuyerAuthForm({mode}:{mode:Mode}){
 const [available,setAvailable]=useState<boolean|null>(null);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [returnTo,setReturnTo]=useState("");
 const [promo,setPromo]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const [accountType,setAccountType]=useState<"person"|"business">("person");
 const isRegister=mode==="sign-up";
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setReturnTo(safeNext(params.get("next")));
  setPromo(params.get("campaign")==="welcome10");
  if(mode==="sign-in")try{
    const saved=window.sessionStorage.getItem("enchev.login.email.prefill");
    if(saved){
      window.sessionStorage.removeItem("enchev.login.email.prefill");
      if(saved.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved))setEmail(saved);
    }
  }catch{}
 },[mode]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async r=>(await r.json()) as ApiReply)
   .then(j=>{if(!controller.signal.aborted)setAvailable(j.available===true)})
   .catch(()=>{if(!controller.signal.aborted)setAvailable(false)});
  return()=>controller.abort();
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending||available!==true)return;
  setPending(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/enchev-auth/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password})});
   const result=(await response.json()) as ApiReply;
   if(!response.ok||!result.ok){
     setError(response.status===429?"Твърде много опити. Опитай по-късно.":response.status===503?"Услугата за профили временно не е достъпна.":result.error||"Проверете въведените данни.");
     return;
   }
   if(isRegister){
     setMessage("Ако адресът може да бъде регистриран, ще получиш имейл за потвърждение. След това влез в профила си.");
     setPassword("");return;
   }
   if(result.authenticated){window.location.assign(returnTo||"/profile");return;}
   setError("Не успяхме да потвърдим сесията. Опитай отново.");
  }catch{setError("Проблем с връзката. Опитай отново.");}
  finally{setPending(false)}
 }
 const linkParam=returnTo?"?next="+encodeURIComponent(returnTo):"";
 const tabs=<div className="buyerAuthTabs" role="navigation" aria-label="Вход и регистрация"><a className={!isRegister?"active":""} href={"/login"+linkParam}>Вход</a><a className={isRegister?"active":""} href={"/register"+linkParam}>Регистрация</a></div>;
 return <main id="main-content" className="buyerAuthPage">
  <div className="buyerAuthAtmosphere" aria-hidden="true"><span className="buyerAuthHalo"/><span className="buyerAuthGrid"/></div>
  <section className="buyerAuthShell" aria-labelledby="buyer-auth-title">
   <div className="buyerAuthIntro">
    <a className="buyerAuthBrand" href="/" aria-label="E&A — Начало"><span className="buyerAuthMonogram">E<span>&</span>A</span><span className="buyerAuthBrandName">EAST AND WEST<br/><b>AUCTIONEERS GROUP</b></span></a>
    <span className="buyerAuthEyebrow"><span className="buyerAuthRedDot"/> ПЛАТФОРМА ЗА АВТОМОБИЛНИ ТЪРГОВЕ</span>
    <h1 id="buyer-auth-title">{isRegister?<>Нов профил.<br/><em>Нови възможности.</em></>:<>Вашият достъп.<br/><em>Вашият следващ автомобил.</em></>}</h1>
    <p>Откривайте автомобили, следете търговете и управлявайте всяка стъпка от покупката на едно място.</p>
    <div className="buyerAuthVisual" aria-hidden="true">
     <div className="buyerAuthOrb"><span className="buyerAuthOrbInner"/><span className="buyerAuthOrbLine"/></div>
     <div className="buyerAuthVisualCaption"><span>01 / 03</span><span>ОТ ОФЕРТАТА ДО КЛЮЧОВЕТЕ</span></div>
    </div>
    <div className="buyerAuthProof"><span>Защитен достъп</span><span>Потвърждение по имейл</span><span>Личен профил</span></div>
   </div>
   <div className="buyerAuthCard">
    <div className="buyerAuthCardTop"><span>E&A / ACCOUNT</span><a href="/" aria-label="Обратно към началото">↗ НАЧАЛО</a></div>
    {tabs}
    {available===false?<div role="status" className="buyerAuthNotice">
      <strong>Предстоящо активиране на профилите</strong>
      <p>Защитената регистрация още не е включена в продукционния сайт. Засега не приемаме регистрации чрез този формуляр.</p>
      <a href="/start#early-access">Заяви ранен достъп ↗</a>
    </div>:<form onSubmit={submit}>
      <span className="buyerAuthCardKicker">{isRegister?"СТЪПКА 01 / РЕГИСТРАЦИЯ":"СИГУРЕН ДОСТЪП"}</span>
      <h2 className="buyerAuthCardTitle">{isRegister?"Създайте профил":"Добре дошли отново"}</h2>
      <p className="buyerAuthCardDesc">{isRegister?"Регистрирайте се, за да започнете своето пътуване с E&A.":"Въведете данните си, за да продължите към профила."}</p>
      {isRegister&&<div className="buyerAuthTypes" role="group" aria-label="Тип профил">
       <button type="button" className={accountType==="person"?"selected":""} onClick={()=>setAccountType("person")} aria-pressed={accountType==="person"}><span>♙</span><b>Физическо лице</b></button>
       <button type="button" className={accountType==="business"?"selected":""} onClick={()=>setAccountType("business")} aria-pressed={accountType==="business"}><span>▦</span><b>Фирма</b></button>
      </div>}
      {isRegister&&accountType==="business"&&<p className="buyerAuthTypeNote">Фирмените данни и KYB проверката се попълват след активиране на профила. Този формуляр създава само основен акаунт.</p>}
      <label>Имейл адрес<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com" disabled={pending||available!==true}/></label>
      <label>Парола<div className="buyerAuthPassword"><input type={showPassword?"text":"password"} name="password" autoComplete={isRegister?"new-password":"current-password"} required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Най-малко 12 символа" disabled={pending||available!==true}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Скрий паролата":"Покажи паролата"}>{showPassword?"Скрий":"Покажи"}</button></div></label>
      <p className="buyerAuthHint">{isRegister?"Използвайте поне 12 символа. След регистрация ще е необходимо потвърждение по имейл.":"Използвайте паролата за вашия E&A профил."}</p>
      {error&&<p className="buyerAuthError" role="alert">{error}</p>}
      {message&&<p className="buyerAuthSuccess" role="status">{message}</p>}
      <button className="buyerAuthSubmit" type="submit" disabled={pending||available!==true}>{pending?"Проверка…":available===null?"Проверяваме достъпността…":isRegister?"Създай профил":"Влез в профила"} <span aria-hidden="true">↗</span></button>
      <p className="buyerAuthSwap">{isRegister?"Вече имате профил?":"Все още нямате профил?"} <a href={(isRegister?"/login":"/register")+linkParam}>{isRegister?"Влезте":"Регистрирайте се"}</a></p>
      <div className="buyerAuthCardBottom"><span>ЗАЩИТЕНА ВРЪЗКА</span><a href="/vehicles">Разгледай автомобили ↗</a></div>
     </form>}
   </div>
  </section>
 </main>;
}
