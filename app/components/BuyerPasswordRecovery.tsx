"use client";

import { FormEvent, useEffect, useState } from "react";
import "./buyer-auth.css";

type Stage = "request" | "verifying" | "change" | "done";
type Reply = {ok?: boolean; error?: string; message?: string; recoveryReady?: boolean};

export default function BuyerPasswordRecovery(){
  const [stage,setStage]=useState<Stage>("request");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    const fragment=window.location.hash;
    if (!fragment) return;
    // Strip bearer credentials before any asynchronous operation, navigation or render.
    window.history.replaceState(null,"",window.location.pathname+window.location.search);
    const params=new URLSearchParams(fragment.slice(1));
    const token=params.get("access_token");
    if (!token){
      setError("The recovery link is invalid or expired. Request a fresh link.");
      return;
    }
    if (params.get("type")!=="recovery" || params.get("token_type")!=="bearer"){
      setError("Invalid recovery link. Request a fresh link.");
      return;
    }
    let canceled=false;
    setStage("verifying");
    fetch("/api/enchev-auth/verify-recovery",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({type:"recovery",access_token:token}),
    }).then(async response=>{
      const result=(await response.json()) as Reply;
      if (!response.ok || !result.ok || !result.recoveryReady) throw Error(result.error||"Link verification failed.");
      if(!canceled){setStage("change");setError("");}
    }).catch(err=>{
      if(!canceled){setError(err instanceof Error ? err.message : "Link verification failed.");setStage("request");}
    });
    return ()=>{canceled=true};
  },[]);

  async function post(action:string,body:Record<string,string>):Promise<Reply>{
    const response=await fetch("/api/enchev-auth/"+action,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
    });
    const data=(await response.json()) as Reply;
    if(!response.ok || !data.ok) throw Error(data.error||"Please try again.");
    return data;
  }

  async function requestLink(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(pending)return;
    setPending(true);setError("");setMessage("");
    try{
      const result=await post("request-reset",{email});
      setMessage(result.message||"If an account exists, a reset email will arrive.");
    }catch(err){setError(err instanceof Error ? err.message : "Connection problem.");}
    finally{setPending(false);}
  }

  async function updatePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(pending)return;
    setPending(true);setError("");
    try{
      const result=await post("set-new-password",{password});
      setPassword("");
      setMessage(result.message||"Password changed. Sign in.");
      setStage("done");
    }catch(err){setError(err instanceof Error ? err.message : "Connection problem.");}
    finally{setPending(false);}
  }

  return <main id="main-content" className="buyerAuthPage">
    <section className="buyerAuthShell" aria-labelledby="recovery-title">
      <div className="buyerAuthIntro">
        <span className="buyerAuthEyebrow">ENCHEV · ACCOUNT SECURITY</span>
        <h1 id="recovery-title">Recover your account</h1>
        <p>Reset access securely through your verified email. Vehicle bidding and purchases remain in demonstration mode.</p>
        <div className="buyerAuthProof"><span>◉ One-time email link</span><span>◉ Short recovery window</span><span>◉ Secure connection</span></div>
      </div>
      <div className="buyerAuthCard">
        {stage==="verifying" && <div className="buyerAuthNotice" role="status">Verifying your recovery link…</div>}
        {stage==="done" && <div className="buyerAuthNotice" role="status">
          <strong>Password updated</strong><p>{message}</p><a href="/login">Continue to sign in →</a>
        </div>}
        {stage==="request" && <form onSubmit={requestLink}>
          <span className="buyerAuthCardTitle">Send a password-reset link</span>
          <p className="buyerAuthHint">Enter the email address associated with your account.</p>
          <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254}
            value={email} onChange={event=>setEmail(event.target.value)} disabled={pending} placeholder="you@example.com"/></label>
          {error&&<p className="buyerAuthError" role="alert">{error}</p>}
          {message&&<p className="buyerAuthSuccess" role="status">{message}</p>}
          <button className="buyerAuthSubmit" type="submit" disabled={pending}>{pending?"Sending…":"Send secure link →"}</button>
          <p className="buyerAuthSwap"><a href="/login">Return to sign in</a></p>
        </form>}
        {stage==="change" && <form onSubmit={updatePassword}>
          <span className="buyerAuthCardTitle">Choose a new password</span>
          <p className="buyerAuthHint">Minimum 12 characters. The recovery session expires after 10 minutes.</p>
          <label>New password<input type="password" name="password" autoComplete="new-password"
            required minLength={12} maxLength={128} value={password}
            onChange={event=>setPassword(event.target.value)} disabled={pending}/></label>
          {error&&<p className="buyerAuthError" role="alert">{error}</p>}
          <button className="buyerAuthSubmit" type="submit" disabled={pending}>{pending?"Updating…":"Update password →"}</button>
        </form>}
      </div>
    </section>
  </main>;
}
