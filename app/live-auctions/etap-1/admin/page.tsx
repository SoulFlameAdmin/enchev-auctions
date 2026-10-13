"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import "./monitor.css";

type Role = "mitko" | "borko" | "enchev";
type Person = {role:Role;online:boolean;ready:boolean;inGame:boolean;lastSeen:string|null;activeDevices:number};
type Auction = {id:string;title?:string;currentAmount:number;sequence:number;leadingRole?:string|null;winnerRole:string|null;startedAt?:string;endsAt?:string;nextBidAllowedAt?:string|null;closedAt?:string|null;extensionCount?:number};
type Bid = {sequence:number;role:string;amount:number;at:string};
type Attempt = {id:number;role:string;amount:number|null;code:string;accepted:boolean;at:string;expectedSequence:number|null};
type Monitor = {ok:true;serverNow:string;status:"idle"|"countdown"|"live"|"closed"|"canceled";auction:Auction|null;
  bids:Bid[];attempts:Attempt[];participants:Person[];connected:number;ready:number;inGame:number;required:number;allReady:boolean};
const roleName:Record<Role,string>={mitko:"MITKO",borko:"BORKO",enchev:"ENCHEV"};
const euro=(n:number)=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const when=(date:string|null)=>date?new Date(date).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
const whenMs=(date:string|null)=>date?new Date(date).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit",fractionalSecondDigits:3}):"—";
const duration=(ms:number)=>{const safe=Math.max(0,ms);return String(Math.floor(safe/60000)).padStart(2,"0")+":"+String(Math.floor(safe%60000/1000)).padStart(2,"0")+"."+Math.floor(safe%1000/100);};

