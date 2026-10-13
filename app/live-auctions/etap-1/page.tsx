"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Etap1DemoVehicle from "./Etap1DemoVehicle";
import "./etap1.css";

type Role = "admin"|"mitko"|"borko"|"enchev";
type Bid = {sequence:number;role:string;amount:number;at:string};
type Auction = {
  id:string;title:string;currency:"EUR";openingAmount:number;currentAmount:number;
  increment:number;sequence:number;leadingRole:string|null;winnerRole:string|null;
  nextBidAllowedAt?:string|null;cooldownSeconds?:number;minimumStep?:number;maximumOffer?:number;
  startedAt:string;endsAt:string;closedAt:string|null;
};
type Snapshot = {status:"idle"|"countdown"|"live"|"closed"|"canceled";demo:true;serverNow:string;auction:Auction|null;bids:Bid[]};
type Lobby = {count:number;readyCount:number;minPlayers:number;admitted?:boolean;sessionCurrent?:boolean;wallet?:{buyingPower:number;lotBudget:number}|null;participants:{role:string;ready:boolean}[]};
type StateReply = {authenticated?:boolean;available?:boolean;role?:Role;state?:Snapshot;lobby?:Lobby;error?:string};

const labelRole=(role:string|null)=>role==="mitko"?"Mitko":role==="borko"?"Borko":role==="enchev"?"Enchev":role==="admin"?"Admin":"No bidder";
const money=(value:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(value);

export default function EnchevStageOnePage(){
  const [role,setRole]=useState<Role|null>(null);
  const [loginRole,setLoginRole]=useState<Role>("mitko");
  const [code,setCode]=useState("");
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [lobby,setLobby]=useState<Lobby|null>(null);
  const [available,setAvailable]=useState(true);
  const [connected,setConnected]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [soundOn,setSoundOn]=useState(false);
  const [localNow,setLocalNow]=useState(Date.now());
  const [lotTitle,setLotTitle]=useState("2026 Volkswagen Golf GTI — DEMO");
  const [opening,setOpening]=useState(16250);
  const [increment]=useState(100);
  const [duration,setDuration]=useState(120);
  const [mediaView,setMediaView]=useState("FRONT");
  const [detailTab,setDetailTab]=useState("History");
  const [voiceLang,setVoiceLang]=useState("en-IE");
  const [voiceOn,setVoiceOn]=useState(false);
  const [bidFlash,setBidFlash]=useState<{sequence:number;amount:number;role:string}|null>(null);
  const [celebratingId,setCelebratingId]=useState<string|null>(null);
  const [selectedStep,setSelectedStep]=useState(100);
  const [customStep,setCustomStep]=useState("250");
  const [budgetDraft,setBudgetDraft]=useState("20000");
  const [moreOpen,setMoreOpen]=useState(false);
  const [historyExpanded,setHistoryExpanded]=useState(false);
  const voiceRef=useRef(false);
  const voiceLangRef=useRef("en-IE");
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const lastRef=useRef<{id:string;sequence:number;status:string}|null>(null);
  const lastServerNowRef=useRef(0);
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
    // Never repaint a newer accepted bid with an older in-flight poll response.
    const receivedAt=Date.parse(next.serverNow);
    if(!Number.isFinite(receivedAt)||receivedAt<lastServerNowRef.current)return;
    lastServerNowRef.current=receivedAt;
    if(next.auction){
      const prior=lastRef.current;
      if(prior?.id===next.auction.id){
        if(next.auction.sequence>prior.sequence){
          const lastAccepted=next.bids[0];
          if(lastAccepted)setBidFlash({sequence:lastAccepted.sequence,amount:Number(lastAccepted.amount),role:lastAccepted.role});
          play("bid");
          if(voiceRef.current&&typeof window!=="undefined"&&"speechSynthesis" in window){
            const last=next.bids[0];
            if(last){
              const bg=voiceLangRef.current.startsWith("bg");
              const words=bg
                ? "Нова оферта. "+Math.round(Number(last.amount))+" евро. Води "+labelRole(last.role)
                : "New bid. "+Math.round(Number(last.amount))+" euros. Leader "+labelRole(last.role);
              const speech=new SpeechSynthesisUtterance(words);
              speech.lang=voiceLangRef.current;speech.rate=1.07;
              const options=window.speechSynthesis.getVoices();
              const preferred=options.find(v=>v.lang===speech.lang&&v.name.includes("Emily"))||
                options.find(v=>v.lang===speech.lang)||
                options.find(v=>v.lang.split("-")[0]===speech.lang.split("-")[0]);
              if(preferred)speech.voice=preferred;
              window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);
            }
          }
        }
        if(next.status==="closed"&&prior.status!=="closed"){
          if(next.auction.winnerRole)setCelebratingId(next.auction.id);
          play("close");
          if(voiceRef.current&&typeof window!=="undefined"&&"speechSynthesis" in window){
            const bg=voiceLangRef.current.startsWith("bg");
            const speech=new SpeechSynthesisUtterance(
              next.auction.winnerRole
                ? (bg?"Търгът приключи. Победител ": "Auction finished. Winner ")+labelRole(next.auction.winnerRole)+
                  (bg?" с цена ":" with final price ")+Math.round(Number(next.auction.currentAmount))+(bg?" евро.":" euros.")
                : (bg?"Търгът приключи без оферти.":"Auction finished. No bids.")
            );
            speech.lang=voiceLangRef.current;
            const preferred=window.speechSynthesis.getVoices().find(v=>v.lang===speech.lang&&v.name.includes("Emily"))||
              window.speechSynthesis.getVoices().find(v=>v.lang===speech.lang);
            if(preferred)speech.voice=preferred;
            window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);
          }
        }
      }
      lastRef.current={id:next.auction.id,sequence:next.auction.sequence,status:next.status};
    }
    offsetRef.current=receivedAt-Date.now();
    setSnapshot(next);setLocalNow(Date.now());
  },[play]);

  const poll=useCallback(async()=>{
    if(pollingRef.current)return;
    pollingRef.current=true;
    try{
      const response=await fetch("/api/etap1/state",{cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(10000)});
      const data=await response.json() as StateReply;
      setAvailable(data.available!==false && !(response.status===503 && data.error==="Pilot not activated"));
      if(response.status===401){
        setRole(null);setConnected(false);setLobby(null);setSnapshot(null);return;
      }
      if(!response.ok||!data.authenticated||!data.state)throw new Error(data.error??"Service unavailable");
      setRole(data.role??null);setConnected(true);
      if(data.lobby)setLobby(data.lobby);
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

  useEffect(()=>{
    if(!bidFlash)return;
    const timeout=window.setTimeout(()=>setBidFlash(null),3400);
    return()=>window.clearTimeout(timeout);
  },[bidFlash]);
  useEffect(()=>{
    if(!celebratingId)return;
    const timeout=window.setTimeout(()=>setCelebratingId(null),5600);
    return()=>window.clearTimeout(timeout);
  },[celebratingId]);

  const post=async(action:string,data:Record<string,unknown>)=>{
    const response=await fetch("/api/etap1/"+action,{
      method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data),signal:AbortSignal.timeout(12000),
    });
    const result=await response.json() as StateReply&{ok?:boolean};
    if(result.state)applySnapshot(result.state);
    if(result.lobby)setLobby(result.lobby);
    if(!response.ok)throw new Error(result.error??"Request rejected");
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
    try{await post("logout",{});setRole(null);setSnapshot(null);setLobby(null);setBidFlash(null);setCelebratingId(null);lastRef.current=null;lastServerNowRef.current=0;}
    catch{setError("Sign out failed");}
    finally{setBusy(false);}
  };

  const updateWallet=async(topup:number,lotBudget:number|null=null)=>{
    if(busy||!connected||snapshot?.status==="countdown"||snapshot?.status==="live")return;
    setBusy(true);setError("");
    try{await post("wallet",{topup,lotBudget});}
    catch(e){setError(e instanceof Error?e.message:"Budget change rejected");}
    finally{setBusy(false);}
  };
  const setReady=async(next:boolean)=>{
    if(busy||!connected||snapshot?.status==="live"||snapshot?.status==="countdown")return;
    setBusy(true);setError("");
    try{await post("ready",{ready:next});}
    catch(e){setError(e instanceof Error?e.message:"Cannot change READY status");void poll();}
    finally{setBusy(false);}
  };
  const bid=async()=>{
    const activeAuction=snapshot?.auction;
    if(!activeAuction||snapshot?.status!=="live")return;
    const now=Date.now()+offsetRef.current;
    const amount=Number(activeAuction.currentAmount)+selectedStep;
    if(busy||!connected||!lobby?.admitted||!Number.isSafeInteger(amount)||
       amount>100000||amount>(Number(lobby.wallet?.lotBudget) || 0)||
       amount>(Number(lobby.wallet?.buyingPower) || 0)||
       activeAuction.leadingRole===role||
       (activeAuction.nextBidAllowedAt&&Date.parse(activeAuction.nextBidAllowedAt)>now)||
       Date.parse(activeAuction.startedAt)>now||
       Date.parse(activeAuction.endsAt)<=now)return;
    setBusy(true);setError("");
    try{
      await post("bid",{nonce:crypto.randomUUID(),amount,expectedSequence:activeAuction.sequence});
    }
    catch(e){setError(e instanceof Error?e.message:"Bid rejected");void poll();}
    finally{setBusy(false);}
  };
  const downloadDemoClosingRecord=()=>{
    const finished=snapshot?.auction;
    if(snapshot?.status!=="closed"||!finished)return;
    // A factual DEMO evidence record, not an invoice, receipt, contract or vehicle title.
    const closed=finished.closedAt??finished.endsAt;
    const lines=[
      "ENCHEV AUCTIONS — DEMO AUCTION CLOSING RECORD",
      "NOT AN INVOICE / CONTRACT / PAYMENT CONFIRMATION / PROOF OF OWNERSHIP",
      "DEMO ONLY — NO REAL PURCHASE, PAYMENT OR VEHICLE TRANSFER",
      "",
      "Auction ID: "+finished.id,
      "Lot: "+finished.title,
      "Closed at (server, ISO): "+closed,
      "Highest bidder: "+(finished.winnerRole??"None — no accepted bids"),
      "Final demo amount (EUR): "+Number(finished.currentAmount).toFixed(2),
      "Accepted bid count: "+finished.sequence,
      "Viewer role: "+(role??"Unknown"),
      "",
      "Next real-world steps (not active in this demo):",
      "Seller approval / reserve verification -> written confirmation",
      "Order & itemized invoice -> payment verification",
      "Documents review -> release authorization -> pickup/transport",
      "Do NOT transfer funds based on this demonstration record."
    ];
    const blob=new Blob([lines.join("\n")+"\n"],{type:"text/plain;charset=utf-8"});
    const objectUrl=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=objectUrl;anchor.download="ENCHEV-DEMO-RESULT-"+finished.id.slice(0,8)+".txt";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  };
  const replayWinner=()=>{
    if(snapshot?.status!=="closed"||!snapshot.auction?.winnerRole)return;
    const id=snapshot.auction.id;
    setCelebratingId(null);
    window.setTimeout(()=>setCelebratingId(id),24);
    play("close");
    if(voiceRef.current&&"speechSynthesis" in window){
      const bg=voiceLangRef.current.startsWith("bg");
      const speech=new SpeechSynthesisUtterance(bg
        ?"Победител "+labelRole(snapshot.auction.winnerRole)+". Финална цена "+Math.round(Number(snapshot.auction.currentAmount))+" евро."
        :"Winner "+labelRole(snapshot.auction.winnerRole)+". Final price "+Math.round(Number(snapshot.auction.currentAmount))+" euros.");
      speech.lang=voiceLangRef.current;
      window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);
    }
  };
  const enableVoice=()=>{
    if(voiceOn){
      voiceRef.current=false;setVoiceOn(false);
      if("speechSynthesis" in window)window.speechSynthesis.cancel();
      return;
    }
    if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
      setError("This device does not support auctioneer voice. Bid tones can still work.");
      return;
    }
    voiceRef.current=true;setVoiceOn(true);
    const speech=new SpeechSynthesisUtterance(voiceLangRef.current.startsWith("bg")
      ?"Гласът на търга е включен. Готови за наддаване."
      :"Auctioneer ready. Welcome to ENCHEV.");
    speech.lang=voiceLangRef.current;
    const voices=window.speechSynthesis.getVoices();
    const preferred=voices.find(v=>v.lang===speech.lang&&v.name.includes("Emily"))||
      voices.find(v=>v.lang===speech.lang)||
      voices.find(v=>v.lang.split("-")[0]===speech.lang.split("-")[0]);
    if(preferred)speech.voice=preferred;
    window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);
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
  const bidder=role==="mitko"||role==="borko"||role==="enchev";
  const participant=bidder;
  const myReady=Boolean(lobby?.participants.some(p=>p.role===role&&p.ready));
  const corePresent=["mitko","borko","enchev"].every(expected=>lobby?.participants.some(p=>p.role===expected));
  const minPlayers=lobby?.minPlayers??3;
  const latest=snapshot?.bids??[];
  const currentPrice=auction?.currentAmount??opening;
  const minStep=auction?.minimumStep??50;
  const stepIsValid=Number.isSafeInteger(selectedStep)&&selectedStep>=minStep&&selectedStep<=100000;
  const nextPrice=currentPrice+(stepIsValid?selectedStep:100);
  const wallet=lobby?.wallet;
  const budgetCap=Math.min(Number(wallet?.buyingPower??0),Number(wallet?.lotBudget??0),100000);
  const countdownRemaining=auction?Math.max(0,Math.ceil((Date.parse(auction.startedAt)-localNow-offsetRef.current)/1000)):0;
  const cooldownRemaining=auction?.nextBidAllowedAt?Math.max(0,Math.ceil((Date.parse(auction.nextBidAllowedAt)-localNow-offsetRef.current)/1000)):0;
  const roundLocked=cooldownRemaining>0;
  const visibleRound=cooldownRemaining;
  const budgetSufficient=budgetCap>=nextPrice;
  const status=snapshot?.status??"idle";
  const timeUntil=Math.max(0,Math.ceil(remainingMs/1000));
  const clockTotalMs=auction?Math.max(10000,Date.parse(auction.endsAt)-Date.parse(auction.startedAt)):10000;
  const clockProgress=status==="live"?Math.min(100,Math.max(0,remainingMs/clockTotalMs*100)):status==="closed"?100:100;
  const clockStyle={"--ev9-progress":clockProgress+"%"} as CSSProperties;
  // Server-owned cooldown; no per-browser tick-based bid permission.
  // A login/refresh never grants access to an already-running round.
  // Admission is bound to the signed browser session that joined before the first round or explicitly pressed READY for the next.
  const admitted=lobby?.admitted===true;
  const showAuction=status==="live"&&admitted;
  const canBid=status==="live"&&bidder&&admitted&&connected&&!busy&&timeUntil>0&&!roundLocked&&budgetSufficient&&stepIsValid&&auction?.leadingRole!==role;
  const preparingRound=status!=="live"||!showAuction;
  const phaseStep=status==="live"?2:1;
  const views=["FRONT","REAR","INTERIOR","DETAIL","SIDE"];
  const tabs=["Details","Photos","History","Documents","Transport","Condition"];

  return <main id="main-content" className={"eaEtap1 eaRoom"+(showAuction&&bidder?" eaHasBidDock":"")}>
    <header className="eaRoomHeader">
      <a className="eaRoomLogo" href="/" aria-label="ENCHEV Home"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <div className="eaRoomTitle"><strong><span className="eaLiveDot"/> LIVE AUCTION</strong><small>PRIVATE DEMONSTRATION</small></div>
      <div className="eaHeaderActions">
        <span className={"eaConnection "+(connected?"is-online":"")} title={connected?"Live connection":"Waiting for connection"}>{connected?"● ONLINE":"○ OFFLINE"}</span>
        {role&&<button className="eaSoundToggle" type="button" aria-label={soundOn?"Sound enabled":"ENABLE SOUND"} onClick={()=>void enableSound()}>{soundOn?"🔊":"🔇"}<span>{soundOn?"ON":"SOUND"}</span></button>}
        {role&&<div className="eaSettings">
          <button className="eaSettingsToggle" type="button" aria-label="Open room settings" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}>⋯</button>
          {moreOpen&&<div className="eaSettingsMenu">
            <strong>ROOM SETTINGS</strong>
            <label>Voice language<select value={voiceLang} onChange={e=>{setVoiceLang(e.target.value);voiceLangRef.current=e.target.value;}}>
              <option value="en-IE">English (Ireland)</option><option value="bg-BG">Български</option>
            </select></label>
            <button type="button" aria-pressed={voiceOn} onClick={enableVoice}>{voiceOn?"🔊 Voice ON":"🎙 Enable auctioneer voice"}</button>
            <button type="button" onClick={()=>{void poll();setMoreOpen(false);}}>↻ Refresh connection</button>
            <button type="button" onClick={()=>{void logOut();setMoreOpen(false);}}>Sign out</button>
          </div>}
        </div>}
      </div>
    </header>
    <div className="eaRoomStatus">
      <span>{role?<><i className="eaLiveDot"/> {labelRole(role)} <b>{bidder?"· BIDDER":"· OPERATOR"}</b></>:"WELCOME TO THE LIVE ROOM"}</span>
      <span>DEMO ONLY <span className="eaStatusSep">·</span> NO REAL PAYMENTS</span>
    </div>
    {!available&&<div className="eaRoomAlert" role="alert">This private pilot is not active. Bidding is disabled.</div>}
    {error&&<div className="eaRoomAlert" role="alert">{error}<button type="button" onClick={()=>setError("")}>×</button></div>}
    {!role?<section className="eaLoginCard">
      <div className="eaLoginWelcome"><span className="eaEyebrow">ENCHEV · INVITATION ACCESS</span>
        <h1>Enter the live room.</h1>
        <p>Private DEMO: select your test budget and press READY. When all three are ready, a shared 30-second countdown starts. No real deposits.</p>
        <div className="eaLoginDecor"><span>01 · JOIN</span><span>02 · BUDGET</span><span>03 · READY</span><span>03 · BID</span><span>04 · WIN</span></div>
      </div>
      <form onSubmit={logIn}>
        <label>Your role<select value={loginRole} onChange={e=>setLoginRole(e.target.value as Role)}>
          <option value="mitko">Mitko — bidder</option>
          <option value="borko">Borko — bidder</option>
          <option value="enchev">Enchev — bidder</option>
        </select></label>
        <label>Invitation code<input value={code} type="password" autoComplete="off" minLength={loginRole==="admin"?16:4} maxLength={256} required placeholder="Your private code" onChange={e=>setCode(e.target.value)}/></label>
        <button className="eaActionPrimary" type="submit" disabled={!available||busy}>{busy?"CONNECTING…":"ENTER AUCTION ROOM →"}</button>
        <small>Access is limited to invited demo participants.</small>
      </form>
    </section>:<div className="eaRoomContent">
      {preparingRound&&<section className="eaReadyCard" aria-label="Participant readiness">
        <div className="eaReadyText">
          <span className="eaEyebrow"><span className="eaLiveDot"/> NEXT ROUND</span>
          <h2>{status==="countdown"?"🔴 STARTING IN "+String(Math.floor(countdownRemaining/60)).padStart(2,"0")+":"+String(countdownRemaining%60).padStart(2,"0"):status==="live"?"Round in progress — wait for next READY":((lobby?.count??0)<minPlayers||!corePresent)?"Waiting for invited participants":myReady?"You're ready.":"Ready to start?"}</h2>
          <div className="eaReadyPeople">{(lobby?.participants??[]).map(person=>
            <span className={person.ready?"is-ready":""} key={person.role}>{person.ready?"●":"○"} {labelRole(person.role)}</span>)}
          </div>
          <p>{status==="countdown"?"30-second synchronized pre-live countdown. Bidding will unlock at the authoritative server start time.":status==="live"
            ?"This round started without your current login. You cannot bid; when it ends, press I'M READY for the next one."
            :((lobby?.count??0)<minPlayers||!corePresent)?"Mitko, Borko and Enchev must join, set their DEMO budgets, then all press READY."
            :(lobby?.readyCount??0)===(lobby?.count??0)?"Countdown starting…":"All three must press READY to begin the countdown."}</p>
        </div>
        <div className="eaReadyControl">
          <span>{lobby?.readyCount??0}/{lobby?.count??0} READY</span>
          {participant?(status==="live"||status==="countdown"
            ?<small>{status==="countdown"?"Countdown is running.":"New login? Wait until the current auction closes."}</small>
            :<button type="button" onClick={()=>void setReady(!myReady)} disabled={!connected||busy||(Number(wallet?.lotBudget??0)<16300&&!myReady)} className={myReady?"is-ready":""}>{busy?"UPDATING…":myReady?"✓ READY":"I'M READY →"}</button>
          ):<small>Admin does not count.</small>}
        </div>
      </section>}
      {role==="admin"&&<div className="eaMonitorEntry"><a href="/live-auctions/etap-1/admin" aria-label="Open live admin dashboard">▣ OPEN ADMIN CONTROL ROOM →</a><small>Full-screen PC monitor · LIVE roster · READY · active bidders</small></div>}
      {role==="admin"&&preparingRound&&<p className="eaOperatorNote">🔒 The first round starts on three bidder logins; later rounds require three READY clicks. The operator never starts or blocks the auction.</p>}
      {participant&&status!=="live"&&status!=="countdown"&&<section className="eaDemoWallet" aria-label="DEMO buying power">
        <div className="eaDemoWalletHead"><div><span className="eaEyebrow">DEMO CREDIT · NO REAL DEPOSIT</span><h2>💰 BUYING POWER {money(Number(wallet?.buyingPower??10000))}</h2></div><span>LOT LIMIT: {money(Number(wallet?.lotBudget??10000))}</span></div>
        <p>Every login starts with €10,000 test credit. This lot opens at €16,250; your lot budget must be at least €16,300 before READY.</p>
        <div className="eaWalletActions">
          {[5000,10000,20000].map(v=><button type="button" key={v} disabled={busy||myReady||Number(wallet?.buyingPower??0)+v>100000} onClick={()=>void updateWallet(v)}>+ {money(v)} DEMO</button>)}
        </div>
        <form onSubmit={e=>{e.preventDefault();void updateWallet(0,Number(budgetDraft));}}>
          <label>MAXIMUM FOR THIS CAR (€)<input type="number" inputMode="numeric" min="0" max={Number(wallet?.buyingPower??10000)} step="1" value={budgetDraft} onChange={e=>setBudgetDraft(e.target.value)} disabled={busy||myReady}/></label>
          <button type="submit" disabled={busy||myReady||!budgetDraft||!Number.isSafeInteger(Number(budgetDraft))||Number(budgetDraft)<0||Number(budgetDraft)>Number(wallet?.buyingPower??0)}>SAVE LOT BUDGET</button>
        </form>
        <p className="eaBudgetAdvice">🤖 DEMO BUDGET ASSISTANT · RULE-BASED: {Number(wallet?.lotBudget??0)<16300?"Your configured budget is below the minimum €16,300 first offer. Add DEMO credit and raise the lot budget.":"Respect your chosen limit. Taxes, transport and repair costs are not verified or included."}</p>
      </section>}
      {participant&&<section className="eaVehicleFacts" aria-label="Auction vehicle information">
        <div className="eaVehicleFactsHead"><span>LOT · DEMO-001</span><h2>2026 Volkswagen Golf GTI · REFERENCE LOT</h2><small>Illustrative vehicle and photo; not a confirmed inspection, sale, document or VIN.</small></div>
        <div className="eaLotTabs">{["Details","Condition","Documents","Transport","History"].map(t=><button type="button" key={t} aria-pressed={detailTab===t} className={detailTab===t?"is-active":""} onClick={()=>setDetailTab(t)}>{t}</button>)}</div>
        {detailTab==="Details"&&<div className="eaLotGrid">{[["LOT ID","DEMO-001"],["YEAR","2026 (illustrative)"],["VIN","NOT VERIFIED"],["MILEAGE","NOT VERIFIED"],["ENGINE","NOT VERIFIED"],["FUEL","NOT VERIFIED"],["TRANSMISSION","NOT VERIFIED"],["LOCATION","NOT VERIFIED"],["START TIME","Server-controlled"],["OPENING BID","€16,250"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Condition"&&<div className="eaLotGrid">{[["STARTS / RUNS","UNKNOWN"],["DRIVEABLE","UNKNOWN"],["PRIMARY DAMAGE","NOT VERIFIED"],["SECONDARY DAMAGE","NOT VERIFIED"],["KEYS","NOT VERIFIED"],["INSPECTION REPORT","NOT AVAILABLE"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Documents"&&<p>DEMO closing record becomes available when a round ends. Vehicle title, seller authorization and original papers: NOT VERIFIED.</p>}
        {detailTab==="Transport"&&<p>Pickup location, taxes, shipping costs and delivery terms: NOT VERIFIED. No real vehicle release.</p>}
        {detailTab==="History"&&<p>{auction?auction.sequence+" accepted server-verified offers in the current / last round.":"No round started."} During LIVE, bid history is shown below.</p>}
      </section>}
      {status==="closed"&&auction&&<section className="eaFinalResult" aria-labelledby="eaFinalTitle" aria-live="polite">
        <span className="eaFinalEyebrow">🏁 AUCTION CLOSED · SERVER CONFIRMED · DEMO ONLY</span>
        <h2 id="eaFinalTitle">{!auction.winnerRole?"No bids — no winning bidder":auction.winnerRole===role?"🏆 YOU ARE THE HIGHEST BIDDER":"🏆 HIGHEST BID: "+labelRole(auction.winnerRole)}</h2>
        <p>{auction.winnerRole===role?"Your bid finished highest in this TEST round.":"The server has finished the demonstration round."} No purchase, payment or ownership transfer has occurred.</p>
        <strong className="eaFinalAmount">{money(auction.currentAmount)}</strong>
        <div className="eaFinalFacts">
          <span>LOT <b>{auction.id.slice(0,8).toUpperCase()}</b></span>
          <span>BIDS <b>{auction.sequence}</b></span>
          <span>WINNER <b>{labelRole(auction.winnerRole)}</b></span>
          <span>FINISHED <b>{new Date(auction.closedAt??auction.endsAt).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</b></span>
        </div>
        <p className="eaFinalNext">NEXT: Confirm the result in the admin panel → demonstrate seller approval → demo document pack → simulated payment → release only after checks. All three participants press READY for another round.</p>
        <div className="eaFinalActions">
          <button type="button" onClick={downloadDemoClosingRecord}>↓ Download DEMO result record</button>
          {auction.winnerRole&&<button type="button" onClick={replayWinner}>🏆 Replay winner announcement</button>}
        </div>
        <small>This downloaded record is not a fiscal invoice, sale contract, payment request, vehicle title or release authorization.</small>
      </section>}
      {showAuction&&<>
      <section className="eaAuctionIntro">
        <div><span className={"eaAuctionStatus "+(status==="live"?"is-live":"")}>{status==="live"?"● LIVE NOW":"◉ READY FOR NEXT ROUND"}</span><span className="eaAuctionLot">LOT {status==="live"&&auction?auction.id.slice(0,8).toUpperCase():"DEMO–001"}</span></div>
        <h1>{status==="live"&&auction?auction.title:lotTitle}</h1>
        <p>Private demo auction · Illustrative vehicle · EUR</p>
      </section>
      <section className="eaAuctionGrid" aria-label="Demo auction">
        <div className="eaMediaPanel">
          <div className="eaMediaStage">
            <Etap1DemoVehicle view={mediaView}/>
            {mediaView==="FRONT"&&<img className="eaFeaturedPhoto"
              src="https://images.unsplash.com/photo-1746184842826-73fd144a4587?auto=format&fit=crop&w=1280&q=82"
              alt="Illustrative Golf GTI photograph from a showroom — not the vehicle in this demo auction"
              loading="eager" decoding="async"
              onError={e=>{e.currentTarget.style.display="none";}}/>}
            <span className="eaVehicleLabel">{mediaView==="FRONT"?"GOLF GTI · REFERENCE PHOTO":"ILLUSTRATIVE DEMO VIEW"}</span>
            {mediaView==="FRONT"&&<a className="eaPhotoCredit" href="https://unsplash.com/photos/a-grey-volkswagen-golf-gti-sits-in-a-showroom-81NrHQ6TBqE" target="_blank" rel="noopener noreferrer" aria-label="Photo credit: Shalev Cohen, Unsplash">Photo: Shalev Cohen / Unsplash</a>}
            <div className={"eaClock "+(status==="live"?"is-live":"")+(status==="live"&&timeUntil<=10?" urgent":"")} style={clockStyle}>
              <div><span>{status==="live"?"TIME LEFT":"NEXT ROUND"}</span><strong>{status==="live"?minutes+":"+seconds:"READY"}</strong></div>
            </div>
            <div className="eaMediaNav">
              <button type="button" aria-label="Previous vehicle view" onClick={()=>setMediaView(views[(views.indexOf(mediaView)+views.length-1)%views.length])}>‹</button>
              <span>{mediaView} · {views.indexOf(mediaView)+1}/5</span>
              <button type="button" aria-label="Next vehicle view" onClick={()=>setMediaView(views[(views.indexOf(mediaView)+1)%views.length])}>›</button>
            </div>
          </div>
          <div className="eaMediaViews" aria-label="Illustrative vehicle angles">{views.map(v=><button type="button" key={v} className={mediaView===v?"is-selected":""} aria-pressed={mediaView===v} onClick={()=>setMediaView(v)}>{v==="INTERIOR"?"INSIDE":v}</button>)}</div>
        </div>
        <div className="eaBiddingPanel">
          <div className="eaPriceTop"><span>{status==="live"?"CURRENT HIGHEST BID":"NEXT ROUND · OPENING PRICE"}</span><span className={status==="live"?"eaBiddingLive":""}>{status==="live"?"● LIVE":status==="closed"?"● LAST ROUND FINISHED":"● STANDBY"}</span></div>
          <strong className="eaHeroAmount">{money(status==="live"?currentPrice:opening)}</strong>
          <div className="eaBidMeta"><span>LEADER <b>{status==="live"?labelRole(auction?.leadingRole??null):"—"}</b></span><span>BIDS <b>{status==="live"?auction?.sequence??0:"—"}</b></span></div>
          <div className="eaNextBid"><span>YOUR EXACT BID AMOUNT</span><strong>{money(nextPrice)}</strong><small>Minimum +{money(minStep)} · Your budget: {money(budgetCap)}</small></div>
          {status==="live"&&bidder&&<div className="eaOfferControls">
            <span>RAISE BY</span>
            <div className="eaOfferSteps">{[50,100,250,500,1000].map(x=><button key={x} type="button" aria-pressed={selectedStep===x} className={selectedStep===x?"is-active":""} onClick={()=>setSelectedStep(x)}>+{money(x)}</button>)}</div>
            <form onSubmit={e=>{e.preventDefault();const v=Number(customStep);if(Number.isSafeInteger(v)&&v>=50&&v<=100000)setSelectedStep(v);else setError("CUSTOM increase must be an integer between €50 and €100,000.");}}>
              <label>CUSTOM INCREASE (€)<input type="number" inputMode="numeric" step="1" min="50" max="100000" value={customStep} onChange={e=>setCustomStep(e.target.value)}/></label>
              <button type="submit">USE CUSTOM</button>
            </form>
          </div>}
          {status==="live"&&<div className="eaServerCooldown" role="status">{roundLocked?"⏳ GLOBAL SERVER COOLDOWN: "+cooldownRemaining+"s":auction?.leadingRole===role?"🟢 YOU ARE LEADING — WAIT FOR ANOTHER BID":"🟢 GLOBAL COOLDOWN CLEAR — BIDDING OPEN"}{!budgetSufficient&&" · BUDGET LIMIT REACHED"}</div>
          {status==="live"&&bidder?
            <button className="eaActionPrimary eaPlaceBid" type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"CONFIRMING…":roundLocked?"GLOBAL WAIT "+visibleRound+"s":!budgetSufficient?"LIMIT REACHED":"PLACE BID · "+money(nextPrice)+" →"}</button>
            :<div className="eaBidStandby">{status==="live"?"Observer mode · you can follow bids in real time":(lobby?.count??0)<3?"Waiting for all three bidders…":"Press READY above for the next round"}</div>}
          {status==="live"&&<div className="eaBidRhythm"><span>SERVER-ENFORCED GLOBAL COOLDOWN</span><b>{visibleRound}s</b><div><i style={{width:(100-Math.min(5,visibleRound)*20)+"%"}}/></div></div>}
          <div className="eaPanelFoot"><span>✓ Server-confirmed offers</span><span>✓ Fake money only</span></div>
        </div>
      </section>
      <section className="eaHistoryPanel">
        <div className="eaHistoryHead"><div><span className="eaEyebrow">ACTIVITY</span><h2>Bid history</h2></div><span>{latest.length} accepted {latest.length===1?"bid":"bids"}</span></div>
        {latest.length?<>
          <div className="eaHistoryRows">{latest.slice(0,historyExpanded?latest.length:3).map(e=>
            <div key={e.sequence}><span className="eaHistoryRank">#{e.sequence}</span><strong>{labelRole(e.role)}</strong><small>{new Date(e.at).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small><b>{money(Number(e.amount))}</b></div>)}</div>
          {latest.length>3&&<button className="eaHistoryToggle" type="button" onClick={()=>setHistoryExpanded(v=>!v)}>{historyExpanded?"Show fewer ↑":"View all "+latest.length+" bids ↓"}</button>}
        </>:<p className="eaEmptyHistory">Accepted bids will appear here as soon as the auction begins.</p>}
      </section>
      {bidFlash&&<div className="eaBidToast" role="status" aria-live="polite" key={bidFlash.sequence}><span>✓ BID ACCEPTED · #{bidFlash.sequence}</span><strong>{money(bidFlash.amount)}</strong><small>{labelRole(bidFlash.role)} is leading</small></div>}
      {status==="live"&&bidder&&<div className="eaBidDock">
        <div><span>NEXT BID · {minutes}:{seconds} LEFT</span><strong>{money(nextPrice)}</strong></div>
        <button type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"…":roundLocked?"WAIT "+visibleRound+"s":!budgetSufficient?"LIMIT":"BID "+money(nextPrice)+" →"}</button>
      </div>}
      </>}
      {celebratingId===auction?.id&&auction?.winnerRole&&<div className="eaCelebration" aria-hidden="true" key={celebratingId}>
        <div className="eaCelebrationCard"><span>🏆</span><small>ENCHEV AUCTIONS · DEMO</small><strong>{labelRole(auction.winnerRole)} WINS!</strong><b>{money(auction.currentAmount)}</b></div>
        {Array.from({length:38},(_,i)=><i key={i} style={{"--ea-x":((i*47)%100)+"%","--ea-delay":((i*17)%17)*.07+"s","--ea-drift":((i%2?1:-1)*(13+i%8*8))+"px","--ea-turn":((i%2?1:-1)*540)+"deg"} as CSSProperties}/>)}
      </div>}
      {!connected&&<div className="eaRoomAlert" role="status">Disconnected. Bidding is paused until the server reconnects.</div>}
    </div>}
    <footer className="eaRoomFooter">ENCHEV AUCTIONS · PRIVATE DEMONSTRATION · NO REAL TRANSACTIONS</footer>
  </main>;
}
