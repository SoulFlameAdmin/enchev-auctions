"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Etap1DemoVehicle from "./Etap1DemoVehicle";
import "./etap1.css";

type Role = "admin"|"mitko"|"borko"|"enchev";
type Bid = {sequence:number;role:string;amount:number;at:string};
type Auction = {
  id:string;title:string;currency:"EUR";openingAmount:number;currentAmount:number;
  increment:number;sequence:number;leadingRole:string|null;winnerRole:string|null;
  nextBidAllowedAt?:string|null;cooldownSeconds?:number;minimumStep?:number;maximumOffer?:number;extensionCount?:number;
  startedAt:string;endsAt:string;closedAt:string|null;
};
type Snapshot = {status:"idle"|"countdown"|"live"|"closed"|"canceled";demo:true;serverNow:string;auction:Auction|null;bids:Bid[]};
type Lobby = {count:number;readyCount:number;minPlayers:number;admitted?:boolean;sessionCurrent?:boolean;activeDevices?:number;wallet?:{buyingPower:number;lotBudget:number}|null;participants:{role:string;ready:boolean}[]};
type StateReply = {authenticated?:boolean;available?:boolean;role?:Role;state?:Snapshot;lobby?:Lobby;error?:string};

const labelRole=(role:string|null)=>role==="mitko"?"Mitko":role==="borko"?"Borko":role==="enchev"?"Enchev":role==="admin"?"Admin":"No bidder";
const money=(value:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(value);
const bidError=(code:string)=>({
  PRICE_CHANGED:"Another bid was accepted first. Price refreshed; review the new amount.",
  COOLDOWN_ACTIVE:"Global 5-second pause is active. Wait for the countdown on BID.",
  ALREADY_LEADING:"You already lead this round. Wait for another bidder.",
  INVALID_AMOUNT:"The confirmed amount is no longer valid. Review the refreshed price.",
  LIMIT_EXCEEDED:"Offer exceeds your DEMO wallet or selected car limit.",
  SESSION_EXPIRED:"This device's session expired. Sign in again.",
  SESSION_NOT_ADMITTED:"This role is not admitted to the current round.",
  AUCTION_CLOSED:"Round finished. Wait for the next READY.",
  NONCE_MISMATCH:"This request was already used for a different offer.",
} as Record<string,string>)[code]??"Bid not accepted. Refresh the price and try again.";

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
  const [lotTitle,setLotTitle]=useState("2026 Mercedes-AMG G 63 — DEMO");
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
  const [topupDraft,setTopupDraft]=useState("15000");
  const [bonusUntil,setBonusUntil]=useState(0);
  const [moreOpen,setMoreOpen]=useState(false);
  const [historyExpanded,setHistoryExpanded]=useState(false);
  const voiceRef=useRef(false);
  const voiceLangRef=useRef("en-IE");
  const audioRef=useRef<AudioContext|null>(null);
  const soundRef=useRef(false);
  const lastRef=useRef<{id:string;sequence:number;status:string;endsAt?:string}|null>(null);
  const lastServerNowRef=useRef(0);
  const pollingRef=useRef(false);
  // Synchronous guard shared by primary and mobile BID controls.
  const pendingBidRef=useRef(false);
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

  const applySnapshot=useCallback((next:Snapshot,requestStartedAt?:number)=>{
    // Never repaint a newer accepted bid with an older in-flight poll response.
    const receivedAt=Date.parse(next.serverNow);
    if(!Number.isFinite(receivedAt)||receivedAt<lastServerNowRef.current)return;
    lastServerNowRef.current=receivedAt;
    if(next.auction){
      const prior=lastRef.current;
      if(prior?.id===next.auction.id){
        if(next.status==="live"&&prior.endsAt&&Date.parse(next.auction.endsAt)>Date.parse(prior.endsAt))setBonusUntil(Date.now()+3300);
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
      lastRef.current={id:next.auction.id,sequence:next.auction.sequence,status:next.status,endsAt:next.auction.endsAt};
    }
    const arrival=Date.now();
    // Correct for network time with the request midpoint; the database deadline
    // remains authoritative, while the 0.1-second client clock is only display.
    offsetRef.current=receivedAt-(requestStartedAt?((requestStartedAt+arrival)/2):arrival);
    setSnapshot(next);setLocalNow(arrival);
  },[play]);

  const poll=useCallback(async()=>{
    if(pollingRef.current)return;
    pollingRef.current=true;
    const requestStartedAt=Date.now();
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
      applySnapshot(data.state,requestStartedAt);
    }catch{
      setConnected(false);
    }finally{pollingRef.current=false;}
  },[applySnapshot]);

  useEffect(()=>{
    void poll();
    const id=window.setInterval(()=>void poll(),500);
    const tick=window.setInterval(()=>setLocalNow(Date.now()),100);
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
    const requestStartedAt=Date.now();
    const response=await fetch("/api/etap1/"+action,{
      method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data),signal:AbortSignal.timeout(12000),
    });
    const result=await response.json() as StateReply&{ok?:boolean;code?:string};
    if(result.state)applySnapshot(result.state,requestStartedAt);
    if(result.lobby)setLobby(result.lobby);
    if(!response.ok)throw new Error(action==="bid"?bidError(result.code??result.error??""):result.error??"Request rejected");
    return result;
  };

  const logIn=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return;
    // A real user gesture is the only reliable moment to unlock mobile audio.
    // Prime tones + auctioneer voice BEFORE the network await so Chrome/Safari
    // and Android browsers keep the media permission for the live round.
    void forceAuctionAudio(loginRole);
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
    if(pendingBidRef.current||busy||!connected||!lobby?.admitted||!Number.isSafeInteger(amount)||
       amount>100000||amount>(Number(lobby.wallet?.lotBudget) || 0)||
       amount>(Number(lobby.wallet?.buyingPower) || 0)||
       activeAuction.leadingRole===role||
       (activeAuction.nextBidAllowedAt&&Date.parse(activeAuction.nextBidAllowedAt)>now)||
       Date.parse(activeAuction.startedAt)>now||
       Date.parse(activeAuction.endsAt)<=now)return;
    pendingBidRef.current=true; // Block a second click before React rerenders.
    setBusy(true);setError("");
    try{
      await post("bid",{nonce:crypto.randomUUID(),amount,expectedSequence:activeAuction.sequence});
    }
    catch(e){setError(e instanceof Error?e.message:"Bid rejected");void poll();}
    finally{pendingBidRef.current=false;setBusy(false);}
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
      "Lot: "+displayLotTitle,
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
  const speakWelcome=(targetRole:Role)=>{
    if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window))return false;
    voiceRef.current=true;setVoiceOn(true);
    const speech=new SpeechSynthesisUtterance(voiceLangRef.current.startsWith("bg")
      ?(targetRole==="enchev"?"Енчев е свързан. Гласът на търга е включен. Готови за наддаване.":"Гласът на търга е включен. Готови за наддаване.")
      :(targetRole==="enchev"?"Enchev connected. Auctioneer voice is on. Ready for bidding.":"Auctioneer ready. Welcome to ENCHEV."));
    speech.lang=voiceLangRef.current;speech.rate=1.03;
    const voices=window.speechSynthesis.getVoices();
    const preferred=voices.find(v=>v.lang===speech.lang&&v.name.includes("Emily"))||
      voices.find(v=>v.lang===speech.lang)||
      voices.find(v=>v.lang.split("-")[0]===speech.lang.split("-")[0]);
    if(preferred)speech.voice=preferred;
    window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);
    return true;
  };
  const enableVoice=()=>{
    // Enchev is the presentation seat: once supported, auctioneer voice stays ON.
    if(role==="enchev"&&voiceOn){
      setError("ENCHEV presentation voice stays ON during the live demo.");
      return;
    }
    if(voiceOn){
      voiceRef.current=false;setVoiceOn(false);
      if("speechSynthesis" in window)window.speechSynthesis.cancel();
      return;
    }
    if(!speakWelcome(role??loginRole)){
      setError("Auctioneer voice is blocked by this in-app browser. Open the same link in Chrome or Safari; bid tones still work here.");
    }
  };
  const enableSound=async()=>{
    try{
      const AudioCtor=window.AudioContext||
        (window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!AudioCtor){setError("Audio is not available in this browser. Open the auction in Chrome or Safari.");return false;}
      if(!audioRef.current)audioRef.current=new AudioCtor();
      await audioRef.current.resume();
      const active=audioRef.current.state==="running";
      soundRef.current=active;setSoundOn(active);
      if(!active)setError("Device blocked audio. Tap anywhere in the auction once, then continue.");
      return active;
    }catch{
      setError("Audio is blocked by this browser. Open the auction in Chrome or Safari.");
      return false;
    }
  };
  const forceAuctionAudio=(targetRole:Role)=>{
    // Speech is started synchronously inside the user gesture; tones are unlocked
    // in the same gesture. This avoids the common Android/Instagram autoplay trap.
    const voiceSupported=speakWelcome(targetRole);
    void enableSound();
    if(targetRole==="enchev"&&!voiceSupported){
      setError("ENCHEV needs auctioneer voice: open this page in Chrome or Safari. Instagram/Facebook in-app browsers can block system speech.");
    }
  };

  useEffect(()=>{
    if(!role||role==="admin")return;
    const supported="speechSynthesis" in window&&"SpeechSynthesisUtterance" in window;
    if(supported){
      // All bidders get voice by default; ENCHEV is mandatory presentation audio.
      voiceRef.current=true;setVoiceOn(true);
    }else if(role==="enchev"){
      setError("ENCHEV needs auctioneer voice: open this page in Chrome or Safari. Instagram/Facebook in-app browsers can block system speech.");
    }
    // Existing remembered sessions may skip the login button. Prime audio on the
    // very first tap anywhere so subsequent remote bids always have tones.
    const unlock=()=>{void enableSound();if(supported&&role==="enchev")speakWelcome(role);};
    window.addEventListener("pointerdown",unlock,{once:true,capture:true});
    window.addEventListener("touchstart",unlock,{once:true,capture:true});
    return()=>{
      window.removeEventListener("pointerdown",unlock,true);
      window.removeEventListener("touchstart",unlock,true);
    };
  },[role]);

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
  const cooldownMs=auction?.nextBidAllowedAt?Math.max(0,Date.parse(auction.nextBidAllowedAt)-localNow-offsetRef.current):0;
  const cooldownRemaining=Math.ceil(cooldownMs/1000);
  const visibleRound=(Math.ceil(cooldownMs/100)/10).toFixed(1);
  const roundLocked=cooldownMs>0;
  const budgetSufficient=budgetCap>=nextPrice;
  const status=snapshot?.status??"idle";
  const timeUntil=Math.max(0,Math.ceil(remainingMs/1000));
  const clockTotalMs=auction?Math.max(10000,Date.parse(auction.endsAt)-Date.parse(auction.startedAt)):10000;
  const clockProgress=status==="live"?Math.min(100,Math.max(0,remainingMs/clockTotalMs*100)):status==="closed"?100:100;
  const clockStyle={"--ev9-progress":clockProgress+"%"} as CSSProperties;
  // Server-owned cooldown; no per-browser tick-based bid permission.
  // One invited role may use multiple devices but counts as a single bidder.
  // Server verifies each signed cookie, registered session, wallet and role admission.
  const admitted=lobby?.admitted===true;
  const showAuction=status==="live"&&admitted;
  const canBid=status==="live"&&bidder&&admitted&&connected&&!busy&&timeUntil>0&&!roundLocked&&budgetSufficient&&stepIsValid&&auction?.leadingRole!==role;
  const preparingRound=status!=="live"||!showAuction;
  const phaseStep=status==="live"?2:1;
  const views=["FRONT","REAR","INTERIOR","DETAIL","SIDE"];
  const tabs=["Details","Photos","History","Documents","Transport","Condition"];
  const displayLotTitle="2026 Mercedes-AMG G 63 — DEMO";
  const gClassPhotos:Record<string,string>={
    FRONT:"https://images.pexels.com/photos/14445439/pexels-photo-14445439.jpeg?auto=compress&cs=tinysrgb&w=1800",
    REAR:"https://images.pexels.com/photos/17001168/pexels-photo-17001168.jpeg?auto=compress&cs=tinysrgb&w=1800",
    INTERIOR:"https://images.pexels.com/photos/14583867/pexels-photo-14583867.jpeg?auto=compress&cs=tinysrgb&w=1800",
    DETAIL:"https://images.pexels.com/photos/18045871/pexels-photo-18045871.jpeg?auto=compress&cs=tinysrgb&w=1800",
    SIDE:"https://images.pexels.com/photos/14445435/pexels-photo-14445435.jpeg?auto=compress&cs=tinysrgb&w=1800",
  };

  return <main id="main-content" className={"eaEtap1 eaRoom"+(showAuction&&bidder?" eaHasBidDock":"")}>
    <header className="eaRoomHeader">
      <a className="eaRoomLogo" href="/" aria-label="ENCHEV Home">
        <strong>ENCHEV</strong><span>AUCTIONS</span>
      </a>
      <div className="eaRoomTitle">
        <strong><span className="eaLiveDot"/> LIVE AUCTION</strong>
        <small>{role?"PRIVATE LIVE ROOM":"PRIVATE ACCESS"}</small>
      </div>
      <div className="eaHeaderActions">
        {role&&<span className={"eaConnection "+(connected?"is-online":"")} title={connected?"Live connection":"Waiting for connection"}>{connected?"● ONLINE":"○ OFFLINE"}</span>}
        {role&&<button className="eaSoundToggle" type="button" aria-label={soundOn?"Sound enabled":"ENABLE SOUND"} onClick={()=>void enableSound()}>{soundOn?"🔊":"🔇"}<span>{soundOn?"ON":"SOUND"}</span></button>}
        <div className="eaSettings">
          <button className={"eaSettingsToggle eaBurger"+(moreOpen?" is-open":"")} type="button" aria-label="Open ENCHEV menu" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}>
            <span/><span/><span/>
          </button>
          {moreOpen&&<div className="eaSettingsMenu">
            <div className="eaMenuHead"><span>ENCHEV</span><strong>{role?"LIVE ROOM":"AUCTION ACCESS"}</strong></div>
            <a className="eaMenuLink" href="/">⌂ <span>Home</span><b>↗</b></a>
            <a className="eaMenuLink" href="/live-auctions">◫ <span>Live auctions</span><b>→</b></a>
            {role&&<>
              <div className="eaMenuDivider"/>
              <label>Voice language<select value={voiceLang} onChange={e=>{setVoiceLang(e.target.value);voiceLangRef.current=e.target.value;}}>
                <option value="en-IE">English (Ireland)</option><option value="bg-BG">Български</option>
              </select></label>
              <button type="button" aria-pressed={voiceOn} onClick={enableVoice}>{role==="enchev"&&voiceOn?"🔊 ENCHEV VOICE · ALWAYS ON":voiceOn?"🔊 Voice ON":"🎙 Enable auctioneer voice"}</button>
              <button type="button" onClick={()=>{void poll();setMoreOpen(false);}}>↻ Refresh connection</button>
              <button className="eaMenuDanger" type="button" onClick={()=>{void logOut();setMoreOpen(false);}}>Sign out</button>
            </>}
            {!role&&<small className="eaMenuNote">Private invitation login is available below.</small>}
          </div>}
        </div>
      </div>
    </header>
    <div className="eaRoomStatus">
      <span>{role?<><i className="eaLiveDot"/> {labelRole(role)} <b>{bidder?"· BIDDER":"· OPERATOR"}</b></>:"WELCOME TO THE LIVE ROOM"}</span>
      <span>DEMO ONLY <span className="eaStatusSep">·</span> NO REAL PAYMENTS</span>
    </div>
    {!available&&<div className="eaRoomAlert" role="alert">This private pilot is not active. Bidding is disabled.</div>}
    {error&&<div className="eaRoomAlert" role="alert">{error}<button type="button" onClick={()=>setError("")}>×</button></div>}
    {!role?<section className="eaLoginCard">
      <div className="eaLoginWelcome">
        <img className="eaLoginHeroPhoto" src={gClassPhotos.SIDE} alt="Black Mercedes-Benz G-Class reference vehicle for the ENCHEV demo" loading="eager" decoding="async"/>
        <div className="eaLoginHeroShade"/>
        <div className="eaLoginHeroContent">
          <div className="eaLoginBrand"><span className="eaLiveDot"/><b>ENCHEV LIVE</b><small>PRIVATE DEMONSTRATION</small></div>
          <span className="eaEyebrow">INVITATION ACCESS</span>
          <h1>Enter the live auction.</h1>
          <p>Join the private ENCHEV demo room. Choose your bidder role, enter the invitation code and continue to budget, READY and synchronized live bidding.</p>
          <div className="eaLoginDecor"><span>01 · JOIN</span><span>02 · BUDGET</span><span>03 · READY</span><span>04 · BID</span><span>05 · RESULT</span></div>
        </div>
      </div>
      <form onSubmit={logIn}>
        <div className="eaLoginFormHead"><span>SECURE ACCESS</span><strong>Bidder sign in</strong><small>Demo only · no real payments</small></div>
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
      {preparingRound&&<section className={"eaReadyCard"+(status==="countdown"?" eaCountdownActive":"")} aria-label="Participant readiness">
        <img className="eaLobbyVehiclePhoto" src={gClassPhotos.FRONT} alt="Black Mercedes-Benz G-Class reference vehicle" loading="eager" decoding="async"/>
        <div className="eaLobbyVehicleShade"/>
        <div className="eaReadyText">
          <span className="eaEyebrow"><span className="eaLiveDot"/> {status==="countdown"?"ROOM LOCKED":"NEXT ROUND"}</span>
          <h2>{status==="countdown"?"AUCTION STARTS IN "+String(Math.floor(countdownRemaining/60)).padStart(2,"0")+":"+String(countdownRemaining%60).padStart(2,"0"):status==="live"?"Round in progress — wait for next READY":((lobby?.count??0)<minPlayers||!corePresent)?"Waiting for invited participants":myReady?"You're ready.":"Ready to start?"}</h2>
          <div className="eaReadyPeople">{(lobby?.participants??[]).map(person=>
            <span className={person.ready?"is-ready":""} key={person.role}>{person.ready?"●":"○"} {labelRole(person.role)} {person.ready&&"· READY"}</span>)}
          </div>
          <p>{status==="countdown"?"3/3 ready. The room is locked and bidding opens automatically when the synchronized timer reaches zero.":status==="live"
            ?"This round started without your current login. You cannot bid; when it ends, press I'M READY for the next one."
            :((lobby?.count??0)<minPlayers||!corePresent)?"Mitko, Borko and Enchev must join, set their DEMO budgets, then all press READY."
            :(lobby?.readyCount??0)===(lobby?.count??0)?"Countdown starting…":"All three must press READY to begin the countdown."}</p>
        </div>
        <div className="eaReadyControl">
          <span>{status==="countdown"?"3/3 READY · LOCKED":(lobby?.readyCount??0)+"/"+(lobby?.count??0)+" READY"}</span>
          {status==="countdown"&&<strong className="eaCountdownNumber">{String(Math.floor(countdownRemaining/60)).padStart(2,"0")}:{String(countdownRemaining%60).padStart(2,"0")}</strong>}
          {participant?(status==="live"||status==="countdown"
            ?<small>{status==="countdown"?"Bidding unlocks automatically.":"New login? Wait until the current auction closes."}</small>
            :<button type="button" onClick={()=>void setReady(!myReady)} disabled={!connected||busy||(Number(wallet?.lotBudget??0)<16300&&!myReady)} className={myReady?"is-ready":""}>{busy?"UPDATING…":myReady?"✓ READY":"I'M READY →"}</button>
          ):<small>Admin does not count.</small>}
        </div>
      </section>}
      {role==="admin"&&<div className="eaMonitorEntry"><a href="/live-auctions/etap-1/admin" aria-label="Open live admin dashboard">▣ OPEN ADMIN CONTROL ROOM →</a><small>Full-screen PC monitor · LIVE roster · READY · active bidders</small></div>}
      {role==="admin"&&preparingRound&&<p className="eaOperatorNote">🔒 The first round starts on three bidder logins; later rounds require three READY clicks. The operator never starts or blocks the auction.</p>}
      {participant&&status!=="live"&&status!=="countdown"&&<section className="eaDemoWallet" aria-label="DEMO buying power">
        <div className="eaDemoWalletHead"><div><span className="eaEyebrow">DEMO CREDIT · NO REAL DEPOSIT</span><h2>💰 BUYING POWER {money(Number(wallet?.buyingPower??10000))}</h2></div><span>LOT LIMIT: {money(Number(wallet?.lotBudget??10000))}</span></div>
        <p>Every role starts with €10,000 DEMO credit. Added TEST funds: {money(Math.max(0,Number(wallet?.buyingPower??10000)-10000))}. Maximum for this car: {money(Number(wallet?.lotBudget??10000))}. No real payment.</p>
        <div className="eaWalletActions">
          {[5000,10000,20000].map(v=><button type="button" key={v} disabled={busy||myReady||Number(wallet?.buyingPower??0)+v>100000} onClick={()=>void updateWallet(v)}>+ {money(v)} DEMO</button>)}
        </div>
        <form onSubmit={e=>{e.preventDefault();void updateWallet(Number(topupDraft));}}>
          <label>ADD CUSTOM DEMO CREDIT (€)<input type="number" inputMode="numeric" min="1" max={100000-Number(wallet?.buyingPower??10000)} step="1" value={topupDraft} onChange={e=>setTopupDraft(e.target.value)} disabled={busy||myReady}/></label>
          <button type="submit" disabled={busy||myReady||!topupDraft||!Number.isSafeInteger(Number(topupDraft))||Number(topupDraft)<=0||Number(wallet?.buyingPower??0)+Number(topupDraft)>100000}>ADD CREDIT</button>
        </form>
        <form onSubmit={e=>{e.preventDefault();void updateWallet(0,Number(budgetDraft));}}>
          <label>MAXIMUM FOR THIS CAR (€)<input type="number" inputMode="numeric" min="0" max={Number(wallet?.buyingPower??10000)} step="1" value={budgetDraft} onChange={e=>setBudgetDraft(e.target.value)} disabled={busy||myReady}/></label>
          <button type="submit" disabled={busy||myReady||!budgetDraft||!Number.isSafeInteger(Number(budgetDraft))||Number(budgetDraft)<0||Number(budgetDraft)>Number(wallet?.buyingPower??0)}>SAVE LOT BUDGET</button>
        </form>
        <p className="eaBudgetAdvice">🤖 DEMO BUDGET ASSISTANT · RULE-BASED: {Number(wallet?.lotBudget??0)<16300?"Your configured budget is below the minimum €16,300 first offer. Add DEMO credit and raise the lot budget.":"Respect your chosen limit. Taxes, transport and repair costs are not verified or included."}</p>
      </section>}
      {participant&&status!=="live"&&<section className="eaVehicleFacts" aria-label="Auction vehicle information">
        <div className="eaVehicleFactsHead"><span>LOT · DEMO-001</span><h2>2026 Mercedes-AMG G 63 · REFERENCE LOT</h2><small>Illustrative vehicle and photo; not a confirmed inspection, sale, document or VIN.</small></div>
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
        <h1>{displayLotTitle}</h1>
        <p>Private demo auction · Illustrative vehicle · EUR</p>
      </section>
      <section className="eaAuctionGrid" aria-label="Demo auction">
        <div className="eaMediaPanel">
          <div className="eaMediaStage">
            <Etap1DemoVehicle view={mediaView}/>
            <img className="eaFeaturedPhoto"
              src={gClassPhotos[mediaView]}
              alt={"Real Mercedes-Benz G-Class reference photo — "+mediaView.toLowerCase()+" view; not the actual demo lot"}
              loading="eager" decoding="async"
              onError={e=>{e.currentTarget.style.display="none";}}/>
            <span className="eaVehicleLabel">MERCEDES G-CLASS · REAL REFERENCE PHOTO</span>
            <a className="eaPhotoCredit" href="https://www.pexels.com/search/mercedes%20g-class/" target="_blank" rel="noopener noreferrer" aria-label="Mercedes G-Class reference photos on Pexels">Reference photos: Pexels</a>
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
          {bidder&&wallet&&<div className="eaWalletLive" aria-label="DEMO wallet live summary">
            <span>💰 DEMO WALLET <b>{money(Number(wallet.buyingPower))}</b></span>
            <span>ADDED <b>{money(Math.max(0,Number(wallet.buyingPower)-10000))}</b></span>
            <span>MAX BID <b>{money(budgetCap)}</b></span>
            <span>HEADROOM <b>{money(Math.max(0,budgetCap-currentPrice))}</b></span>
          </div>}
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
          {status==="live"&&Number(auction?.extensionCount??0)>0&&<div className="eaBonusTime" role="status">🟡 ANTI-SNIPE EXTENSIONS: {auction?.extensionCount} · Every valid late bid extends the server end time</div>}
          {status==="live"&&bonusUntil>localNow&&<div className="eaBonusTime" role="status">↗ SERVER EXTENSION CONFIRMED</div>}
          {status==="live"&&<div className="eaServerCooldown" role="status">{roundLocked?"⏳ GLOBAL SERVER COOLDOWN: "+cooldownRemaining+"s":auction?.leadingRole===role?"🟢 YOU ARE LEADING — WAIT FOR ANOTHER BID":"🟢 GLOBAL COOLDOWN CLEAR — BIDDING OPEN"}{!budgetSufficient&&" · BUDGET LIMIT REACHED"}</div>}
          {status==="live"&&bidder?
            <button className="eaActionPrimary eaPlaceBid" type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"CONFIRMING…":roundLocked?"⏳ BID AVAILABLE IN "+visibleRound+"s":auction?.leadingRole===role?"✓ YOU ARE LEADING":!budgetSufficient?"LIMIT REACHED":"PLACE BID · "+money(nextPrice)+" →"}</button>
            :<div className="eaBidStandby">{status==="live"?"Observer mode · you can follow bids in real time":(lobby?.count??0)<3?"Waiting for all three bidders…":"Press READY above for the next round"}</div>}
          {status==="live"&&<div className="eaBidRhythm"><span>SERVER-ENFORCED GLOBAL COOLDOWN</span><b>{visibleRound}s</b><div><i style={{width:(100-Math.min(5,cooldownMs/1000)*20)+"%"}}/></div></div>}
          <div className="eaPanelFoot"><span>✓ Server-confirmed offers</span><span>✓ Fake money only</span></div>
        </div>
      </section>
      <section className="eaVehicleFacts eaLiveVehicleFacts" aria-label="Vehicle specifications and known condition">
        <div className="eaVehicleFactsHead"><span>LOT · DEMO-001</span><h2>2026 Mercedes-AMG G 63 — DEMONSTRATION VEHICLE</h2><small>Illustrative photo. VIN, mileage, actual damage, registration and condition have NOT been verified.</small></div>
        <div className="eaLotTabs">{["Details","Condition","Documents","Transport","History"].map(t=><button type="button" key={t} aria-pressed={detailTab===t} className={detailTab===t?"is-active":""} onClick={()=>setDetailTab(t)}>{t}</button>)}</div>
        {detailTab==="Details"&&<div className="eaLotGrid">{[["LOT","DEMO-001"],["MILEAGE","NOT VERIFIED"],["VIN","NOT VERIFIED"],["ENGINE / FUEL","NOT VERIFIED"],["GEARBOX","NOT VERIFIED"],["LOCATION","NOT VERIFIED"],["PRICE","Live server value"],["BIDS",""+(auction?.sequence??0)],["STARTED",auction?new Date(auction.startedAt).toLocaleTimeString("bg-BG"):"—"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Condition"&&<p>Damage, starts, drives, keys, inspection and repairs: UNKNOWN / NOT VERIFIED. Do not rely on the illustration to assess a vehicle.</p>}
        {detailTab==="Documents"&&<p>Official vehicle documentation: NOT VERIFIED. Only a DEMO closing record can be downloaded once the round finishes.</p>}
        {detailTab==="Transport"&&<p>Shipping, VAT, pickup location and delivery fees: NOT VERIFIED. This auction uses no real money.</p>}
        {detailTab==="History"&&<p>{auction?.sequence??0} accepted bids. Scroll below for server-confirmed bid history; the counter is authoritative.</p>}
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
        <div><span>BID · {minutes}:{seconds} LEFT</span><strong>{money(nextPrice)}</strong></div>
        <button type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"…":roundLocked?"WAIT "+visibleRound+"s":auction?.leadingRole===role?"LEADING":!budgetSufficient?"LIMIT":"BID "+money(nextPrice)+" →"}</button>
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
