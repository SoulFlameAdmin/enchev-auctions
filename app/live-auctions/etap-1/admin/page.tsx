"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./monitor.css";

type Role = "mitko" | "borko" | "enchev";
type Person = {role:Role;online:boolean;ready:boolean;inGame:boolean;lastSeen:string|null};
type Auction = {id:string;title?:string;currentAmount:number;sequence:number;leadingRole?:string|null;winnerRole:string|null;endsAt?:string;closedAt?:string|null};
type Bid = {sequence:number;role:string;amount:number;at:string};
type Monitor = {ok:true;serverNow:string;status:"idle"|"live"|"closed";auction:Auction|null;
  bids:Bid[];participants:Person[];connected:number;ready:number;inGame:number;required:number;allReady:boolean};
const roleName:Record<Role,string>={mitko:"MITKO",borko:"BORKO",enchev:"ENCHEV"};
const euro=(n:number)=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const when=(date:string|null)=>date?new Date(date).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";

export default function Etap1AdminMonitor() {
  const [authorized,setAuthorized]=useState(false);
  const [loading,setLoading]=useState(true);
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [monitor,setMonitor]=useState<Monitor|null>(null);
  const [lastUpdate,setLastUpdate]=useState<number|null>(null);
  const [offline,setOffline]=useState(false);

  const refresh=useCallback(async()=>{
    try {
      const response=await fetch("/api/etap1/admin",{cache:"no-store",credentials:"same-origin"});
      if(response.status===401||response.status===403){
        setAuthorized(false);setMonitor(null);setOffline(false);setLoading(false);
        return;
      }
      const body=await response.json() as Monitor&{error?:string};
      if(!response.ok||!body.ok)throw new Error(body.error||"Monitor unavailable");
      setAuthorized(true);setMonitor(body);setLastUpdate(Date.now());setOffline(false);setError("");
    }catch(e){
      setOffline(true);
      setError(e instanceof Error?e.message:"Connection lost");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    void refresh();
    const interval=window.setInterval(()=>{void refresh();},1000);
    return()=>window.clearInterval(interval);
  },[refresh]);

  const login=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setBusy(true);setError("");
    try{
      const res=await fetch("/api/etap1/login",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({role:"admin",code})});
      const data=await res.json() as {error?:string};
      if(!res.ok)throw new Error(data.error||"Admin login rejected");
      setCode("");setAuthorized(true);await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Sign in failed");}
    finally{setBusy(false);}
  };
  const logout=async()=>{
    setBusy(true);
    try{await fetch("/api/etap1/logout?scope=admin",{method:"POST",headers:{"Content-Type":"application/json"},
      credentials:"same-origin",body:"{}"});}finally{
      setAuthorized(false);setMonitor(null);setBusy(false);setCode("");
    }
  };

  return <main className="eaAdminMonitor">
    <header className="eaMonitorTop">
      <a href="/" className="eaMonitorBrand">ENCHEV <small>AUCTIONS</small></a>
      <div><span className="eaMonitorTag">DEMO ONLY · CONTROL ROOM</span>
        {authorized&&<span className={"eaMonitorSignal "+(offline?"bad":"good")}>{offline?"● OFFLINE":"● LIVE SYNC · 1s"}</span>}</div>
      {authorized&&<button type="button" className="eaMonitorLogout" onClick={()=>void logout()} disabled={busy}>SIGN OUT</button>}
    </header>
    {!authorized?<section className="eaMonitorLogin">
      <span className="eaMonitorEyebrow">PRIVATE OPERATOR ACCESS</span>
      <h1>Control room.</h1>
      <p>Desktop dashboard for the invited ENCHEV demonstration. Only the admin role can see participant activity.</p>
      <form onSubmit={login}>
        <label>ADMIN ACCESS CODE<input autoFocus type="password" autoComplete="off" minLength={16} maxLength={256}
          required value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter the 16+ character admin code"/></label>
        <button disabled={busy} type="submit">{busy?"CONNECTING…":"OPEN LIVE MONITOR →"}</button>
      </form>
      {error&&<p className="eaMonitorError" role="alert">{error}</p>}
      {loading&&<small>Checking access…</small>}
      <a className="eaMonitorSecondaryLink" href="/live-auctions/etap-1">Back to bidder room</a>
    </section>:<div className="eaMonitorBody">
      <div className="eaMonitorHeading">
        <div><span className="eaMonitorEyebrow">ENCHEV · LIVE OPERATIONS</span>
          <h1>Control Room <span>01</span></h1><p>Who is online, ready, and actively admitted to the current auction.</p>
        </div>
        <div className="eaMonitorTime">SERVER TIME <strong>{monitor?when(monitor.serverNow):"—"}</strong><small>{lastUpdate?"Last sync: "+new Date(lastUpdate).toLocaleTimeString("bg-BG"):"Connecting"}</small></div>
      </div>
      {offline&&<p className="eaMonitorError" role="alert">⚠ Connection interrupted. Showing last known status only. {error}</p>}
      <section className="eaMonitorMetrics" aria-label="Live lobby counts">
        <article><span>IN LOBBY / ONLINE</span><strong>{monitor?.connected??"—"}<small> / 3</small></strong><p>Connected within 15 seconds</p></article>
        <article><span>READY</span><strong>{monitor?.ready??"—"}<small> / {monitor?.required??3} minimum</small></strong><p>Participants waiting for start</p></article>
        <article><span>IN LIVE ROUND</span><strong>{monitor?.inGame??"—"}<small> admitted</small></strong><p>Server-verified participants</p></article>
        <article><span>AUCTION STATE</span><strong className="eaMonitorState">{monitor?.status?.toUpperCase()??"—"}</strong><p>{monitor?.status==="live"?"Three admitted bidders can bid":monitor?.allReady?"Ready to start": "Waiting for Mitko, Borko and Enchev"}</p></article>
      </section>
      <section className="eaMonitorRoster">
        <div className="eaMonitorSectionTitle"><div><span className="eaMonitorEyebrow">REAL-TIME LOBBY</span><h2>Participants</h2></div><b>{monitor?.connected??0} ONLINE</b></div>
        <div className="eaMonitorGrid">
          {(monitor?.participants??(["mitko","borko","enchev"] as Role[]).map(role=>({role,online:false,ready:false,inGame:false,lastSeen:null}))).map(p=>
            <article className={"eaMonitorPerson "+(p.online?"online":"offline")} key={p.role}>
              <div className="eaMonitorAvatar">{roleName[p.role].slice(0,1)}</div>
              <div className="eaMonitorPersonBody"><strong>{roleName[p.role]}</strong><small>BIDDER</small>
                <span className={"eaMonitorBadge "+(p.inGame?"playing":p.ready?"ready":p.online?"waiting":"away")}>
                  {p.inGame?"● IN AUCTION":p.ready?"✓ READY":p.online?"○ WAITING":"— OFFLINE"}
                </span>
              </div>
              <div className="eaMonitorLast">LAST SEEN <strong>{when(p.lastSeen)}</strong></div>
            </article>)}
        </div>
        <div className="eaMonitorHelp">
          <strong>ROUND ADMISSION RULE</strong>
          <p>Exactly three bidders: Mitko, Borko, and Enchev. The first round starts automatically when all three log in. After the winner, everyone must explicitly READY to begin the next round. Admin can watch at any time and is never counted.</p>
        </div>
      </section>
      <section className="eaMonitorBottom">
        <article><span className="eaMonitorEyebrow">CURRENT / LAST ROUND</span><h2>{monitor?.auction?.title||"Waiting for round"}</h2>
          <div className="eaMonitorPrice">{monitor?.auction?euro(Number(monitor.auction.currentAmount)):"—"}</div>
          <p>{monitor?.status==="live"?"● ACTIVE AUCTION":monitor?.status==="closed"?"✓ LAST ROUND CLOSED":"WAITING IN LOBBY"} · {monitor?.auction?.sequence??0} accepted bids</p>
          {monitor?.status==="closed"&&<p>🏆 Winner: {monitor.auction?.winnerRole?.toUpperCase()||"NO BIDS"}</p>}
          <a className="eaMonitorSecondaryLink" href="/live-auctions/etap-1">Open participant view ↗</a>
        </article>
        <article><span className="eaMonitorEyebrow">LATEST BIDS</span><h2>Bid activity</h2>
          <div className="eaMonitorBids">{monitor?.bids?.length?monitor.bids.slice(0,8).map(b=>
            <div key={b.sequence}><strong>#{b.sequence} · {b.role.toUpperCase()}</strong><span>{euro(Number(b.amount))}</span><small>{when(b.at)}</small></div>
          ):<p>No bids recorded for this round yet.</p>}</div>
        </article>
      </section>
    </div>}
    <footer className="eaMonitorFooter">PRIVATE DEMONSTRATION · NO REAL MONEY OR PAYMENTS · ENCHEV AUCTIONS</footer>
  </main>;
}
