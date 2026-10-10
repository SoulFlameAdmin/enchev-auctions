"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./etap1.css";

type Role = "admin"|"mitko"|"borko"|"enchev";
type Bid = {sequence:number;role:string;amount:number;at:string};
type Auction = {
  id:string;title:string;currency:"EUR";openingAmount:number;currentAmount:number;
  increment:number;sequence:number;leadingRole:string|null;winnerRole:string|null;
  startedAt:string;endsAt:string;closedAt:string|null;
};
type Snapshot = {status:"idle"|"live"|"closed";demo:true;serverNow:string;auction:Auction|null;bids:Bid[]};
type StateReply = {authenticated?:boolean;available?:boolean;role?:Role;state?:Snapshot;error?:string};

const labelRole=(role:string|null)=>role==="mitko"?"Mitko":role==="borko"?"Borko":role==="enchev"?"Enchev":role==="admin"?"Admin":"No bidder";
const money=(value:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(value);

export default function EnchevStageOnePage(){
  const [role,setRole]=useState<Role|null>(null);
  const [loginRole,setLoginRole]=useState<Role>("mitko");
  const [code,setCode]=useState("");
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [available,setAvailable]=useState(true);
  const [connected,setConnected]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [soundOn,setSoundOn]=useState(false);
  const [localNow,setLocalNow]=useState(Date.now());
  const [lotTitle,setLotTitle]=useState("2026 Volkswagen Golf GTI — DEMO");
  const [opening,setOpening]=useState(16250);
  const [increment,setIncrement]=useState(100);
  const [duration,setDuration]=useState(120);
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const lastRef=useRef<{id:string;sequence:number;status:string}|null>(null);
  const pollingRef=useRef(false);
  const offsetRef=useRef(0);

  const play=useCallback((kind:"bid"|"close")=>{
    const ctx=audioRef.current;
    if(!soundRef.current || !ctx || ctx.state!=="running")return;
    const tones=kind==="bid"?[880,1175]:[988,784,523];
    tones.forEach((frequency,index)=>{
      const at=ctx.currentTime+index*0.13;
      const oscillator=ctx.createOscillator();
      const gain=ctx.createGain();
      oscillator.type="sine";oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0.0001,at);
      gain.gain.exponentialRampToValueAtTime(0.1,at+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,at+0.22);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(at);oscillator.stop(at+0.24);
    });
  },[]);

  const applySnapshot=useCallback((next:Snapshot)=>{
    if(next.auction){
      const prior=lastRef.current;
      if(prior?.id===next.auction.id){
        if(next.auction.sequence>prior.sequence)play("bid");
        if(next.status==="closed"&&prior.status!=="closed")play("close");
      }
      lastRef.current={id:next.auction.id,sequence:next.auction.sequence,status:next.status};
    }
    const remoteNow=Date.parse(next.serverNow);
    if(Number.isFinite(remoteNow))offsetRef.current=remoteNow-Date.now();
    setSnapshot(next);setLocalNow(Date.now());
  },[play]);

  const poll=useCallback(async()=>{
    if(pollingRef.current)return;
    pollingRef.current=true;
    try{
      const response=await fetch("/api/etap1/state",{cache:"no-store",credentials:"same-origin"});
      const data=await response.json() as StateReply;
      setAvailable(data.available!==false);
      if(response.status===401){
        setRole(null);setConnected(false);return;
      }
      if(!response.ok||!data.authenticated||!data.state)throw new Error(data.error??"Service unavailable");
      setRole(data.role??null);setConnected(true);
      applySnapshot(data.state);
    }catch{
      setConnected(false);
    }finally{pollingRef.current=false;}
  },[applySnapshot]);

  useEffect(()=>{
    void poll();
    const id=window.setInterval(()=>void poll(),1000);
    const tick=window.setInterval(()=>setLocalNow(Date.now()),200);
    return()=>{window.clearInterval(id);window.clearInterval(tick);void audioRef.current?.close();};
  },[poll]);

  const post=async(action:string,data:Record<string,unknown>)=>{
    const response=await fetch("/api/etap1/"+action,{
      method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data),
    });
    const result=await response.json() as StateReply&{ok?:boolean};
    if(!response.ok)throw new Error(result.error??"Request rejected");
    if(result.state)applySnapshot(result.state);
    return result;
  };

  const logIn=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");
    try{
      await post("login",{role:loginRole,code});
      setCode("");
      await poll();
    }catch(e){setError(e instanceof Error?e.message:"Cannot sign in");}
    finally{setBusy(false);}
  };
  const logOut=async()=>{
    if(busy)return;
    setBusy(true);
    try{await post("logout",{});setRole(null);setSnapshot(null);lastRef.current=null;}
    catch{setError("Sign out failed");}
    finally{setBusy(false);}
  };
  const start=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy||!connected)return;
    setBusy(true);setError("");
    try{await post("start",{title:lotTitle,openingAmount:opening,increment,durationSeconds:duration});}
    catch(e){setError(e instanceof Error?e.message:"Cannot start auction");}
    finally{setBusy(false);}
  };
  const bid=async()=>{
    if(busy||!connected||snapshot?.status!=="live")return;
    setBusy(true);setError("");
    try{await post("bid",{nonce:crypto.randomUUID()});}
    catch(e){setError(e instanceof Error?e.message:"Bid rejected");void poll();}
    finally{setBusy(false);}
  };
  const enableSound=async()=>{
    try{
      if(!audioRef.current)audioRef.current=new AudioContext();
      await audioRef.current.resume();
      const active=audioRef.current.state==="running";
      soundRef.current=active;setSoundOn(active);
      if(!active)setError("Device blocked audio. Tap again.");
    }catch{setError("Audio cannot start on this device.");}
  };

  const auction=snapshot?.auction;
  const remainingMs=auction?Math.max(0,Date.parse(auction.endsAt)-localNow-offsetRef.current):0;
  const remaining= Math.max(0,Math.ceil(remainingMs/1000));
  const minutes=String(Math.floor(remaining/60)).padStart(2,"0");
  const seconds=String(remaining%60).padStart(2,"0");
  const bidder=role==="mitko"||role==="borko";
  const latest=snapshot?.bids??[];

  return <main id="main-content" className="eaEtap1">
    <header className="eaEtap1Header">
      <a href="/" className="eaEtap1Brand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="eaEtap1TopRight"><span className="eaEtap1Badge">ETAP 1 · CLOSED PILOT</span><a href="/live-auctions">All auctions ↗</a></div>
    </header>
    <section className="eaEtap1Hero">
      <div><span className="eaEtap1Kicker">LIVE VEHICLE AUCTION · TEST ENVIRONMENT</span>
        <h1>Real bidders.<br/><em>One shared auction.</em></h1>
        <p>One authoritative database, two independent bidder identities, server-controlled timing and deterministic winner selection.</p>
      </div>
      <div className="eaEtap1Indicators">
        <span className={connected?"is-good":"is-warn"}>● {connected?"CONNECTED":"NOT CONNECTED"}</span>
        <span>NO REAL MONEY · DEMO ONLY</span>
      </div>
    </section>
    {!available&&<section className="eaEtap1Alert" role="alert">The isolated ENCHEV pilot database is not activated. The public website and existing auction demo remain unaffected.</section>}
    {error&&<div className="eaEtap1Alert" role="alert">{error}<button type="button" onClick={()=>setError("")}>Dismiss</button></div>}

    {!role?<section className="eaEtap1Auth">
      <div><span className="eaEtap1Kicker">PRIVATE ACCESS</span><h2>Join the closed test</h2>
        <p>Four independent roles: admin, Mitko, Borko and Enchev (observer). Obtain your unique access code privately from the project owner.</p></div>
      <form onSubmit={logIn}><label>ROLE<select value={loginRole} onChange={event=>setLoginRole(event.target.value as Role)}>
        <option value="mitko">Mitko · bidder</option><option value="borko">Borko · bidder</option>
        <option value="enchev">Enchev · observer</option><option value="admin">Admin · auction operator</option>
      </select></label>
        <label>INVITATION CODE<input type="password" autoComplete="off" minLength={16} maxLength={256} value={code} onChange={event=>setCode(event.target.value)} placeholder="Private pilot access code" required/></label>
        <button type="submit" disabled={busy||!available}>{busy?"Connecting…":"Enter auction room →"}</button>
      </form>
    </section>:<>
      <div className="eaEtap1Toolbar"><strong>Logged in as {labelRole(role)}</strong>
        <div><button type="button" onClick={()=>void enableSound()} aria-pressed={soundOn}>{soundOn?"🔊 SOUND ON":"🔇 ENABLE SOUND"}</button>
          <button type="button" onClick={()=>void poll()}>↻ Sync</button><button type="button" onClick={()=>void logOut()}>Sign out</button></div>
      </div>
      {role==="admin"&&snapshot?.status!=="live"&&<section className="eaEtap1Admin">
        <div><span className="eaEtap1Kicker">AUCTION CONTROL</span><h2>Start a new test vehicle</h2><p>Each start creates a new immutable auction ID. Previous bids remain preserved.</p></div>
        <form onSubmit={start}>
          <label>VEHICLE<input value={lotTitle} onChange={e=>setLotTitle(e.target.value)} minLength={4} maxLength={120} required/></label>
          <label>OPENING €<input type="number" min="100" max="10000000" step="1" value={opening} onChange={e=>setOpening(Number(e.target.value))} required/></label>
          <label>BID INCREMENT €<input type="number" min="10" max="100000" step="1" value={increment} onChange={e=>setIncrement(Number(e.target.value))} required/></label>
          <label>DURATION (SECONDS)<input type="number" min="30" max="600" step="1" value={duration} onChange={e=>setDuration(Number(e.target.value))} required/></label>
          <button type="submit" disabled={busy||!connected}>{busy?"Starting…":"● START LIVE AUCTION"}</button>
        </form>
      </section>}

      {auction?<section className="eaEtap1Room">
        <div className="eaEtap1MainCard">
          <div className="eaEtap1RoomHeader"><span className={snapshot?.status==="live"?"eaEtap1Live":"eaEtap1Ended"}>● {snapshot?.status==="live"?"LIVE AUCTION":"AUCTION CLOSED"}</span><small>LOT ID {auction.id.slice(0,8).toUpperCase()}</small></div>
          <div className="eaEtap1Car"><div className="eaEtap1CarGlyph" aria-hidden="true">🚘</div><span>ENCHEV VERIFIED DEMO LOT</span><h2>{auction.title}</h2><small>Illustrative vehicle · not offered for sale</small></div>
          <div className="eaEtap1PriceBand"><div><span>CURRENT HIGHEST BID</span><strong>{money(auction.currentAmount)}</strong></div><div><span>SERVER DEADLINE</span><strong className={remaining<=10?"eaEtap1Critical":""}>{minutes}:{seconds}</strong></div></div>
          <div className="eaEtap1BidInfo">
            <span>Bid #{auction.sequence}</span><span>Leader: {labelRole(auction.leadingRole)}</span>
            <span>Next: {money(auction.currentAmount+auction.increment)}</span>
          </div>
          {snapshot?.status==="live"&&bidder&&<button className="eaEtap1BidButton" type="button" onClick={()=>void bid()} disabled={!connected||busy||remaining<=0}>
            {busy?"Processing authoritative bid…":"PLACE DEMO BID · "+money(auction.currentAmount+auction.increment)}
          </button>}
          {snapshot?.status==="live"&&!bidder&&<div className="eaEtap1Observer">Observer access · you can watch bids in sync but cannot place them.</div>}
          {snapshot?.status==="closed"&&<div className="eaEtap1Winner" role="status">
            <span>🏆 FINAL SERVER RESULT</span><strong>{auction.winnerRole?labelRole(auction.winnerRole)+" wins!":"No bids · No sale"}</strong>
            <small>The winner is derived from the last accepted bid in the shared database.</small>
          </div>}
          {!connected&&<div className="eaEtap1Alert" role="alert">Connection lost. New bids are blocked until server state is restored.</div>}
        </div>
        <aside className="eaEtap1History"><span className="eaEtap1Kicker">SERVER BID LEDGER</span><h2>Live bid history</h2><p>All devices display the same accepted sequence. Refreshes do not remove bids.</p>
          <div className="eaEtap1Ledger" aria-live="polite">{latest.length?latest.map(entry=>
            <div key={entry.sequence}><div><strong>#{entry.sequence} · {labelRole(entry.role)}</strong><small>{new Date(entry.at).toLocaleTimeString("bg-BG")}</small></div><b>{money(Number(entry.amount))}</b></div>
          ):<p>Waiting for first bid…</p>}</div>
          <div className="eaEtap1Notes"><b>ANTI-SNIPING ACTIVE</b><p>Accepted bids in the final 10 seconds extend the authoritative deadline to 10 seconds after the bid.</p><b>SYNC INTERVAL · 1 SECOND</b><p>Near-real-time updates use repeated server snapshots. No fake browser-only bidding.</p></div>
        </aside>
      </section>:<section className="eaEtap1Waiting"><span className="eaEtap1Kicker">STANDBY</span><h2>Awaiting auction start</h2><p>The admin starts a round; every authenticated device then sees the same lot and server deadline.</p></section>}
    </>}
    <footer className="eaEtap1Footer">ENCHEV AUCTIONS · ETAP 1 PILOT · ISOLATED TEST DATA · NOT AN OFFER OR PAYMENT SERVICE</footer>
  </main>;
}
