"use client";

import {FormEvent,useEffect,useState} from "react";
import "./buyer-auth.css";

type Mode="sign-in"|"sign-up";
type AccountType="individual"|"business";
type ApiReply={ok?:boolean;available?:boolean;legalReady?:boolean;error?:string;message?:string;authenticated?:boolean;user?:{id:string;email:string}};
const countries=[
 ["BG","България","+359"],["ES","Испания","+34"],["DE","Германия","+49"],
 ["FR","Франция","+33"],["IT","Италия","+39"],["RO","Румъния","+40"],
 ["GR","Гърция","+30"],["NL","Нидерландия","+31"],["BE","Белгия","+32"],
 ["AT","Австрия","+43"],["PL","Полша","+48"],["PT","Португалия","+351"],
 ["TR","Турция","+90"],["GB","Обединено кралство","+44"],["OTHER","Друга държава","+"]
] as const;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern=/^\+[1-9]\d{6,14}$/;
function safeNext(value:string|null){
 if(value==="/vehicles"||value==="/auctions")return value;
 if(value&&/^\/vehicles\/[0-9a-f-]{36}$/i.test(value))return value;
 return "";
}
export default function BuyerAuthForm({mode}:{mode:Mode}){
 const isRegister=mode==="sign-up";
 const [available,setAvailable]=useState<boolean|null>(null);
 const [legalReady,setLegalReady]=useState(false);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [returnTo,setReturnTo]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [repeatPassword,setRepeatPassword]=useState("");
 const [step,setStep]=useState(0);
 const [buyerType,setBuyerType]=useState<AccountType>("individual");
 const [firstName,setFirstName]=useState("");
 const [lastName,setLastName]=useState("");
 const [country,setCountry]=useState("BG");
 const [otherCountry,setOtherCountry]=useState("");
 const [phone,setPhone]=useState("");
 const [businessName,setBusinessName]=useState("");
 const [businessNumber,setBusinessNumber]=useState("");
 const [ageConfirmed,setAgeConfirmed]=useState(false);
 const [termsAccepted,setTermsAccepted]=useState(false);
 const [privacyAcknowledged,setPrivacyAcknowledged]=useState(false);
 const [marketingConsent,setMarketingConsent]=useState(false);

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   setReturnTo(safeNext(params.get("next")));
   if(mode==="sign-in")try{
     const saved=sessionStorage.getItem("enchev.login.email.prefill");
     if(saved){sessionStorage.removeItem("enchev.login.email.prefill");
       if(saved.length<=254&&emailPattern.test(saved))setEmail(saved);
     }
   }catch{/* storage may be blocked */}
 },[mode]);
 useEffect(()=>{
   const controller=new AbortController();
   fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
     .then(async response=>(await response.json()) as ApiReply)
     .then(reply=>{
       if(!controller.signal.aborted){
         setAvailable(reply.available===true);
         setLegalReady(reply.legalReady===true);
       }
     }).catch(()=>{if(!controller.signal.aborted)setAvailable(false)});
   return()=>controller.abort();
 },[]);
 const linkParam=returnTo?"?next="+encodeURIComponent(returnTo):"";
 const stateIsAvailable=available===true;
 function advance(){
   setError("");setMessage("");
   if(step===0){
     if(!firstName.trim()||!lastName.trim()){setError("Попълнете име и фамилия.");return;}
     if(firstName.trim().length>60||lastName.trim().length>60){setError("Имената трябва да са до 60 символа.");return;}
     if(buyerType==="business"&&(!businessName.trim()||!businessNumber.trim())){setError("Попълнете името и регистрационния номер на фирмата.");return;}
   }
   if(step===1){
     if(!emailPattern.test(email)||email.length>254){setError("Въведете валиден имейл.");return;}
     if(!phonePattern.test(phone.replace(/[\s().-]/g,""))){setError("Телефонът трябва да е международен формат, напр. +359888123456.");return;}
     if(!country||(country==="OTHER"&&!otherCountry.trim())){setError("Посочете конкретна държава.");return;}
   }
   if(step===2){if(password.length<12||password.length>128){setError("Паролата трябва да има поне 12 символа.");return;}if(password!==repeatPassword){setError("Паролите не съвпадат.");return;}}
   setStep(v=>Math.min(3,v+1));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();setError("");setMessage("");
   if(pending||available!==true)return;
   if(isRegister&&step!==3){advance();return;}
   if(isRegister){
     if(password.length<12||password.length>128){setError("Паролата трябва да е между 12 и 128 символа.");return;}
     if(!ageConfirmed||!termsAccepted||!privacyAcknowledged){setError("Необходимо е да потвърдите възрастта, условията и прочитането на политиката.");return;}
     if(!legalReady){setError("Условията все още очакват юридическо одобрение. Регистрацията не е активирана.");return;}
   }
   setPending(true);
   try{
     const body=isRegister?{
       email,password,
       registration:{
         buyerType,firstName:firstName.trim(),lastName:lastName.trim(),
         country,countryName:country==="OTHER"?otherCountry.trim():"",phone:phone.replace(/[\s().-]/g,""),
         businessName:buyerType==="business"?businessName.trim():"",
         businessNumber:buyerType==="business"?businessNumber.trim():"",
         ageConfirmed,termsAccepted,privacyAcknowledged,marketingConsent
       }
     }:{email,password};
     const response=await fetch("/api/enchev-auth/"+mode,{
       method:"POST",headers:{"Content-Type":"application/json"},
       credentials:"same-origin",cache:"no-store",body:JSON.stringify(body)
     });
     const reply=(await response.json()) as ApiReply;
     if(!response.ok||!reply.ok){
       setError(response.status===429?"Твърде много опити. Опитайте по-късно.":response.status===503?
         "Системата за регистрации временно не е активна.":reply.error||"Проверете данните.");
       return;
     }
     if(isRegister){
       setMessage("Заявката е приета. Проверете имейла си за връзка за потвърждение, след което влезте в профила.");
       setPassword("");
       return;
     }
     if(reply.authenticated){window.location.assign(returnTo||"/profile");return;}
     setError("Сесията не е потвърдена.");
   }catch{setError("Проблем с връзката. Опитайте отново.");}
   finally{setPending(false);}
 }
 return <main id="main-content" className="buyerAuthPage">
   <div className="buyerAuthAtmosphere" aria-hidden="true"><span className="buyerAuthGrid"/></div>
   <section className="buyerAuthShell" aria-labelledby="buyer-auth-title">
    <div className="buyerAuthIntro">
      <a href="/" className="buyerAuthBrand" aria-label="E&A — Начало">
       <span className="buyerAuthMonogram">E<span>&</span>A</span>
       <span className="buyerAuthBrandName">EAST AND WEST<br/><b>AUCTIONEERS GROUP</b></span>
      </a>
      <span className="buyerAuthEyebrow"><span className="buyerAuthRedDot"/> E&A · АВТОМОБИЛНИ ТЪРГОВЕ</span>
      <h1 id="buyer-auth-title">{isRegister?<>Създайте профил.<br/><em>Започнете с E&A.</em></>:<>Вашият профил.<br/><em>Вашите възможности.</em></>}</h1>
      <p>Един профил за автомобили, търгове, история и доставка.</p>
      <div className="buyerAuthVisual" aria-hidden="true"><div className="buyerAuthOrb"><span className="buyerAuthOrbInner"/><span className="buyerAuthOrbLine"/></div></div>
      <div className="buyerAuthProof"><span>Защитен достъп</span><span>Потвърждение по имейл</span><span>Проверка преди наддаване</span></div>
    </div>
    <div className="buyerAuthCard">
      <div className="buyerAuthCardTop"><span>E&A · КУПУВАЧ</span><a href="/">КЪМ НАЧАЛОТО ↗</a></div>
      <nav className="buyerAuthTabs" aria-label="Вход и регистрация">
       <a href={"/login"+linkParam} className={!isRegister?"active":""} aria-current={!isRegister?"page":undefined}>ВХОД</a>
       <a href={"/register"+linkParam} className={isRegister?"active":""} aria-current={isRegister?"page":undefined}>РЕГИСТРАЦИЯ</a>
      </nav>
      {available===false&&!isRegister&&<div className="buyerAuthNotice buyerAuthNoticeCompact" role="status">
        <strong>Профилите все още не са активирани</strong>
        <p>Защитената система за вход не е включена. Можете да разгледате процеса, но не приемаме регистрации.</p>
        <a href="/start#early-access">Заявете ранен достъп ↗</a>
      </div>}
    <form onSubmit={submit} noValidate={false}>
        {isRegister?<div className="buyerAuthProgress" aria-label={"Регистрация: стъпка "+(step+1)+" от 4"}>
          {[0,1,2,3].map(n=><span key={n} className={n<=step?"on":""}/>)}
          <small>{step+1} / 4</small>
        </div>:null}
        <span className="buyerAuthCardKicker">{isRegister?["01 / ТИП И ИМЕНА","02 / КОНТАКТ","03 / ПАРОЛА","04 / УСЛОВИЯ"][step]:"СИГУРЕН ДОСТЪП"}</span>
        <h2 className="buyerAuthCardTitle">{isRegister?["Кой ще използва профила?","Данни за връзка","Защитете профила","Условия и съгласия"][step]:"Добре дошли отново"}</h2>
        {isRegister&&step===0&&<>
          <div className="buyerAuthTypes" role="group" aria-label="Тип купувач">
           <button type="button" className={buyerType==="individual"?"selected":""} aria-pressed={buyerType==="individual"} onClick={()=>setBuyerType("individual")}>Физическо лице</button>
           <button type="button" className={buyerType==="business"?"selected":""} aria-pressed={buyerType==="business"} onClick={()=>setBuyerType("business")}>Фирма</button>
          </div>
          <div className="buyerAuthFieldsTwo">
           <label>Име<input autoComplete="given-name" maxLength={60} required value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Иван"/></label>
           <label>Фамилия<input autoComplete="family-name" maxLength={60} required value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Иванов"/></label>
          </div>
          {buyerType==="business"&&<div className="buyerAuthFieldsTwo">
           <label>Фирма<input maxLength={160} required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Име на фирмата"/></label>
           <label>Рег. номер<input maxLength={40} required value={businessNumber} onChange={e=>setBusinessNumber(e.target.value)} placeholder="ЕИК / номер"/></label>
          </div>}
          <p className="buyerAuthHint">Фирмените акаунти преминават допълнителна KYB проверка преди участие в търгове.</p>
        </>}
        {isRegister&&step===1&&<>
          <div className="buyerAuthFieldsTwo">
            <label>Държава<select value={country} onChange={e=>{setCountry(e.target.value);const selected=countries.find(x=>x[0]===e.target.value);if(selected&&(!phone||countries.some(c=>phone===c[2])))setPhone(selected[2]);}}>
             {countries.map(([code,name])=><option key={code} value={code}>{name}</option>)}
            </select></label>
            <label>Телефон<input type="tel" autoComplete="tel" inputMode="tel" required maxLength={22} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+359888123456"/></label>
          </div>
          {country==="OTHER"&&<label>Държава (точно име)<input maxLength={80} required value={otherCountry} onChange={e=>setOtherCountry(e.target.value)} placeholder="Напишете държавата"/></label>}
          <label>Имейл<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
          <p className="buyerAuthHint">Телефонът се въвежда с международен код. Потвърждение на имейла е необходимо преди активиране.</p>
        </>}
        {(!isRegister||step===2)&&<>
          {!isRegister&&<label>Имейл<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" disabled={pending||!stateIsAvailable}/></label>}
          <label>Парола<div className="buyerAuthPassword">
           <input type={showPassword?"text":"password"} autoComplete={isRegister?"new-password":"current-password"} minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Поне 12 символа" disabled={pending||(!isRegister&&!stateIsAvailable)}/>
           <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Скрий паролата":"Покажи паролата"}>{showPassword?"СКРИЙ":"ПОКАЖИ"}</button>
          </div></label>
          {isRegister&&<label>Повторете паролата<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={repeatPassword} onChange={e=>setRepeatPassword(e.target.value)} placeholder="Повторете паролата"/></label>}
          {!isRegister&&<p className="buyerAuthHint">Само за регистрирани потребители. Забравена парола? <a href="/support">Свържете се с поддръжката</a>.</p>}
        </>}
        {isRegister&&step===3&&<>          <div className="buyerAuthConsents">
           <label><input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)} required/> Потвърждавам, че съм навършил/а 18 години.</label>
           <label><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required/> Приемам <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Общите условия</a>.</label>
           <label><input type="checkbox" checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)} required/> Запознах се с <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Политиката за лични данни</a>.</label>
           <label><input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)}/> Искам незадължителни рекламни известия.</label>
           <p><a href="/legal/cookies" target="_blank" rel="noopener noreferrer">Политика за бисквитките</a> · Отметките не са предварително избрани.</p>
          </div>
