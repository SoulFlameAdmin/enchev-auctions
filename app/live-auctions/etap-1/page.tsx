"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Etap1DemoVehicle from "./Etap1DemoVehicle";
import "./etap1.css";

type Role = "admin"|"mitko"|"borko"|"enchev"|"guest1"|"guest2"|"guest3"|"guest4"|"guest5";
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

const labelRole=(role:string|null)=>role==="mitko"?"Митко":role==="borko"?"Борко":role==="enchev"?"Енчев":role==="admin"?"Админ":/^guest[1-5]$/.test(role??"")?"Гост "+role?.slice(-1):"Няма водач";
const money=(value:number)=>new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(value);
const bidError=(code:string)=>({
  PRICE_CHANGED:"Another bid was accepted first. Price refreshed; review the new amount.",
  COOLDOWN_ACTIVE:"Global 5-second pause is active. Wait for the countdown on BID.",
  ALГОТОВ_LEADING:"You already lead this round. Wait for another bidder.",
  INVALID_AMOUNT:"The confirmed amount is no longer valid. Review the refreshed price.",
  LIMIT_EXCEEDED:"Offer exceeds your DEMO wallet or selected car limit.",
  SESSION_EXPIRED:"This device's session expired. Sign in again.",
  SESSION_NOT_ADMITTED:"This role is not admitted to the current round.",
  AUCTION_CLOSED:"Round finished. Wait for the next ГОТОВ.",
  NONCE_MISMATCH:"This request was already used for a different offer.",
} as Record<string,string>)[code]??"Bid not accepted. Refresh the price and try again.";

