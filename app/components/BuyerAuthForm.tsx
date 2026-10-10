"use client";

import { FormEvent, useEffect, useState } from "react";
import "./buyer-auth.css";

type Mode = "sign-in" | "sign-up";
type ApiReply = {
  ok?:boolean; available?:boolean; error?:string; message?:string;
  authenticated?:boolean; verificationRequired?:boolean;
  user?:{ id:string;email:string };
};

export default function BuyerAuthForm({mode}:{mode:Mode}){
  const [available,setAvailable]=useState<boolean|null>(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const isRegister=mode==="sign-up";

  useEffect(()=>{
    let canceled=false;
    fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store"})
      .then(async response=>(await response.json()) as ApiReply)
      .then(data=>{if(!canceled)setAvailable(data.available===true);})
      .catch(()=>{if(!canceled)setAvailable(false);});
    return ()=>{canceled=true};
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(pending || available!==true)return;
    setPending(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/enchev-auth/"+mode,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({email,password}),
      });
      const result=(await response.json()) as ApiReply;
      if(!response.ok || !result.ok){setError(result.error||"Please try again.");return}
      if(isRegister){setMessage(result.message||"Check your inbox to confirm your email.");setPassword("");return}
      if(result.authenticated){window.location.assign("/profile");return}
      setError("The account session could not be verified.");
    }catch{setError("Connection problem. Please try again.")}
    finally{setPending(false)}
  }

  return <main id="main-content" className="buyerAuthPage">
    <section className="buyerAuthShell" aria-labelledby="buyer-auth-title">
      <div className="buyerAuthIntro">
        <span className="buyerAuthEyebrow">ENCHEV · BUYER ACCESS</span>
        <h1 id="buyer-auth-title">{isRegister?"Create your account":"Welcome back"}</h1>
        <p>Secure account access for the ENCHEV vehicle marketplace. Auction bidding and purchases remain in demo mode until separately certified.</p>
        <div className="buyerAuthProof"><span>◉ Private sessions</span><span>◉ Verified identity provider</span><span>◉ No live payments</span></div>
      </div>
      <div className="buyerAuthCard">
        {available===false?<div role="status" className="buyerAuthNotice">
          <strong>Account activation pending</strong>
          <p>Registration and login will be enabled after a dedicated ENCHEV identity database is connected and verified. No registration is being accepted yet.</p>
          <a href="/platform">Explore the demo marketplace →</a>
        </div>:<form onSubmit={submit}>
          <span className="buyerAuthCardTitle">{isRegister?"Create a buyer profile":"Sign in to your profile"}</span>
          <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" disabled={pending||available!==true}/></label>
          <label>Password<input type="password" name="password" autoComplete={isRegister?"new-password":"current-password"} required minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 12 characters" disabled={pending||available!==true}/></label>
          <p className="buyerAuthHint">Use a unique password with at least 12 characters. Verification by email is required for new accounts.</p>
          {error&&<p className="buyerAuthError" role="alert">{error}</p>}
          {message&&<p className="buyerAuthSuccess" role="status">{message}</p>}
          <button className="buyerAuthSubmit" type="submit" disabled={pending||available!==true}>
            {pending?"Please wait…":available===null?"Checking availability…":isRegister?"Create account":"Sign in"} →
          </button>
          <p className="buyerAuthSwap">{isRegister?"Already registered?":"New to ENCHEV?"} <a href={isRegister?"/login":"/register"}>{isRegister?"Sign in":"Create an account"}</a></p>
          <a className="buyerAuthPreview" href="/profile">Preview account workspace →</a>
        </form>}
      </div>
    </section>
  </main>;
}