</>}
        {isRegister&&step===3&&!legalReady&&<p className="buyerAuthPolicyNotice" role="note">Правните документи са в проект и очакват одобрение. Реална регистрация няма да бъде активирана преди това.</p>}
        {error&&<p className="buyerAuthError" role="alert">{error}</p>}
        {message&&<p className="buyerAuthSuccess" role="status">{message}</p>}
        <div className="buyerAuthActions">
          {isRegister&&step>0&&<button type="button" className="buyerAuthBack" onClick={()=>{setError("");setMessage("");setStep(n=>n-1)}}>← НАЗАД</button>}
          <button className="buyerAuthSubmit" type={isRegister&&step<3?"button":"submit"} onClick={isRegister&&step<3?advance:undefined} disabled={pending||(!isRegister&&!stateIsAvailable)||(isRegister&&step===3&&(!stateIsAvailable||!legalReady))}>
           {pending?"ПРОВЕРКА…":isRegister?(step<3?"ПРОДЪЛЖИ →":(!legalReady||!stateIsAvailable?"ОЧАКВА ОДОБРЕНИЕ":"СЪЗДАЙ ПРОФИЛ →")):(!stateIsAvailable?"ВХОДЪТ НЕ Е АКТИВЕН":"ВЛЕЗ В ПРОФИЛА →")}
          </button>
        </div>
        <p className="buyerAuthSwap">{isRegister?"Вече имате профил?":"Нямате профил?"} <a href={(isRegister?"/login":"/register")+linkParam}>{isRegister?"Вход":"Регистрация"}</a></p>
      </form>
    </div>
   </section>
 </main>;
}