export default function Etap1AdminMonitor() {
  const [authorized,setAuthorized]=useState(false);
  const [loading,setLoading]=useState(true);
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [monitor,setMonitor]=useState<Monitor|null>(null);
  const [lastUpdate,setLastUpdate]=useState<number|null>(null);
  const [offline,setOffline]=useState(false);
  const [localNow,setLocalNow]=useState(Date.now());
  const serverOffsetRef=useRef(0);
  const pollingRef=useRef(false);

  const refresh=useCallback(async()=>{
    if(pollingRef.current)return;
    pollingRef.current=true;
    const requestStarted=Date.now();
    try {
      const response=await fetch("/api/etap1/admin",{cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(10000)});
      if(response.status===401||response.status===403){
        setAuthorized(false);setMonitor(null);setOffline(false);setLoading(false);
        return;
      }
      const body=await response.json() as Monitor&{error?:string};
      if(!response.ok||!body.ok)throw new Error(body.error||"Monitor unavailable");
      const now=Date.now();
      // Midpoint correction keeps visual countdown smooth without claiming millisecond network accuracy.
      const serverAt=Date.parse(body.serverNow);
      if(Number.isFinite(serverAt))serverOffsetRef.current=serverAt-(requestStarted+now)/2;
      setAuthorized(true);setMonitor(body);setLocalNow(now);setLastUpdate(now);setOffline(false);setError("");
    }catch(e){
      setOffline(true);
      setError(e instanceof Error?e.message:"Connection lost");
    }finally{setLoading(false);pollingRef.current=false;}
  },[]);

  useEffect(()=>{
    void refresh();
    const interval=window.setInterval(()=>{void refresh();},1000);
    const tick=window.setInterval(()=>setLocalNow(Date.now()),100);
    return()=>{window.clearInterval(interval);window.clearInterval(tick);};
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
  const downloadOperatorRecord=()=>{
    if(!monitor||monitor.status!=="closed"||!monitor.auction)return;
    const a=monitor.auction;
    const text=[
      "ENCHEV AUCTIONS / OPERATOR DEMO RESULT",
      "DEMO ONLY — not an invoice or a signed sale agreement",
      "Auction ID: "+a.id,
      "Lot: "+(a.title??"Demonstration lot"),
      "Closed: "+(a.closedAt??"Closed — timestamp unavailable"),
      "Highest bidder: "+(a.winnerRole??"None — no bids"),
      "Highest demo bid (EUR): "+Number(a.currentAmount).toFixed(2),
      "Accepted bid count: "+a.sequence,
      "Source: server-confirmed auction snapshot",
      "Seller approval: NOT VERIFIED / DEMO",
      "Invoice and payment: NOT ISSUED / DEMO",
      "Release / transfer: NOT AUTHORIZED / DEMO"
    ].join("\n")+"\n";
    const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
    const aLink=document.createElement("a");
    aLink.href=url;aLink.download="ENCHEV-OPERATOR-DEMO-"+a.id.slice(0,8)+".txt";
    document.body.appendChild(aLink);aLink.click();aLink.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const logout=async()=>{
    setBusy(true);
    try{await fetch("/api/etap1/logout?scope=admin",{method:"POST",headers:{"Content-Type":"application/json"},
      credentials:"same-origin",body:"{}"});}finally{
      setAuthorized(false);setMonitor(null);setBusy(false);setCode("");
    }
  };

  const serverNowMs=localNow+serverOffsetRef.current;
  const remainingMs=monitor?.auction&&monitor.status==="live"
    ?Date.parse(monitor.auction.endsAt??"")-serverNowMs:0;
  const countdownMs=monitor?.auction&&monitor.status==="countdown"
    ?Date.parse(monitor.auction.startedAt??"")-serverNowMs:0;
  const cooldownMs=monitor?.auction&&monitor.status==="live"&&monitor.auction.nextBidAllowedAt
    ?Date.parse(monitor.auction.nextBidAllowedAt)-serverNowMs:0;
  const lastSyncAgeMs=lastUpdate===null?Infinity:Math.max(0,localNow-lastUpdate);
  return <main className="eaAdminMonitor">
    <header className="eaMonitorTop">
      <a href="/" className="eaMonitorBrand">ENCHEV <small>AUCTIONS</small></a>
      <div><span className="eaMonitorTag">DEMO ONLY · CONTROL ROOM</span>
        {authorized&&<span className={"eaMonitorSignal "+(offline?"bad":"good")}>{offline?"● OFFLINE":"● SERVER POLL · 1s"}</span>}</div>
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
        <div className="eaMonitorTime">SERVER CLOCK <strong>{monitor?whenMs(new Date(serverNowMs).toISOString()):"—"}</strong><small>{lastUpdate?"Last confirmed snapshot "+(lastSyncAgeMs/1000).toFixed(1)+"s ago":"Connecting"} · countdown UI 0.1s</small></div>
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
              <div className="eaMonitorLast">DEVICES <strong>{p.activeDevices}</strong><small>LAST SEEN {when(p.lastSeen)}</small></div>
            </article>)}
        </div>
        <div className="eaMonitorHelp">
          <strong>ROUND ADMISSION RULE</strong>
          <p>Exactly three bidders: Mitko, Borko and Enchev. Each configures a DEMO budget and presses READY. The third READY starts a common 30-second countdown. Every accepted offer starts a 5-second server cooldown for all. Admin remains watch-only and is never counted.</p>
        </div>
      </section>
      <section className="eaMonitorBottom">
        <article><span className="eaMonitorEyebrow">CURRENT / LAST ROUND</span><h2>{monitor?.auction?.title||"Waiting for round"}</h2>
          <div className="eaMonitorPrice">{monitor?.auction?euro(Number(monitor.auction.currentAmount)):"—"}</div>
          <p>{monitor?.status==="countdown"?"🔴 30-SECOND SERVER COUNTDOWN":monitor?.status==="live"?"● ACTIVE AUCTION":monitor?.status==="closed"?"✓ LAST ROUND CLOSED":"WAITING IN LOBBY"} · {monitor?.auction?.sequence??0} accepted bids</p>
          {monitor?.auction&&monitor.status==="countdown"&&<div className="eaAdminLiveClock">STARTS IN <strong>{duration(countdownMs)}</strong><small>Scheduled server start: {whenMs(monitor.auction.startedAt??null)}</small></div>}
          {monitor?.auction&&monitor.status==="live"&&<div className="eaAdminLiveClock" aria-live="off">AUCTION TIME LEFT <strong>{duration(remainingMs)}</strong><small>Server end: {whenMs(monitor.auction.endsAt??null)} · Extensions: {monitor.auction.extensionCount??0}</small></div>}
          {monitor?.auction&&monitor.status==="live"&&<div className="eaAdminLiveClock">GLOBAL BID COOLDOWN <strong>{cooldownMs>0?(Math.ceil(cooldownMs/100)/10).toFixed(1)+"s":"OPEN"}</strong><small>Bid sequence {monitor.auction.sequence} · Server-wide 5s lock</small></div>}
          {monitor?.status==="closed"&&<p>🏆 Highest demo bidder: {monitor.auction?.winnerRole?.toUpperCase()||"NO BIDS"}. Await seller approval for any real sale.</p>}
          {monitor?.status==="closed"&&monitor.auction&&<button type="button" onClick={downloadOperatorRecord} className="eaMonitorSecondaryLink">↓ Download operator DEMO result (not invoice)</button>}
          <a className="eaMonitorSecondaryLink" href="/live-auctions/etap-1">Open participant view ↗</a>
        </article>
        <article><span className="eaMonitorEyebrow">LATEST BIDS</span><h2>Bid activity</h2>
          <div className="eaMonitorBids">{monitor?.bids?.length?monitor.bids.slice(0,8).map(b=>
            <div key={b.sequence}><strong>#{b.sequence} · {b.role.toUpperCase()}</strong><span>{euro(Number(b.amount))}</span><small>{whenMs(b.at)}</small></div>
          ):<p>No bids recorded for this round yet.</p>}</div>
        </article>
      </section>
      <section className="eaAdminBidAudit" aria-label="Server bid attempt log">
        <div className="eaMonitorSectionTitle"><div><span className="eaMonitorEyebrow">SERVER AUDIT · MILLISECOND TIMESTAMPS</span><h2>All bid attempts</h2></div><b>{monitor?.attempts?.length??0} RECENT</b></div>
        <p>Accepted, rejected and duplicate attempts for the current/last round. Time is recorded by PostgreSQL; data refreshes every 1 second.</p>
        <div className="eaAdminAuditRows">{monitor?.attempts?.length?monitor.attempts.map(a=>
          <div key={a.id} className={a.accepted?"accepted":"rejected"}>
            <small>{whenMs(a.at)}</small><strong>{a.role.toUpperCase()}</strong>
            <b>{a.amount===null?"—":euro(Number(a.amount))}</b>
            <span>{a.code}</span>
            <small>SEQ {a.expectedSequence??"—"}</small>
          </div>):<p>No server bid attempts for this round yet.</p>}</div>
      </section>
    </div>}
    <footer className="eaMonitorFooter">PRIVATE DEMONSTRATION · NO REAL MONEY OR PAYMENTS · ENCHEV AUCTIONS</footer>
  </main>;
}
