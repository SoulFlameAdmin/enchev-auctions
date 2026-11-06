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
 return <main id="main-content" className="buyerAuthPage">
  <section className="buyerAuthShell" aria-labelledby="buyer-auth-title">
   <div className="buyerAuthIntro">
    <span className="buyerAuthEyebrow">E&A · СИГУРЕН КУПУВАЧЕСКИ ПРОФИЛ</span>
    <h1 id="buyer-auth-title">{isRegister?"Създай профил":"Добре дошъл отново"}</h1>
    <p>Регистрация за проверени автомобили, запазени обяви и участие в бъдещи търгове. Реалните оферти и плащания ще се активират само след необходимите проверки.</p>
    <div className="buyerAuthProof"><span>◉ Защитена сесия</span><span>◉ Проверка по имейл</span><span>◉ Без активни реални плащания</span></div>
    {isRegister&&promo&&<div className="buyerAuthNotice" role="note" style={{marginTop:22}}>
     <strong>Приветствена кампания: 10% отстъпка</strong>
     <p>Кодовете и условията за допустимите такси предстоят да бъдат активирани. Към момента регистрацията не издава автоматично код.</p>
    </div>}
   </div>
   <div className="buyerAuthCard">
    {available===false?<div role="status" className="buyerAuthNotice">
      <strong>Предстоящо активиране на профилите</strong>
      <p>Защитената регистрация още не е включена в продукционния сайт. Засега не приемаме регистрации чрез този формуляр.</p>
      <a href="/start#early-access">Заяви ранен достъп ↗</a>
    </div>:<form onSubmit={submit}>
      <span className="buyerAuthCardTitle">{isRegister?"Регистрация на купувач":"Вход в профила"}</span>
      <label>Имейл<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="email@example.com" disabled={pending||available!==true}/></label>
      <label>Парола<input type="password" name="password" autoComplete={isRegister?"new-password":"current-password"} required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Най-малко 12 символа" disabled={pending||available!==true}/></label>
      <p className="buyerAuthHint">Използвай уникална парола с поне 12 символа. Новите профили изискват потвърждение по имейл.</p>
      {error&&<p className="buyerAuthError" role="alert">{error}</p>}
      {message&&<p className="buyerAuthSuccess" role="status">{message}</p>}
      <button className="buyerAuthSubmit" type="submit" disabled={pending||available!==true}>{pending?"Проверка…":available===null?"Проверяваме достъпността…":isRegister?"Регистрирай се":"Влез в профила"} ↗</button>
      <p className="buyerAuthSwap">{isRegister?"Вече имаш профил?":"Нямаш профил?"} <a href={(isRegister?"/login":"/register")+linkParam}>{isRegister?"Вход":"Регистрация"}</a></p>
      <a className="buyerAuthPreview" href="/vehicles">Към автомобилите ↗</a>
     </form>}
   </div>
  </section>
 </main>;
}
