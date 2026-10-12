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
  const phaseStep=status==="live"?2:status==="closed"?3:1;
  const views=["FRONT","REAR","INTERIOR","DETAIL","SIDE"];
  const visibleRound=5-Math.floor(serverSeconds/1000)%5;
  const tabs=["Details","Photos","History","Documents","Transport","Condition"];

  return <main id="main-content" className={"eaEtap1 ev9App "+(status==="live"&&bidder?"ev9HasDock":"")}>
    <div className="ev9ContextHeader">
      <div><strong>● ENCHEV LIVE AUCTION</strong><span>Copart-style bidding workspace · Design v9 · closed pilot</span></div>
      <div className="ev9HeaderRight">
        <strong className={connected?"ev9Online is-online":"ev9Online"}>● {connected?"SYNCED":"CONNECTING"}</strong>
        <span className="ev9TestFlag">FAKE MONEY · NO REAL SALES</span>
      </div>
    </div>
    <div className="ev9Utility">
      <span>EUROPE DEMO LANE A</span>
      <span>SERVER AUTHORITATIVE BIDDING</span>
      {role&&<div className="ev9UtilityButtons">
        <span>{labelRole(role)} · {connected?"ONLINE":"OFFLINE"}</span>
        <button type="button" onClick={()=>void enableSound()}>{soundOn?"🔊 SOUND ON":"🔇 ENABLE SOUND"}</button>
        <button type="button" onClick={()=>void poll()}>↻ Sync</button>
        <button type="button" onClick={()=>void logOut()}>Sign out</button>
      </div>}
    </div>
    {!available&&<section className="eaEtap1Alert" role="alert">The isolated ENCHEV demo database is not activated. Real bidding is unavailable.</section>}
    {error&&<div className="eaEtap1Alert" role="alert">{error}<button type="button" onClick={()=>setError("")}>Dismiss</button></div>}
    {!role?<section className="eaEtap1Auth ev9Auth">
      <div><span className="eaEtap1Kicker">PRIVATE ACCESS · ENCHEV ETAP 1</span>
        <h2>Join the auction workspace</h2>
        <p>Authenticated bidders see the same server-side price, time and history. Fake money only.</p>
      </div>
      <form onSubmit={logIn}><label>ROLE<select value={loginRole} onChange={event=>setLoginRole(event.target.value as Role)}>
        <option value="mitko">Mitko · bidder</option><option value="borko">Borko · bidder</option>
        <option value="enchev">Enchev · observer</option><option value="admin">Admin · operator</option>
      </select></label>
      <label>INVITATION CODE<input type="password" autoComplete="off"
        minLength={loginRole==="admin"?16:4} maxLength={256} value={code}
        onChange={event=>setCode(event.target.value)} required/></label>
      <button type="submit" disabled={busy||!available}>{busy?"Connecting…":"ENTER LIVE WORKSPACE →"}</button>
      </form>
    </section>:<>
      {status!=="live"&&<section className="eaEtap1Ready ev9Ready">
        <div><span className="eaEtap1Kicker">AUTOMATIC AUCTION START</span>
          <h2>READY lobby</h2>
          <p>At least two online participants; everyone present must press READY. If Enchev is already online, we wait for all three.</p>
          <strong>{lobby?.readyCount??0} / {lobby?.count??0} READY · Minimum 2 participants</strong>
          <div className="eaEtap1ReadyUsers">{(lobby?.participants??[]).map(p=>
            <span key={p.role}>{labelRole(p.role)} · {p.ready?"✅ READY":"⏳ WAITING"}</span>)}</div>
        </div>
        {participant?<button type="button" className="eaEtap1ReadyButton" onClick={()=>void setReady(!myReady)} disabled={!connected||busy}>
          {busy?"Updating…":myReady?"✓ READY · Cancel":"✓ I AM READY"}
        </button>:<div className="eaEtap1Observer">Admin excluded from READY count.</div>}
      </section>}
      {role==="admin"&&status!=="live"&&<details className="ev9Admin">
        <summary>Optional admin manual start (test fallback)</summary>
        <form onSubmit={start}>
          <label>VEHICLE<input value={lotTitle} onChange={e=>setLotTitle(e.target.value)} minLength={4} maxLength={120} required/></label>
          <label>OPENING €<input type="number" min="100" max="10000000" value={opening} onChange={e=>setOpening(Number(e.target.value))} required/></label>
          <label>INCREMENT €<input type="number" min="10" max="100000" value={increment} onChange={e=>setIncrement(Number(e.target.value))} required/></label>
          <label>DURATION SECONDS<input type="number" min="30" max="600" value={duration} onChange={e=>setDuration(Number(e.target.value))} required/></label>
          <button disabled={!connected||busy} type="submit">START TEST AUCTION</button>
        </form>
      </details>}
      <section className="ev9AuctionBar" aria-label="Auction phases">
        <div className="ev9AuctionTop"><b>● ENCHEV LIVE · LANE A</b><span>{auction?"LOT "+auction.id.slice(0,8).toUpperCase():"AWAITING READY"} · DEMO GOLF GTI</span></div>
        <div className="ev9PhaseRail">
          {["ACCESS","READY CHECK","LIVE AUCTION","WINNER"].map((ph,i)=>
            <div key={ph} className={"ev9Phase "+(phaseStep===i?"active step"+i:phaseStep>i?"done":"")}>
              <span className="ev9PhaseDot"/><div><b>{ph}</b><small>{i===0?"PRIVATE ENTRY":i===1?"WAITING FOR ALL":i===2?status==="live"?minutes+":"+seconds:"00:00":"FINAL RESULT"}</small></div>
            </div>)}
        </div>
      </section>
      <section className="ev9Workspace">
        <div className="ev9Column ev9MediaCol">
          <div className="ev9ColHead"><b>VEHICLE MEDIA</b><span>5 VIEWS · ILLUSTRATIVE</span></div>
          <div className="ev9Media">
            <div className="ev9CarBackdrop">
              <Etap1DemoVehicle view={mediaView}/>
            </div>
            <div className="ev9MediaBadges"><span>LOT · DEMO</span><span className="good">✓ TEST VEHICLE</span></div>
            <div className="ev9CarOverlay">
              <div className={"ev9ClockRing "+(status==="live"?(timeUntil<=10?"live is-urgent":"live"):status==="closed"?"closed":"idle")} style={clockStyle}>
                <span>{status==="live"?"SERVER TIME":status==="closed"?"COMPLETE":"WAITING"}</span>
                <strong>{status==="live"?minutes+":"+seconds:status==="closed"?"🏆":"READY"}</strong>
                <small>{status==="live"?"UNTIL CLOSE":status==="closed"?"WINNER":"TO START"}</small>
              </div>
            </div>
            <div className="ev9MediaFoot"><span>Concept visual · no real lot photos</span><button type="button" onClick={()=>setMediaView(views[(views.indexOf(mediaView)+1)%views.length])}>Next view →</button></div>
          </div>
          <div className="ev9Thumbs">{views.map((v,i)=><button type="button" key={v} onClick={()=>setMediaView(v)}
            className={mediaView===v?"active":""} aria-pressed={mediaView===v}><span>◩</span><small>{v}</small></button>)}</div>
          <div className="ev9Specs">
            <div><small>VEHICLE</small><b>Golf GTI · DEMO</b></div>
            <div><small>CONDITION</small><b>Illustrative</b></div>
            <div><small>LOCATION</small><b>Demo only</b></div>
            <div><small>CURRENCY</small><b>EUR (fake)</b></div>
          </div>
        </div>
        <div className="ev9Column ev9BidCol">
          <div className="ev9ColHead"><b>ON THE BLOCK</b><span>{status==="live"?"● LIVE":"○ STANDBY"}</span></div>
          <div className="ev9BlockBody">
            <div className="ev9BlockTitle">{auction?.title??lotTitle}</div>
            <div className="ev9BlockSub">Verified DEMO lot · shared server state · no actual sale</div>
            <div className="ev9Stats">
              <div><small>LOT STATUS</small><b>{status==="live"?"LIVE":status==="closed"?"ENDED":"WAITING"}</b></div>
              <div><small>TOP BIDDER</small><b>{labelRole(auction?.leadingRole??null)}</b></div>
              <div><small>BID COUNT</small><b>{auction?.sequence??0}</b></div>
              <div><small>SERVER CLOCK</small><b>{status==="live"?minutes+":"+seconds:"--:--"}</b></div>
            </div>
            <div className="ev9BidZone">
              <div className="ev9BidValues">
                <small>CURRENT HIGHEST BID</small>
                <strong>{money(currentPrice)}</strong>
                <span>Leader: <b>{labelRole(auction?.leadingRole??null)}</b></span>
                <div className="ev9NextBox"><small>NEXT VALID OFFER</small><b>{money(nextPrice)}</b></div>
                <div className="ev9Increment">SERVER BID STEP <b>+ {money(auction?.increment??increment)}</b></div>
              </div>
              <div className={"ev9BidCircle "+(status==="live"?(timeUntil<=10?"is-live is-urgent":"is-live"):status==="closed"?"is-closed":"is-pending")} style={clockStyle}>
                <div className="ev9CircleInner"><small>ENCHEV</small><b>{status==="live"?"BID":status==="closed"?"SOLD":"READY"}</b><span>{status==="live"?minutes+":"+seconds:status==="closed"?"🏆":"●"}</span></div>
              </div>
            </div>
            <div className="ev9Round">
              <div className="ev9RoundHead"><strong>5-SECOND BID RHYTHM</strong><small>{roundLocked?"Your next click unlocks after this round":"Local click guard · final authority on server"}</small></div>
              <div className="ev9RoundSteps">{[5,4,3,2,1].map(n=><span key={n} className={visibleRound===n?"active":""}>{n}</span>)}<b>BID</b></div>
            </div>
            <div className="ev9BidActions">
              <label>YOUR NEXT BID (€)<input type="text" readOnly value={nextPrice.toLocaleString("bg-BG",{maximumFractionDigits:2})} aria-label="Server-controlled next bid amount"/></label>
              <details className="ev9QuickDetails"><summary>Advanced bids · upcoming</summary><div className="ev9QuickButtons"><button type="button" disabled>+250</button><button type="button" disabled>+500</button><button type="button" disabled>+1000</button><span>Not enabled in this demo; the server accepts the displayed €100 step only.</span></div></details>
              {status==="live"&&bidder?<button className="ev9PrimaryBid" type="button" onClick={()=>void bid()} disabled={!canBid}>
                {busy?"PROCESSING…":roundLocked?"NEXT ROUND IN "+visibleRound+"s":"PLACE DEMO BID · "+money(nextPrice)}
              </button>:<div className="ev9BidDisabled">{status==="closed"?"AUCTION ENDED · BIDDING LOCKED":!bidder?"OBSERVE ONLY · NO BID PERMISSION":"WAITING FOR READY / AUCTION START"}</div>}
            </div>
            {status==="closed"&&<div className="ev9Winner"><span>🏆 SERVER-VERIFIED RESULT</span>
              <strong>{auction?.winnerRole?labelRole(auction.winnerRole)+" WINS":"NO BIDS · NO SALE"}</strong>
              <b>{money(currentPrice)}</b><small>Demo result only. No payment or vehicle transfer.</small>
              <div className="ev9WinVerification"><span>LOT {auction?.id.slice(0,8).toUpperCase()} · ACCEPTED BIDS {auction?.sequence??0}</span><b>SERVER CONFIRMED · DEMO ONLY</b></div>
            </div>}
            <div className="ev9VoicePanel">
              <div><b>🔊 AUCTIONEER VOICE</b><small>System speech synthesis · optional</small></div>
              <select aria-label="Auctioneer voice language" value={voiceLang} onChange={e=>{setVoiceLang(e.target.value);voiceLangRef.current=e.target.value;}}>
                <option value="en-IE">EN · English (Ireland)</option><option value="bg-BG">BG · Български</option>
              </select>
              <button type="button" aria-pressed={voiceOn} onClick={enableVoice}>{voiceOn?"VOICE ON":"VOICE OFF · PREVIEW"}</button>
            </div>
          </div>
        </div>
        <aside className="ev9Column ev9SideCol">
          <div className="ev9ColHead"><b>UPCOMING LOTS</b><span>DESIGN PREVIEW</span></div>
          <div className="ev9Upcoming">
            {["2026 Volkswagen Golf GTI","2024 BMW 330i","2023 Mercedes-Benz C-Class","2025 Audi A4"].map((title,i)=>
              <div className="ev9UpcomingLot" key={title}>
                <div className="ev9LotIcon">◩</div>
                <div><b>{title}</b><small>Illustrative demo listing · #{i+1}</small><strong>NOT AVAILABLE FOR SALE</strong></div>
              </div>)}
          </div>
          <div className="ev9Deposit">
            <div><small>DEPOSIT</small><strong>NOT CONNECTED</strong></div>
            <div><small>BUYING POWER</small><strong>DEMO ONLY</strong></div>
            <div className="ev9DepositTrack"><span/></div>
            <p>No real wallet, deposit or transaction processing is enabled.</p>
          </div>
          <div className="ev9BidGate"><b>BEFORE YOU BID</b>
            <p>✓ Invitation-only pilot<br/>✓ Fake euros, no payments<br/>✓ Shared bid history<br/>✓ Server-confirmed winner</p>
          </div>
        </aside>
      </section>
      <section className="ev9Bottom">
        <div className="ev9Tabs" role="tablist" aria-label="Lot workspace tabs">{tabs.map(t=>
          <button role="tab" aria-selected={detailTab===t} type="button" className={detailTab===t?"active":""} key={t} onClick={()=>setDetailTab(t)}>{t}</button>)}
        </div>
        <div className="ev9TabBody" role="tabpanel">
          {detailTab==="History"?<><div className="ev9TabIntro"><h3>LIVE BID HISTORY</h3><span>{latest.length} recent accepted offers · server ledger</span></div>
            <div className="ev9History">{latest.length?latest.map(e=><div key={e.sequence}><b>#{e.sequence} · {labelRole(e.role)}</b><span>{new Date(e.at).toLocaleTimeString("bg-BG")}</span><strong>{money(Number(e.amount))}</strong></div>):<p>Waiting for server-accepted bids…</p>}</div>
          </>:detailTab==="Photos"?<><h3>DEMO MEDIA</h3><p>Choose FRONT, REAR, INTERIOR, DETAIL or SIDE above. The vehicle graphic is illustrative, not real auction photography.</p></>:
          detailTab==="Details"?<><h3>DEMO LOT DETAILS</h3><p>{auction?.title??lotTitle} · currency EUR · opening {money(auction?.openingAmount??opening)} · increment {money(auction?.increment??increment)}. No vehicle title or inspection is verified.</p></>:
          <><h3>{detailTab.toUpperCase()} · PREVIEW</h3><p>This tab is a UI placeholder for the future ENCHEV marketplace. No {detailTab.toLowerCase()} services or documents are connected in this closed pilot.</p></>}
        </div>
      </section>
      {bidFlash&&<div className="ev9AcceptedToast" role="status" aria-live="polite" key={bidFlash.sequence}>
        <span>✓ SERVER ACCEPTED · BID #{bidFlash.sequence}</span><strong>{money(bidFlash.amount)}</strong><small>New leader · {labelRole(bidFlash.role)}</small>
      </div>}
      {celebratingId===auction?.id&&auction?.winnerRole&&
        <div className="ev9Celebration" aria-hidden="true" key={celebratingId}>
          {Array.from({length:34},(_,i)=><i key={i} style={{
            "--ev9-x":((i*37)%100)+"%",
            "--ev9-delay":((i*17)%15)*.08+"s",
            "--ev9-drift":((i%2?1:-1)*(18+i%7*7))+"px",
            "--ev9-turn":((i%2?1:-1)*540)+"deg",
          } as CSSProperties}/>)}
        </div>}
      {status==="live"&&bidder&&<div className="ev9MobileBidDock">
        <div><small>SERVER BID · {minutes}:{seconds} LEFT</small><strong>{money(nextPrice)}</strong></div>
        <button type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"…":roundLocked?"WAIT "+visibleRound+"s":"BID NOW ↗"}</button>
      </div>}
      {!connected&&<div className="eaEtap1Alert" role="alert">Disconnected — server bids disabled until connection returns.</div>}
    </>}
    <footer className="eaEtap1Footer">ENCHEV AUCTIONS · PR #375 CLOSED PILOT · FAKE MONEY · NOT A REAL OFFER OR PAYMENT SERVICE</footer>
  </main>;
}
