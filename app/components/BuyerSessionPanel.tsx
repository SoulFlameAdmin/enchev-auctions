"use client";

import {useEffect,useState} from "react";

type Session = {available:boolean;authenticated:boolean;user?:{id:string;email:string}};
export default function BuyerSessionPanel(){
  const [session,setSession]=useState<Session|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let canceled=false;
    fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store"})
      .then(r=>r.json()).then((data:Session)=>{if(!canceled)setSession(data)})
      .catch(()=>{if(!canceled)setSession({available:false,authenticated:false})});
    return ()=>{canceled=true};
  },[]);

  async function signOut(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/enchev-auth/sign-out",{method:"POST",
        headers:{"Content-Type":"application/json"},body:"{}",credentials:"same-origin"});
      if(!response.ok)throw new Error("sign-out");
      setSession({available:true,authenticated:false});
      setMessage("Signed out of this browser session.");
    }catch{setMessage("Could not complete sign-out. Try again.")}
    finally{setBusy(false)}
  }

  return <section className="profileOverview" aria-label="Account connection status" data-account-preview="true" style={{marginBottom:20}}>
    <span className="navigationRouteKicker">ACCOUNT CONNECTION</span>
    {session?.authenticated&&session.user?<>
      <h2 style={{fontSize:"clamp(21px,4vw,30px)",margin:"8px 0"}}>Signed in</h2>
      <p>{session.user.email}</p>
      <button onClick={signOut} type="button" disabled={busy}
        style={{marginTop:14,minHeight:45,padding:"0 20px",borderRadius:11,
          background:"#132a1a",color:"#d8fbe5",border:"1px solid rgba(39,245,138,.4)",cursor:"pointer"}}>
        {busy?"Signing out…":"Sign out"}
      </button>
    </>:<>
      <h2 style={{fontSize:"clamp(21px,4vw,30px)",margin:"8px 0"}}>
        {session?.available===false?"Preview account — activation pending":"Preview buyer workspace"}
      </h2>
      <p>Saved vehicles and auction rows shown below are still demo data on this device, not your verified purchases or bids.</p>
      <div className="profileOverviewActions" style={{marginTop:14}}>
        <a href="/login">Sign in</a><a href="/register">Create account</a>
      </div>
    </>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
