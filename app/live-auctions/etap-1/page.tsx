"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Etap1DemoVehicle from "./Etap1DemoVehicle";
import "./etap1.css";

type Role = "admin"|"mitko"|"borko"|"enchev";
type Bid = {sequence:number;role:string;amount:number;at:string};
type Auction = {
  id:string;title:string;currency:"EUR";openingAmount:number;currentAmount:number;
  increment:number;sequence:number;leadingRole:string|null;winnerRole:string|null;
  startedAt:string;endsAt:string;closedAt:string|null;
};
type Snapshot = {status:"idle"|"live"|"closed";demo:true;serverNow:string;auction:Auction|null;bids:Bid[]};
type Lobby = {count:number;readyCount:number;minPlayers:number;participants:{role:string;ready:boolean}[]};
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
  const [increment,setIncrement]=useState(100);
  const [duration,setDuration]=useState(120);
  const [mediaView,setMediaView]=useState("FRONT");
  const [detailTab,setDetailTab]=useState("History");
  const [voiceLang,setVoiceLang]=useState("en-IE");
  const [voiceOn,setVoiceOn]=useState(false);
  const [bidFlash,setBidFlash]=useState<{sequence:number;amount:number;role:string}|null>(null);
  const [celebratingId,setCelebratingId]=useState<string|null>(null);
  const [roundLockKey,setRoundLockKey]=useState<string|null>(null);
  const [moreOpen,setMoreOpen]=useState(false);
  const [historyExpanded,setHistoryExpanded]=useState(false);
  const voiceRef=useRef(false);
  const voiceLangRef=useRef("en-IE");
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
      body:JSON.stringify(data),
    });
    const result=await response.json() as StateReply&{ok?:boolean};
    if(!response.ok)throw new Error(result.error??"Request rejected");
    if(result.state)applySnapshot(result.state);
    if(result.lobby)setLobby(result.lobby);
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
    try{await post("logout",{});setRole(null);setSnapshot(null);setLobby(null);setBidFlash(null);setCelebratingId(null);setRoundLockKey(null);lastRef.current=null;}
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
  const setReady=async(next:boolean)=>{
    if(busy||!connected||snapshot?.status==="live")return;
    setBusy(true);setError("");
    try{await post("ready",{ready:next});}
    catch(e){setError(e instanceof Error?e.message:"Cannot change READY status");void poll();}
    finally{setBusy(false);}
  };
  const bid=async()=>{
    const activeAuction=snapshot?.auction;
    if(!activeAuction||snapshot?.status!=="live")return;
    const timeKey=Math.floor((Date.now()+offsetRef.current)/5000);
    const lockKey=activeAuction.id+":"+timeKey;
    if(busy||!connected||
      Date.parse(activeAuction.endsAt)<=Date.now()+offsetRef.current||roundLockKey===lockKey)return;
    setBusy(true);setError("");
    try{
      await post("bid",{nonce:crypto.randomUUID()});
      // This is a browser UI click guard, not a new server-side bidding rule.
      setRoundLockKey(lockKey);
    }
    catch(e){setError(e instanceof Error?e.message:"Bid rejected");void poll();}
    finally{setBusy(false);}
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
  const bidder=role==="mitko"||role==="borko";
  const participant=bidder||role==="enchev";
  const myReady=Boolean(lobby?.participants.some(p=>p.role===role&&p.ready));
  const latest=snapshot?.bids??[];
  const currentPrice=auction?.currentAmount??opening;
  const nextPrice=currentPrice+(auction?.increment??increment);
  const status=snapshot?.status??"idle";
  const timeUntil=Math.max(0,Math.ceil(remainingMs/1000));
  const serverSeconds=localNow+offsetRef.current;
  const clockTotalMs=auction?Math.max(10000,Date.parse(auction.endsAt)-Date.parse(auction.startedAt)):10000;
  const clockProgress=status==="live"?Math.min(100,Math.max(0,remainingMs/clockTotalMs*100)):status==="closed"?100:100;
  const clockStyle={"--ev9-progress":clockProgress+"%"} as CSSProperties;
  const currentRoundKey=(auction?.id??"none")+":"+Math.floor(serverSeconds/5000);
  const roundLocked=roundLockKey===currentRoundKey;
  const canBid=status==="live"&&bidder&&connected&&!busy&&timeUntil>0&&!roundLocked;
  const preparingRound=status==="idle"||status==="closed";
  const phaseStep=status==="live"?2:1;
  const views=["FRONT","REAR","INTERIOR","DETAIL","SIDE"];
  const visibleRound=5-Math.floor(serverSeconds/1000)%5;
  const tabs=["Details","Photos","History","Documents","Transport","Condition"];

  return <main id="main-content" className={"eaEtap1 eaRoom"+(status==="live"&&bidder?" eaHasBidDock":"")}>
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
      <span>{role?<><i className="eaLiveDot"/> {labelRole(role)} <b>{bidder?"· BIDDER":role==="enchev"?"· OBSERVER":"· OPERATOR"}</b></>:"WELCOME TO THE LIVE ROOM"}</span>
      <span>DEMO ONLY <span className="eaStatusSep">·</span> NO REAL PAYMENTS</span>
    </div>
    {!available&&<div className="eaRoomAlert" role="alert">This private pilot is not active. Bidding is disabled.</div>}
    {error&&<div className="eaRoomAlert" role="alert">{error}<button type="button" onClick={()=>setError("")}>×</button></div>}
    {!role?<section className="eaLoginCard">
      <div className="eaLoginWelcome"><span className="eaEyebrow">ENCHEV · INVITATION ACCESS</span>
        <h1>Enter the live room.</h1>
        <p>Two bidders. One shared auction. Real-time server confirmation. Demonstration euros only.</p>
        <div className="eaLoginDecor"><span>01 · JOIN</span><span>02 · READY</span><span>03 · BID</span><span>04 · WIN</span></div>
      </div>
      <form onSubmit={logIn}>
        <label>Your role<select value={loginRole} onChange={e=>setLoginRole(e.target.value as Role)}>
          <option value="mitko">Mitko — bidder</option>
          <option value="borko">Borko — bidder</option>
          <option value="enchev">Enchev · observer</option>
          <option value="admin">Admin — operator</option>
        </select></label>
        <label>Invitation code<input value={code} type="password" autoComplete="off" minLength={loginRole==="admin"?16:4} maxLength={256} required placeholder="Your private code" onChange={e=>setCode(e.target.value)}/></label>
        <button className="eaActionPrimary" type="submit" disabled={!available||busy}>{busy?"CONNECTING…":"ENTER AUCTION ROOM →"}</button>
        <small>Access is limited to invited demo participants.</small>
      </form>
    </section>:<div className="eaRoomContent">
      {preparingRound&&<section className="eaReadyCard" aria-label="Participant readiness">
        <div className="eaReadyText">
          <span className="eaEyebrow"><span className="eaLiveDot"/> NEXT ROUND</span>
          <h2>{(lobby?.count??0)<2?"Waiting for players":myReady?"You're ready.":"Ready to start?"}</h2>
          <div className="eaReadyPeople">{(lobby?.participants??[]).map(person=>
            <span className={person.ready?"is-ready":""} key={person.role}>{person.ready?"●":"○"} {labelRole(person.role)}</span>)}
          </div>
          <p>{(lobby?.count??0)<2?"Invite one more player to begin.":(lobby?.readyCount??0)===(lobby?.count??0)?"The auction is starting…":"Everyone online must press READY."}</p>
        </div>
        <div className="eaReadyControl">
          <span>{lobby?.readyCount??0}/{lobby?.count??0} READY</span>
          {participant?<button type="button" onClick={()=>void setReady(!myReady)} disabled={!connected||busy} className={myReady?"is-ready":""}>{busy?"UPDATING…":myReady?"✓ READY":"I'M READY →"}</button>:<small>Admin does not count.</small>}
        </div>
      </section>}
      {role==="admin"&&preparingRound&&<details className="eaAdminSettings">
        <summary>Operator tools · optional manual start</summary>
        <form onSubmit={start}>
          <label>Vehicle<input value={lotTitle} minLength={4} maxLength={120} required onChange={e=>setLotTitle(e.target.value)}/></label>
          <label>Opening €<input type="number" min={100} max={10000000} value={opening} required onChange={e=>setOpening(Number(e.target.value))}/></label>
          <label>Step €<input type="number" min={10} max={100000} value={increment} required onChange={e=>setIncrement(Number(e.target.value))}/></label>
          <label>Duration seconds<input type="number" min={30} max={600} value={duration} required onChange={e=>setDuration(Number(e.target.value))}/></label>
          <button type="submit" disabled={!connected||busy}>START DEMO</button>
        </form>
      </details>}
      {status==="closed"&&auction&&<details className="eaPreviousRound">
        <summary><span>🏆</span><strong>Previous winner: {auction.winnerRole?labelRole(auction.winnerRole):"No bids"}</strong><b>{money(auction.currentAmount)}</b><small>Details ▾</small></summary>
        <div>Lot {auction.id.slice(0,8).toUpperCase()} · {auction.sequence} accepted bids · server-confirmed demo result.
          {auction.winnerRole&&<button type="button" onClick={replayWinner}>✨ Replay winner moment</button>}
        </div>
      </details>}
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
          <div className="eaNextBid"><span>NEXT VALID BID</span><strong>{money(status==="live"?nextPrice:opening+increment)}</strong><small>+ {money(status==="live"?auction?.increment??increment:increment)} minimum step</small></div>
          {status==="live"&&bidder?
            <button className="eaActionPrimary eaPlaceBid" type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"CONFIRMING…":roundLocked?"WAIT "+visibleRound+"s":"PLACE BID · "+money(nextPrice)+" →"}</button>
            :<div className="eaBidStandby">{status==="live"?"Observer mode · you can follow bids in real time":(lobby?.count??0)<2?"Waiting for a second participant…":"Press READY above to start the next round"}</div>}
          {status==="live"&&<div className="eaBidRhythm"><span>5-SECOND BID RHYTHM</span><b>{visibleRound}s</b><div><i style={{width:(100-visibleRound*20)+"%"}}/></div></div>}
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
      {celebratingId===auction?.id&&auction?.winnerRole&&<div className="eaCelebration" aria-hidden="true" key={celebratingId}>
        <div className="eaCelebrationCard"><span>🏆</span><small>ENCHEV AUCTIONS · DEMO</small><strong>{labelRole(auction.winnerRole)} WINS!</strong><b>{money(auction.currentAmount)}</b></div>
        {Array.from({length:38},(_,i)=><i key={i} style={{"--ea-x":((i*47)%100)+"%","--ea-delay":((i*17)%17)*.07+"s","--ea-drift":((i%2?1:-1)*(13+i%8*8))+"px","--ea-turn":((i%2?1:-1)*540)+"deg"} as CSSProperties}/>)}
      </div>}
      {status==="live"&&bidder&&<div className="eaBidDock">
        <div><span>NEXT BID · {minutes}:{seconds} LEFT</span><strong>{money(nextPrice)}</strong></div>
        <button type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"…":roundLocked?"WAIT "+visibleRound+"s":"BID NOW →"}</button>
      </div>}
      {!connected&&<div className="eaRoomAlert" role="status">Disconnected. Bidding is paused until the server reconnects.</div>}
    </div>}
    <footer className="eaRoomFooter">ENCHEV AUCTIONS · PRIVATE DEMONSTRATION · NO REAL TRANSACTIONS</footer>
  </main>;
}