export default function EnchevStageOnePage(){
  const [role,setRole]=useState<Role|null>(null);
  const [loginRole,setLoginRole]=useState<Role>("guest1");
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
  const [voiceLang,setVoiceLang]=useState("bg-BG");
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
  const [walletNotice,setWalletNotice]=useState("");
  const voiceRef=useRef(false);
  const voiceLangRef=useRef("bg-BG");
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

  const speakBg=(text:string)=>{
    if(typeof window==="undefined"||!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window))return;
    const speech=new SpeechSynthesisUtterance(text);
    speech.lang="bg-BG";
    speech.rate=1.02;
    const voices=window.speechSynthesis.getVoices();
    const preferred=voices.find(v=>v.lang==="bg-BG")||voices.find(v=>v.lang.startsWith("bg"));
    if(preferred)speech.voice=preferred;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
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
    catch{setError("Изход failed");}
    finally{setBusy(false);}
  };

  const updateWallet=async(topup:number,lotBudget:number|null=null)=>{
    if(busy||!connected||snapshot?.status==="countdown"||snapshot?.status==="live")return;
    setBusy(true);setError("");setWalletNotice("");
    try{
      const result=await post("wallet",{topup,lotBudget});
      const updatedWallet=result.lobby?.wallet;
      if(topup>0){
        const total=Number(updatedWallet?.buyingPower??(Number(wallet?.buyingPower??10000)+topup));
        const notice="Вие добавихте "+money(topup)+" във вашата ДЕМО сметка. Нова наличност: "+money(total)+".";
        setWalletNotice(notice);
        speakBg("Вие добавихте "+Math.round(topup)+" евро във вашата демо сметка. Новата ви наличност е "+Math.round(total)+" евро.");
      }else if(lotBudget!==null){
        const notice="Лимитът за този автомобил е зададен на "+money(lotBudget)+".";
        setWalletNotice(notice);
        speakBg("Вашият максимален лимит за този автомобил е "+Math.round(lotBudget)+" евро.");
      }
    }catch(e){setError(e instanceof Error?e.message:"Промяната на ДЕМО бюджета беше отказана.");}
    finally{setBusy(false);}
  };
  const setReady=async(next:boolean)=>{
    if(busy||!connected||snapshot?.status==="live"||snapshot?.status==="countdown")return;
    setBusy(true);setError("");
    try{await post("ready",{ready:next});}
    catch(e){setError(e instanceof Error?e.message:"Cannot change ГОТОВ status");void poll();}
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
      "САМО ДЕМО — NO REAL PURCHASE, PAYMENT OR VEHICLE TRANSFER",
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
    const unlock=()=>{void enableSound();if(supported)speakWelcome(role);};
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
  const bidder=Boolean(role&&role!=="admin");
  const participant=bidder;
  const myReady=Boolean(lobby?.participants.some(p=>p.role===role&&p.ready));
  const guestDemo=Boolean(lobby?.participants.some(p=>/^guest[1-5]$/.test(p.role)));
  const corePresent=guestDemo||["mitko","borko","enchev"].every(expected=>lobby?.participants.some(p=>p.role===expected));
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
        <small>{role?"ЧАСТНА LIVE ЗАЛА":"ЧАСТЕН ДОСТЪП"}</small>
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
            <a className="eaMenuLink" href="/live-auctions">◫ <span>Търгове на живо</span><b>→</b></a>
            {role&&<>
              <div className="eaMenuDivider"/>
              <label>Език на гласа<select value={voiceLang} onChange={e=>{setVoiceLang(e.target.value);voiceLangRef.current=e.target.value;}}>
                <option value="bg-BG">Български</option><option value="en-IE">Английски</option>
              </select></label>
              <button type="button" aria-pressed={voiceOn} onClick={enableVoice}>{role==="enchev"&&voiceOn?"🔊 ГЛАСЪТ НА ЕНЧЕВ · ВИНАГИ ВКЛЮЧЕН":voiceOn?"🔊 Гласът е включен":"🎙 Включи гласа на търга"}</button>
              <button type="button" onClick={()=>{void poll();setMoreOpen(false);}}>↻ Обнови връзката</button>
              <button className="eaMenuDanger" type="button" onClick={()=>{void logOut();setMoreOpen(false);}}>Изход</button>
            </>}
            {!role&&<small className="eaMenuNote">Влезте като гост с код 0000. Всичко е само ДЕМО.</small>}
          </div>}
        </div>
      </div>
    </header>
    <div className="eaRoomStatus">
      <span>{role?<><i className="eaLiveDot"/> {labelRole(role)} <b>{bidder?"· УЧАСТНИК":"· ОПЕРАТОР"}</b></>:"ДОБРЕ ДОШЛИ В LIVE ЗАЛАТА"}</span>
      <span>САМО ДЕМО <span className="eaStatusSep">·</span> БЕЗ РЕАЛНИ ПЛАЩАНИЯ</span>
    </div>
    {!available&&<div className="eaRoomAlert" role="alert">Това частно демо не е активно. Наддаването е изключено.</div>}
    {error&&<div className="eaRoomAlert" role="alert">{error}<button type="button" onClick={()=>setError("")}>×</button></div>}
    {!role?<section className="eaLoginCard">
      <div className="eaLoginWelcome">
        <img className="eaLoginHeroPhoto" src={gClassPhotos.SIDE} alt="Black Mercedes-Benz G-Class reference vehicle for the ENCHEV demo" loading="eager" decoding="async"/>
        <div className="eaLoginHeroShade"/>
        <div className="eaLoginHeroContent">
          <div className="eaLoginBrand"><span className="eaLiveDot"/><b>ENCHEV LIVE</b><small>PRIVATE DEMONSTRATION</small></div>
          <span className="eaEyebrow">ДОСТЪП ЗА ДЕМО ГОСТИ</span>
          <h1>Влезте в търга на живо.</h1>
          <p>Влезте свободно в инвеститорското ДЕМО. Изберете Гост 1–5, въведете 0000 и участвайте в наддаването на живо. Звуковите ефекти и гласът се активират при натискане на „ВЛЕЗ“.</p>
          <div className="eaLoginDecor"><span>01 · ВХОД</span><span>02 · БЮДЖЕТ</span><span>03 · ГОТОВ</span><span>04 · НАДДАВАНЕ</span><span>05 · РЕЗУЛТАТ</span></div>
        </div>
      </div>
      <form onSubmit={logIn}>
        <div className="eaLoginFormHead"><span>СИГУРЕН ДОСТЪП</span><strong>Вход за участник</strong><small>Само демо · без реални плащания</small></div>
        <label>Вашият профил<select value={loginRole} onChange={e=>setLoginRole(e.target.value as Role)}>
          {[1,2,3,4,5].map(n=><option key={n} value={"guest"+n}>Гост {n} — участник</option>)}
        </select></label>
        <label>Код за покана<input value={code} type="password" autoComplete="off" minLength={loginRole==="admin"?16:4} maxLength={256} required placeholder="Вашият личен код" onChange={e=>setCode(e.target.value)}/></label>
        <button className="eaActionPrimary" type="submit" disabled={!available||busy}>{busy?"СВЪРЗВАНЕ…":"ВЛЕЗ В ЗАЛАТА →"}</button>
        <small>{loginRole.startsWith("guest")?"Гостите 1–5 влизат с ДЕМО код 0000. Без реални пари.":"Достъпът е само за поканени участници в демото."}</small>
      </form>
    </section>:<div className="eaRoomContent">
      {preparingRound&&<section className={"eaReadyCard"+(status==="countdown"?" eaCountdownActive":"")} aria-label="Participant readiness">
        <img className="eaLobbyVehiclePhoto" src={gClassPhotos.FRONT} alt="Black Mercedes-Benz G-Class reference vehicle" loading="eager" decoding="async"/>
        <div className="eaLobbyVehicleShade"/>
        <div className="eaReadyText">
          <span className="eaEyebrow"><span className="eaLiveDot"/> {status==="countdown"?"ЗАЛАТА Е ЗАКЛЮЧЕНА":"СЛЕДВАЩ ТЪРГ"}</span>
          <h2>{status==="countdown"?"ТЪРГЪТ ЗАПОЧВА СЛЕД "+String(Math.floor(countdownRemaining/60)).padStart(2,"0")+":"+String(countdownRemaining%60).padStart(2,"0"):status==="live"?"Търгът е в ход — изчакайте следващия етап":((lobby?.count??0)<minPlayers||!corePresent)?"Изчакваме поканените участници":myReady?"Вие сте готови.":"Готови ли сте за старт?"}</h2>
          <div className="eaReadyPeople">{(lobby?.participants??[]).map(person=>
            <span className={person.ready?"is-ready":""} key={person.role}>{person.ready?"●":"○"} {labelRole(person.role)} {person.ready&&"· ГОТОВ"}</span>)}
          </div>
          <p>{status==="countdown"?"Участниците са допуснати. Залата е заключена и наддаването ще се отвори автоматично, когато таймерът стигне нула.":status==="live"
            ?"Този търг е започнал без текущия ви вход. След края натиснете „ГОТОВ СЪМ“ за следващия."
            :((lobby?.count??0)<minPlayers||!corePresent)?(guestDemo?"Необходими са поне двама: гости 1–5 или Енчев с гост. Всеки влиза, задава бюджет и натиска „ГОТОВ СЪМ“.":"Митко, Борко и Енчев трябва да влязат, да зададат ДЕМО бюджетите си и всички да натиснат „ГОТОВ СЪМ“.")
            :(lobby?.readyCount??0)===(lobby?.count??0)?"Стартира отброяването…":(guestDemo?"Всички присъстващи гости и Енчев трябва да натиснат „ГОТОВ СЪМ“.":"И тримата трябва да натиснат „ГОТОВ СЪМ“, за да започне отброяването.")}</p>
        </div>
        <div className="eaReadyControl">
          <span>{status==="countdown"?"ДОПУСНАТИ · ЗАКЛЮЧЕНО":(lobby?.readyCount??0)+"/"+(lobby?.count??0)+" ГОТОВИ"}</span>
          {status==="countdown"&&<strong className="eaCountdownNumber">{String(Math.floor(countdownRemaining/60)).padStart(2,"0")}:{String(countdownRemaining%60).padStart(2,"0")}</strong>}
          {participant?(status==="live"||status==="countdown"
            ?<small>{status==="countdown"?"Наддаването ще се отключи автоматично.":"Нов вход? Изчакайте текущият търг да приключи."}</small>
            :<button type="button" onClick={()=>void setReady(!myReady)} disabled={!connected||busy||(Number(wallet?.lotBudget??0)<16300&&!myReady)} className={myReady?"is-ready":""}>{busy?"ОБНОВЯВАНЕ…":myReady?"✓ ГОТОВ":"ГОТОВ СЪМ →"}</button>
          ):<small>Админът не се брои като участник.</small>}
        </div>
      </section>}
      {role==="admin"&&<div className="eaMonitorEntry"><a href="/live-auctions/etap-1/admin" aria-label="Open live admin dashboard">▣ OPEN ADMIN CONTROL ROOM →</a><small>Full-screen PC monitor · LIVE roster · ГОТОВ · active bidders</small></div>}
      {role==="admin"&&preparingRound&&<p className="eaOperatorNote">🔒 In investor mode at least two invited guests / Enchev and a guest can start after all connected participants press ГОТОВ. The operator never starts or blocks the auction.</p>}
      {participant&&status!=="live"&&status!=="countdown"&&<section className="eaDemoWallet" aria-label="ДЕМО сметка и лимит">
        <div className="eaDemoWalletHead">
          <div>
            <span className="eaEyebrow">ДЕМО СМЕТКА · БЕЗ РЕАЛЕН ДЕПОЗИТ</span>
            <h2>👛 ВАШАТА ДЕМО СМЕТКА {money(Number(wallet?.buyingPower??10000))}</h2>
          </div>
          <span>🚘 ЛИМИТ ЗА АВТОМОБИЛА: {money(Number(wallet?.lotBudget??10000))}</span>
        </div>
        <p className="eaWalletExplanation">Всеки участник започва с 10 000 € ДЕМО кредит. Вие сте добавили още <b>{money(Math.max(0,Number(wallet?.buyingPower??10000)-10000))}</b>. Максимумът, който сте избрали за този автомобил, е <b>{money(Number(wallet?.lotBudget??10000))}</b>.</p>
        {walletNotice&&<div className="eaWalletNotice" role="status" aria-live="polite"><span>✓</span><strong>{walletNotice}</strong></div>}
        <div className="eaWalletActions">
          {[5000,10000,20000].map(v=><button type="button" key={v} disabled={busy||myReady||Number(wallet?.buyingPower??0)+v>100000} onClick={()=>void updateWallet(v)}>👛 + {money(v)}</button>)}
        </div>
        <form className="eaWalletForm" onSubmit={e=>{e.preventDefault();void updateWallet(Number(topupDraft));}}>
          <label>ДОБАВЕТЕ СУМА В ДЕМО СМЕТКАТА (€)<input type="number" inputMode="numeric" min="1" max={100000-Number(wallet?.buyingPower??10000)} step="1" value={topupDraft} onChange={e=>setTopupDraft(e.target.value)} disabled={busy||myReady}/></label>
          <button type="submit" disabled={busy||myReady||!topupDraft||!Number.isSafeInteger(Number(topupDraft))||Number(topupDraft)<=0||Number(wallet?.buyingPower??0)+Number(topupDraft)>100000}>👛 ДОБАВИ В СМЕТКАТА</button>
        </form>
        <form className="eaWalletForm" onSubmit={e=>{e.preventDefault();void updateWallet(0,Number(budgetDraft));}}>
          <label>МАКСИМАЛНА СУМА ЗА ТОЗИ АВТОМОБИЛ (€)<input type="number" inputMode="numeric" min="0" max={Number(wallet?.buyingPower??10000)} step="1" value={budgetDraft} onChange={e=>setBudgetDraft(e.target.value)} disabled={busy||myReady}/></label>
          <button type="submit" disabled={busy||myReady||!budgetDraft||!Number.isSafeInteger(Number(budgetDraft))||Number(budgetDraft)<0||Number(budgetDraft)>Number(wallet?.buyingPower??0)}>🚘 ЗАПАЗИ ЛИМИТА</button>
        </form>
        <p className="eaBudgetAdvice">💡 {Number(wallet?.lotBudget??0)<16300?"Зададеният лимит е под минималната първа оферта от 16 300 €. Добавете ДЕМО средства и увеличете лимита за автомобила.":"Вашият лимит е зададен. Данъци, транспорт и ремонт не са потвърдени и не са включени в ДЕМО сумите."}</p>
      </section>}
      {participant&&status!=="live"&&<section className="eaVehicleFacts" aria-label="Auction vehicle information">
        <div className="eaVehicleFactsHead"><span>ЛОТ · DEMO-001</span><h2>2026 Mercedes-AMG G 63 · РЕФЕРЕНТЕН ЛОТ</h2><small>Референтен автомобил и снимки. Няма потвърдени оглед, продажба, документи или VIN.</small></div>
        <div className="eaLotTabs">{["Details","Condition","Documents","Transport","History"].map(t=><button type="button" key={t} aria-pressed={detailTab===t} className={detailTab===t?"is-active":""} onClick={()=>setDetailTab(t)}>{{Details:"Детайли",Condition:"Състояние",Documents:"Документи",Transport:"Транспорт",History:"История"}[t]??t}</button>)}</div>
        {detailTab==="Details"&&<div className="eaLotGrid">{[["ЛОТ ID","DEMO-001"],["YEAR","2026 (illustrative)"],["VIN","NOT VERIFIED"],["MILEAGE","NOT VERIFIED"],["ENGINE","NOT VERIFIED"],["FUEL","NOT VERIFIED"],["TRANSMISSION","NOT VERIFIED"],["LOCATION","NOT VERIFIED"],["START TIME","Server-controlled"],["OPENING BID","€16,250"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Condition"&&<div className="eaLotGrid">{[["STARTS / RUNS","UNKNOWN"],["DRIVEABLE","UNKNOWN"],["PRIMARY DAMAGE","NOT VERIFIED"],["SECONDARY DAMAGE","NOT VERIFIED"],["KEYS","NOT VERIFIED"],["INSPECTION REPORT","NOT AVAILABLE"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Documents"&&<p>DEMO closing record becomes available when a round ends. Vehicle title, seller authorization and original papers: NOT VERIFIED.</p>}
        {detailTab==="Transport"&&<p>Pickup location, taxes, shipping costs and delivery terms: NOT VERIFIED. No real vehicle release.</p>}
        {detailTab==="History"&&<p>{auction?auction.sequence+" accepted server-verified offers in the current / last round.":"No round started."} During LIVE, bid history is shown below.</p>}
      </section>}
      {status==="closed"&&auction&&<section className="eaFinalResult" aria-labelledby="eaFinalTitle" aria-live="polite">
        <span className="eaFinalEyebrow">🏁 ТЪРГЪТ ПРИКЛЮЧИ · ПОТВЪРДЕНО ОТ СЪРВЪРА · САМО ДЕМО</span>
        <h2 id="eaFinalTitle">{!auction.winnerRole?"Няма оферти — няма победител":auction.winnerRole===role?"🏆 ВИЕ СТЕ ПОБЕДИТЕЛЯТ":"🏆 НАЙ-ВИСОКА ОФЕРТА: "+labelRole(auction.winnerRole)}</h2>
        <p>{auction.winnerRole===role?"Вашата оферта остана най-висока в този ДЕМО търг.":"Сървърът приключи демонстрационния търг."} Няма реална покупка, плащане или прехвърляне на собственост.</p>
        <strong className="eaFinalAmount">{money(auction.currentAmount)}</strong>
        <div className="eaFinalFacts">
          <span>ЛОТ <b>{auction.id.slice(0,8).toUpperCase()}</b></span>
          <span>ОФЕРТИ <b>{auction.sequence}</b></span>
          <span>ПОБЕДИТЕЛ <b>{labelRole(auction.winnerRole)}</b></span>
          <span>ПРИКЛЮЧИ <b>{new Date(auction.closedAt??auction.endsAt).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</b></span>
        </div>
        <p className="eaFinalNext">NEXT: Confirm the result in the admin panel → demonstrate seller approval → demo document pack → simulated payment → release only after checks. All invited participants press ГОТОВ for another round.</p>
        <div className="eaFinalActions">
          <button type="button" onClick={downloadDemoClosingRecord}>↓ Download DEMO result record</button>
          {auction.winnerRole&&<button type="button" onClick={replayWinner}>🏆 Replay winner announcement</button>}
        </div>
        <small>This downloaded record is not a fiscal invoice, sale contract, payment request, vehicle title or release authorization.</small>
      </section>}
      {showAuction&&<>
      <section className="eaAuctionIntro">
        <div><span className={"eaAuctionStatus "+(status==="live"?"is-live":"")}>{status==="live"?"● НА ЖИВО":"◉ ГОТОВИ ЗА СЛЕДВАЩ ТЪРГ"}</span><span className="eaAuctionLot">ЛОТ {status==="live"&&auction?auction.id.slice(0,8).toUpperCase():"DEMO–001"}</span></div>
        <h1>{displayLotTitle}</h1>
        <p>Частен демонстрационен търг · Референтен автомобил · EUR</p>
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
            <span className="eaVehicleLabel">MERCEDES G-CLASS · РЕАЛНА РЕФЕРЕНТНА СНИМКА</span>
            <a className="eaPhotoCredit" href="https://www.pexels.com/search/mercedes%20g-class/" target="_blank" rel="noopener noreferrer" aria-label="Mercedes G-Class reference photos on Pexels">Референтни снимки: Pexels</a>
            <div className={"eaClock "+(status==="live"?"is-live":"")+(status==="live"&&timeUntil<=10?" urgent":"")} style={clockStyle}>
              <div><span>{status==="live"?"ОСТАВАЩО ВРЕМЕ":"СЛЕДВАЩ ТЪРГ"}</span><strong>{status==="live"?minutes+":"+seconds:"ГОТОВ"}</strong></div>
            </div>
            <div className="eaMediaNav">
              <button type="button" aria-label="Previous vehicle view" onClick={()=>setMediaView(views[(views.indexOf(mediaView)+views.length-1)%views.length])}>‹</button>
              <span>{mediaView} · {views.indexOf(mediaView)+1}/5</span>
              <button type="button" aria-label="Next vehicle view" onClick={()=>setMediaView(views[(views.indexOf(mediaView)+1)%views.length])}>›</button>
            </div>
          </div>
          <div className="eaMediaViews" aria-label="Изгледи на автомобила">{views.map(v=><button type="button" key={v} className={mediaView===v?"is-selected":""} aria-pressed={mediaView===v} onClick={()=>setMediaView(v)}>{{FRONT:"ОТПРЕД",REAR:"ОТЗАД",INTERIOR:"ИНТЕРИОР",DETAIL:"ДЕТАЙЛ",SIDE:"ОТСТРАНИ"}[v]??v}</button>)}</div>
        </div>
        <div className="eaBiddingPanel">
          <div className="eaPriceTop"><span>{status==="live"?"ТЕКУЩА НАЙ-ВИСОКА ОФЕРТА":"СЛЕДВАЩ ТЪРГ · НАЧАЛНА ЦЕНА"}</span><span className={status==="live"?"eaBiddingLive":""}>{status==="live"?"● НА ЖИВО":status==="closed"?"● ПОСЛЕДНИЯТ ТЪРГ ПРИКЛЮЧИ":"● ИЗЧАКВАНЕ"}</span></div>
          <strong className="eaHeroAmount">{money(status==="live"?currentPrice:opening)}</strong>
          {bidder&&wallet&&<div className="eaWalletLive" aria-label="DEMO wallet live summary">
            <span>👛 ДЕМО СМЕТКА <b>{money(Number(wallet.buyingPower))}</b></span>
            <span>ДОБАВЕНИ <b>{money(Math.max(0,Number(wallet.buyingPower)-10000))}</b></span>
            <span>МАКС. ОФЕРТА <b>{money(budgetCap)}</b></span>
            <span>ОСТАВАЩ ЛИМИТ <b>{money(Math.max(0,budgetCap-currentPrice))}</b></span>
          </div>}
          <div className="eaBidMeta"><span>ВОДИ <b>{status==="live"?labelRole(auction?.leadingRole??null):"—"}</b></span><span>ОФЕРТИ <b>{status==="live"?auction?.sequence??0:"—"}</b></span></div>
          <div className="eaNextBid"><span>ВАШАТА ТОЧНА ОФЕРТА</span><strong>{money(nextPrice)}</strong><small>Минимум +{money(minStep)} · Вашият лимит: {money(budgetCap)}</small></div>
          {status==="live"&&bidder&&<div className="eaOfferControls">
            <span>УВЕЛИЧИ С</span>
            <div className="eaOfferSteps">{[50,100,250,500,1000].map(x=><button key={x} type="button" aria-pressed={selectedStep===x} className={selectedStep===x?"is-active":""} onClick={()=>setSelectedStep(x)}>+{money(x)}</button>)}</div>
            <form onSubmit={e=>{e.preventDefault();const v=Number(customStep);if(Number.isSafeInteger(v)&&v>=50&&v<=100000)setSelectedStep(v);else setError("Сумата трябва да е цяло число между 50 € и 100 000 €.");}}>
              <label>ДРУГА СУМА (€)<input type="number" inputMode="numeric" step="1" min="50" max="100000" value={customStep} onChange={e=>setCustomStep(e.target.value)}/></label>
              <button type="submit">ИЗПОЛЗВАЙ</button>
            </form>
          </div>}
          {status==="live"&&Number(auction?.extensionCount??0)>0&&<div className="eaBonusTime" role="status">🟡 УДЪЛЖАВАНИЯ В КРАЯ: {auction?.extensionCount} · Всяка валидна късна оферта удължава края на търга</div>}
          {status==="live"&&bonusUntil>localNow&&<div className="eaBonusTime" role="status">↗ УДЪЛЖАВАНЕТО Е ПОТВЪРДЕНО</div>}
          {status==="live"&&<div className="eaServerCooldown" role="status">{roundLocked?"⏳ ОБЩА ПАУЗА: "+cooldownRemaining+"s":auction?.leadingRole===role?"🟢 ВИЕ ВОДИТЕ — ИЗЧАКАЙТЕ ДРУГА ОФЕРТА":"🟢 НАДДАВАНЕТО Е ОТВОРЕНО"}{!budgetSufficient&&" · ДОСТИГНАТ Е ЛИМИТЪТ"}</div>}
          {status==="live"&&bidder?
            <button className="eaActionPrimary eaPlaceBid" type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"ПОТВЪРЖДАВАНЕ…":roundLocked?"⏳ МОЖЕ ДА НАДДАВАТЕ СЛЕД "+visibleRound+"s":auction?.leadingRole===role?"✓ ВИЕ ВОДИТЕ":!budgetSufficient?"ДОСТИГНАТ ЛИМИТ":"НАДДАЙ · "+money(nextPrice)+" →"}</button>
            :<div className="eaBidStandby">{status==="live"?"Режим наблюдател · следите офертите в реално време":(lobby?.count??0)<minPlayers?"Изчакваме още участници…":"Press ГОТОВ above for the next round"}</div>}
          {status==="live"&&<div className="eaBidRhythm"><span>ОБЩА СЪРВЪРНА ПАУЗА</span><b>{visibleRound}s</b><div><i style={{width:(100-Math.min(5,cooldownMs/1000)*20)+"%"}}/></div></div>}
          <div className="eaPanelFoot"><span>✓ Оферти, потвърдени от сървъра</span><span>✓ Само ДЕМО средства</span></div>
        </div>
      </section>
      <section className="eaVehicleFacts eaLiveVehicleFacts" aria-label="Vehicle specifications and known condition">
        <div className="eaVehicleFactsHead"><span>ЛОТ · DEMO-001</span><h2>2026 Mercedes-AMG G 63 — DEMONSTRATION VEHICLE</h2><small>Illustrative photo. VIN, mileage, actual damage, registration and condition have NOT been verified.</small></div>
        <div className="eaLotTabs">{["Details","Condition","Documents","Transport","History"].map(t=><button type="button" key={t} aria-pressed={detailTab===t} className={detailTab===t?"is-active":""} onClick={()=>setDetailTab(t)}>{{Details:"Детайли",Condition:"Състояние",Documents:"Документи",Transport:"Транспорт",History:"История"}[t]??t}</button>)}</div>
        {detailTab==="Details"&&<div className="eaLotGrid">{[["LOT","DEMO-001"],["MILEAGE","NOT VERIFIED"],["VIN","NOT VERIFIED"],["ENGINE / FUEL","NOT VERIFIED"],["GEARBOX","NOT VERIFIED"],["LOCATION","NOT VERIFIED"],["PRICE","Live server value"],["ОФЕРТИ",""+(auction?.sequence??0)],["STARTED",auction?new Date(auction.startedAt).toLocaleTimeString("bg-BG"):"—"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
        {detailTab==="Condition"&&<p>Damage, starts, drives, keys, inspection and repairs: UNKNOWN / NOT VERIFIED. Do not rely on the illustration to assess a vehicle.</p>}
        {detailTab==="Documents"&&<p>Official vehicle documentation: NOT VERIFIED. Only a DEMO closing record can be downloaded once the round finishes.</p>}
        {detailTab==="Transport"&&<p>Shipping, VAT, pickup location and delivery fees: NOT VERIFIED. This auction uses no real money.</p>}
        {detailTab==="History"&&<p>{auction?.sequence??0} accepted bids. Scroll below for server-confirmed bid history; the counter is authoritative.</p>}
      </section>
      <section className="eaHistoryPanel">
        <div className="eaHistoryHead"><div><span className="eaEyebrow">АКТИВНОСТ</span><h2>История на офертите</h2></div><span>{latest.length} {latest.length===1?"приета оферта":"приети оферти"}</span></div>
        {latest.length?<>
          <div className="eaHistoryRows">{latest.slice(0,historyExpanded?latest.length:3).map(e=>
            <div key={e.sequence}><span className="eaHistoryRank">#{e.sequence}</span><strong>{labelRole(e.role)}</strong><small>{new Date(e.at).toLocaleTimeString("bg-BG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small><b>{money(Number(e.amount))}</b></div>)}</div>
          {latest.length>3&&<button className="eaHistoryToggle" type="button" onClick={()=>setHistoryExpanded(v=>!v)}>{historyExpanded?"Покажи по-малко ↑":"Покажи всички "+latest.length+" оферти ↓"}</button>}
        </>:<p className="eaEmptyHistory">Приетите оферти ще се появят тук веднага след старта на търга.</p>}
      </section>
      {bidFlash&&<div className="eaBidToast" role="status" aria-live="polite" key={bidFlash.sequence}><span>✓ ОФЕРТАТА Е ПРИЕТА · #{bidFlash.sequence}</span><strong>{money(bidFlash.amount)}</strong><small>{labelRole(bidFlash.role)} води</small></div>}
      {status==="live"&&bidder&&<div className="eaBidDock">
        <div><span>ОФЕРТА · {minutes}:{seconds} ОСТАВАТ</span><strong>{money(nextPrice)}</strong></div>
        <button type="button" onClick={()=>void bid()} disabled={!canBid}>{busy?"…":roundLocked?"ИЗЧАКАЙ "+visibleRound+"s":auction?.leadingRole===role?"ВОДИТЕ":!budgetSufficient?"ЛИМИТ":"НАДДАЙ "+money(nextPrice)+" →"}</button>
      </div>}
      </>}
      {celebratingId===auction?.id&&auction?.winnerRole&&<div className="eaCelebration" aria-hidden="true" key={celebratingId}>
        <div className="eaCelebrationCard"><span>🏆</span><small>ENCHEV AUCTIONS · DEMO</small><strong>{labelRole(auction.winnerRole)} ПЕЧЕЛИ!</strong><b>{money(auction.currentAmount)}</b></div>
        {Array.from({length:38},(_,i)=><i key={i} style={{"--ea-x":((i*47)%100)+"%","--ea-delay":((i*17)%17)*.07+"s","--ea-drift":((i%2?1:-1)*(13+i%8*8))+"px","--ea-turn":((i%2?1:-1)*540)+"deg"} as CSSProperties}/>)}
      </div>}
      {!connected&&<div className="eaRoomAlert" role="status">Няма връзка. Наддаването е спряно, докато връзката се възстанови.</div>}
    </div>}
    <footer className="eaRoomFooter">ENCHEV AUCTIONS · ЧАСТНА ДЕМОНСТРАЦИЯ · БЕЗ РЕАЛНИ ТРАНЗАКЦИИ</footer>
  </main>;
}
