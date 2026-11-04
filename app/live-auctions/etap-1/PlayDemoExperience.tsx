"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import "./play-demo-experience.css";
import "./play-demo-1to1.css";

type Phase="joining"|"live"|"finished";
type BidEntry={id:number;name:string;amount:number;time:number;mine?:boolean};
type Props={audio:AudioContext|null;onExit:()=>void};

const JOIN_DURATION_MS=5000;
const ROUND_DURATION_MS=60000;
const INITIAL_PRICE=1000000;
const BOTS=[
  {name:"Bidder_7482",at:850},
  {name:"Bidder_3107",at:2200},
  {name:"Bidder_5521",at:3700},
] as const;
const fmt=(v:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(v);
const cash=(v:number)=>fmt(v)+" €";
const clock=(ms:number)=>"00:"+String(Math.ceil(Math.max(0,ms)/1000)).padStart(2,"0");
const degrees=Math.PI/180;
const cx=280,cy=250,r=207;
const gaugeTicks=Array.from({length:61},(_,n)=>{
  const angle=(180-n*3)*degrees;
  const inside=n%5===0?183:191;
  return {n,
    x1:cx+inside*Math.cos(angle), y1:cy-r*Math.sin(angle)+(r-inside)*Math.sin(angle),
    x2:cx+206*Math.cos(angle),y2:cy-206*Math.sin(angle),
    color:n<23?"#24f22d":n<37?"#d9f51a":n<49?"#ffae12":"#ff1d32",
    width:n%5===0?5:3.1};
});
function Icon({name}:{name:string}){
  const props={width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
  return <svg {...props}>
    {name==="back"&&<path d="m14 5-7 7 7 7"/>}
    {name==="sound"&&<><path d="M5 9H2v6h3l5 4V5z"/><path d="M14 9q3 3 0 6m3-9q6 6 0 12"/></>}
    {name==="mute"&&<><path d="M5 9H2v6h3l5 4V5z"/><path d="m14 9 7 7m0-7-7 7"/></>}
    {name==="fuel"&&<><path d="M4 21V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M3 21h13M5 5h9v7H5zM15 8h2l3 4v7a2 2 0 0 1-4 0v-4"/></>}
    {name==="gavel"&&<><path d="m4 20 8-8m-4-5 9 9M6 3l6 6m4-6 5 5"/></>}
    {name==="engine"&&<><path d="M8 6h9v3h3v9H4v-9h4zM9 6V3m4 3V3m-9 9H2m18 0h2"/></>}
    {name==="bolt"&&<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>}
    {name==="speed"&&<><path d="M4 18A9 9 0 0 1 20 18M12 17l5-7"/><circle cx="12" cy="17" r="1"/></>}
    {name==="calendar"&&<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/></>}
    {name==="users"&&<><circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3zm15-14a3 3 0 0 1 0 6m1 2a6 6 0 0 1 4 6"/></>}
    {name==="refresh"&&<><path d="M21 11a9 9 0 1 0-2.5 6M21 4v7h-7"/></>}
  </svg>;
}

function Gauge({leftMs}:{leftMs:number}){
  const secs=Math.min(60,Math.max(0,leftMs/1000));
  const angle=secs/60*180;
  const nx=cx+167*Math.cos(angle*degrees),ny=cy-167*Math.sin(angle*degrees);
  const critical=secs<=10;
  return <section className={`eaPDGauge ${critical?"is-critical":""}`} role="timer" aria-label={`Остават ${Math.ceil(secs)} секунди`}>
    <svg className="eaPDGaugeSvg" viewBox="0 0 560 282" aria-hidden="true">
      <defs><linearGradient id="eaPDGlow"><stop stopColor="#58fa32"/><stop offset=".48" stopColor="#ecfa28"/><stop offset=".77" stopColor="#ff9416"/><stop offset="1" stopColor="#f20928"/></linearGradient></defs>
      <path d="M65 250A215 215 0 0 1 495 250" stroke="#151518" strokeWidth="20" fill="none"/>
      <path d="M65 250A215 215 0 0 1 495 250" stroke="url(#eaPDGlow)" strokeWidth="13" strokeLinecap="round" fill="none"/>
      {gaugeTicks.map(p=><line key={p.n} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.width}/>)}
      <text x="66" y="271" className="eaPDTickNum">60</text>
      <text x="81" y="156" className="eaPDTickNum">50</text>
      <text x="160" y="68" className="eaPDTickNum">40</text>
      <text x="280" y="33" className="eaPDTickNum">30</text>
      <text x="400" y="68" className="eaPDTickNum">10</text>
      <text x="482" y="156" className="eaPDTickNum">5</text>
      <text x="498" y="271" className="eaPDTickNum">0</text>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ee0d30" strokeWidth="8" strokeLinecap="round"/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff1e9" strokeWidth="2" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="14" fill="#171619" stroke="#ff5f69" strokeWidth="4"/>
      <circle cx={cx} cy={cy} r="6" fill="#ddd"/>
    </svg>
    <div className="eaPDGaugeCenter">
      <span className="eaPDGaugeTitle">ОСТАВАЩО ВРЕМЕ</span>
      <strong className="eaPDTime">{clock(leftMs)}</strong>
      <span className="eaPDFuel"><Icon name="fuel"/></span>
      <span className="eaPDTicks">{critical?"⚠ ПОСЛЕДНИ 10 СЕК. · ТИК-ТАК ×2":"ТИК-ТАК · ВСЯКА СЕКУНДА"}</span>
    </div>
  </section>;
}

export default function PlayDemoExperience({audio,onExit}:Props){
  const [phase,setPhase]=useState<Phase>("joining");
  const [nowMs,setNowMs]=useState(JOIN_DURATION_MS);
  const [price,setPrice]=useState(INITIAL_PRICE);
  const [bids,setBids]=useState<BidEntry[]>([
    {id:3,name:"Bidder_7482",amount:INITIAL_PRICE,time:0},
    {id:2,name:"Bidder_3107",amount:900000,time:0},
    {id:1,name:"Bidder_5521",amount:750000,time:0},
  ]);
  const [soundEnabled,setSoundEnabled]=useState(true);
  const [allBids,setAllBids]=useState(false);
  const [pendingStep,setPendingStep]=useState<number|null>(null);
  const [status,setStatus]=useState("");
  const [carousel,setCarousel]=useState(0);
  const [carMode,setCarMode]=useState<"3d"|"photo">("3d");
  const [modelLoaded,setModelLoaded]=useState(false);
  const [modelError,setModelError]=useState(false);
  const startedAt=useRef<number|null>(null);
  const clockStartedAt=useRef<number|null>(null);
  const deadline=useRef<number|null>(null);
  const lastBeat=useRef<number|null>(null);
  const botEvents=useRef(new Set<number>());
  const nextId=useRef(4);
  const priceRef=useRef(INITIAL_PRICE);
  const canSound=useRef(true);
  const liveRef=useRef(false);
  const bidLead=useRef("Bidder_7482");

  const tone=useCallback((freq:number,delay=0,duration=.075,volume=.036)=>{
    if(!audio||!canSound.current||audio.state!=="running")return;
    try{
      const osc=audio.createOscillator(),gain=audio.createGain();
      const time=audio.currentTime+delay;
      osc.type="sine";osc.frequency.setValueAtTime(freq,time);
      gain.gain.setValueAtTime(volume,time);
      gain.gain.exponentialRampToValueAtTime(.001,time+duration);
      osc.connect(gain);gain.connect(audio.destination);
      osc.start(time);osc.stop(time+duration+.015);
    }catch{/* Audio disabled on this device */}
  },[audio]);
  const playBidSound=useCallback(()=>{tone(720,0,.075);tone(990,.09,.11);},[tone]);

  const addBid=useCallback((name:string,delta:number,mine=false)=>{
    if(!liveRef.current)return;
    const next=priceRef.current+delta;
    priceRef.current=next;bidLead.current=name;
    setPrice(next);
    setBids(prev=>[{id:nextId.current++,name,amount:next,time:performance.now(),mine},...prev]);
    setStatus(mine?"Вашата демонстрационна оферта е приета.":"Нова оферта от виртуален участник.");
    playBidSound();
    const remains=(deadline.current??0)-performance.now();
    if(remains>0&&remains<10000){deadline.current=performance.now()+10000;setStatus("Офертата е приета · +10 секунди удължаване на тестовия търг.");}
  },[playBidSound]);

  const startRound=useCallback(()=>{
    const t=performance.now();
    setPhase("live");liveRef.current=true;clockStartedAt.current=t;
    deadline.current=t+ROUND_DURATION_MS;
    lastBeat.current=null;botEvents.current.clear();
    setNowMs(ROUND_DURATION_MS);
    setPendingStep(null);
    setStatus("Тестовият търг е отворен. Всички оферти са симулирани.");
    tone(880,0,.09,.045);tone(1090,.15,.12,.05);
  },[tone]);

  useEffect(()=>{
    startedAt.current=performance.now();
    const id=window.setInterval(()=>{
      const now=performance.now();
      if(phase==="joining"){
        const elapsed=now-(startedAt.current??now);
        setNowMs(Math.max(0,JOIN_DURATION_MS-elapsed));
        if(elapsed>=JOIN_DURATION_MS){window.clearInterval(id);startRound();}
      }else if(phase==="live"){
        const ms=Math.max(0,(deadline.current??now)-now);
        setNowMs(ms);
        const elapsed=(now-(clockStartedAt.current??now))/1000;
        for(const [sec,idx] of [[14,0],[27,1],[39,2]]){
          if(elapsed>=sec&&!botEvents.current.has(sec)&&ms>1000){
            botEvents.current.add(sec);const bot=BOTS[idx];addBid(bot.name,50000);
          }
        }
        const bucket=ms>10000?100000+Math.floor(ms/1000):Math.floor(ms/500);
        if(lastBeat.current!==bucket&&ms>0){
          if(lastBeat.current!==null){
            tone(ms<=10000?830:520,0,.043,.029);
            if(ms<=10000&&lastBeat.current>20){tone(990,.12,.12,.053);tone(730,.29,.15,.043);}
          }
          lastBeat.current=bucket;
        }
        if(ms<=0){liveRef.current=false;window.clearInterval(id);setPhase("finished");setStatus("Демонстрационният търг завърши.");tone(980,0,.20);tone(740,.25,.22);tone(525,.5,.32);}
      }
    },70);
    return()=>window.clearInterval(id);
  },[phase,startRound,addBid,tone]);

  const joinCount=phase==="joining"?BOTS.filter(b=>JOIN_DURATION_MS-nowMs>=b.at).length:3;
  const offer=(amount:number)=>{
    if(phase!=="live")return;
    if(pendingStep!==amount){setPendingStep(amount);setStatus(`Натисни отново, за да потвърдиш +${cash(amount)}. Само тестови средства.`);return;}
    setPendingStep(null);addBid("ВИЕ",amount,true);
  };
  const close=()=>{liveRef.current=false;onExit();};
  const replay=()=>{
    setPhase("joining");
    setNowMs(JOIN_DURATION_MS);
    setPrice(INITIAL_PRICE);priceRef.current=INITIAL_PRICE;bidLead.current="Bidder_7482";
    setBids([{id:3,name:"Bidder_7482",amount:INITIAL_PRICE,time:0},{id:2,name:"Bidder_3107",amount:900000,time:0},{id:1,name:"Bidder_5521",amount:750000,time:0}]);
    nextId.current=4;botEvents.current.clear();startedAt.current=performance.now();lastBeat.current=null;liveRef.current=false;
    setStatus("");setPendingStep(null);setAllBids(false);
  };
  const visibleBids=useMemo(()=>allBids?bids:bids.slice(0,3),[bids,allBids]);
  const timeLabel=(time:number)=>time===0?"преди старта":(Math.max(0,Math.floor((performance.now()-time)/1000))+" сек. назад");

  return <main className="eaPlayDemo" id="main-content" aria-label="Интерактивен симулиран автомобилен търг">
    <header className="eaPDHeader">
      <button type="button" className="eaPDBack" onClick={close} aria-label="Върни се към лобито"><Icon name="back"/></button>
      <img src="/brand/ea-official-dark.svg" alt="E&A East and West Auctioneers Group"/>
      <div className="eaPDBadges"><span className="eaPDLive">● DEMO</span><small>◉ {joinCount} БОТА</small></div>
      <button className="eaPDVolume" onClick={()=>{canSound.current=!soundEnabled;setSoundEnabled(x=>!x);if(!soundEnabled&&audio)void audio.resume();}} type="button" aria-label={soundEnabled?"Изключи звук":"Включи звук"} aria-pressed={soundEnabled}><Icon name={soundEnabled?"sound":"mute"}/></button>
    </header>
    {phase==="joining"?<section className="eaPDJoining" aria-live="polite">
      <div className="eaPDCover"><span className="eaPDRound">E&A PRIVATE SHOWROOM</span><img src="/brand/ea-official-dark.svg" alt="E&A"/><span>ЛОБИ · ВИРТУАЛЕН ТЕСТ</span></div>
      <div className="eaPDJoiningClock"><span>СТАРТ НА ТЕСТОВИЯ ТЪРГ СЛЕД</span><strong>{clock(nowMs)}</strong></div>
      <h1>Ботовете влизат в залата</h1>
      <p>Автоматична 5-секундна симулация. Няма реални потребители, плащания или регистрирани оферти.</p>
      <div className="eaPDBotRoster">
        {BOTS.map((bot,i)=><div className={i<joinCount?"is-here":""} key={bot.name}><span className="eaPDBotAvatar">{i<joinCount?"✓":"◌"}</span><b>{bot.name}</b><span>{i<joinCount?"В ЗАЛАТА":"СВЪРЗВАНЕ…"}</span></div>)}
      </div>
      <div className="eaPDJoinProgress"><i style={{width:(100*(JOIN_DURATION_MS-nowMs)/JOIN_DURATION_MS)+"%"}}/></div>
    </section>:<div className="eaPDAuctionLayout">
      <section className="eaPDMainPanel">
        <div className="eaPDCarShowcase">
          <div className="eaPDCarInfo">
            <span className="eaPDCarCrest" role="img" aria-label="Стилизирана автомобилна емблема"><small>LAMBORGHINI</small><b>♉</b></span>
            <div className="eaPDCarInfoWords"><span className="eaPDLotLabel">ЛОТ №001 · DEMO</span><h1>LAMBORGHINI<br/><b>REVUELTO</b></h1><p>V12 HYBRID <em/> 1 015 к.с. <em/> 0–100 км/ч: 2.5 s</p></div>
          </div>
        <div className="eaPDCarViewHeader">
          <div><strong>ИНТЕРАКТИВЕН 360° АВТОМОБИЛ</strong><small>Завърти с пръст или мишка · мащабирай с два пръста</small></div>
          <div className="eaPDCarModeSwitch" role="group" aria-label="Избор между 3D модел и снимка">
            <button type="button" className={carMode==="3d"?"selected":""} aria-pressed={carMode==="3d"} onClick={()=>setCarMode("3d")}>◉ 360° 3D</button>
            <button type="button" className={carMode==="photo"?"selected":""} aria-pressed={carMode==="photo"} onClick={()=>setCarMode("photo")}>▧ Снимка</button>
          </div>
        </div>
        <div className={`eaPDCarScene ${carMode==="3d"?"eaPDCarScene3D":"eaPDCarScenePhoto"} variant-${carousel}`}>
          {carMode==="3d"?<>
            {!modelLoaded&&!modelError&&<div className="eaPDModelLoading" role="status"><span className="eaPDModelSpinner" aria-hidden="true"/>ЗАРЕЖДАНЕ НА ИСТИНСКИЯ 3D АВТОМОБИЛ…</div>}
            {modelError?<div className="eaPDModelFail"><strong>3D моделът е недостъпен.</strong><button type="button" onClick={()=>setCarMode("photo")}>ПОКАЖИ СНИМКА</button></div>:
            <iframe
              className="eaPDModelIframe"
              title="Lamborghini Revuelto — истински интерактивен 360-градусов 3D модел"
              src="https://sketchfab.com/models/cf52245eb68f48daa909c7ad2a8deaa3/embed?autostart=1&autospin=0.25&ui_theme=dark&ui_hint=2"
              loading="eager"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={()=>setModelLoaded(true)}
              onError={()=>{setModelError(true);setModelLoaded(false);}}
            />}
            <div className="eaPDModelHint" aria-hidden="true">↔ ВЪРТИ 360° · СВОБОДЕН ОГЛЕД</div>
          </>:<>
            <div className="eaPDHalo"/>
            <img src="/images/enchev-lamborghini-hero.jpg" alt="Илюстративна снимка на концептуален автомобил, не реален аукционен лот" loading="eager"/>
            <button type="button" className="eaPDImageArrow left" aria-label="Предишен фотографски изглед" onClick={()=>setCarousel(v=>(v+2)%3)}>‹</button>
            <button type="button" className="eaPDImageArrow right" aria-label="Следващ фотографски изглед" onClick={()=>setCarousel(v=>(v+1)%3)}>›</button>
            <div className="eaPDCarouselDots"><i className={carousel===0?"active":""}/><i className={carousel===1?"active":""}/><i className={carousel===2?"active":""}/></div>
          </>}
          <span className="eaPDCarDisclosure">3D ДЕМО · НЕ Е РЕАЛЕН ЛОТ</span>
        </div>
        {carMode==="3d"&&<p className="eaPDModelCredit">3D модел: <a href="https://sketchfab.com/3d-models/free-lamborghini-revuelto-cf52245eb68f48daa909c7ad2a8deaa3" target="_blank" rel="noreferrer noopener">ALIEEEN / Sketchfab</a> · CC BY · външен 3D преглед</p>}
        </div>
        <section className="eaPDActionPanel">
          <Gauge leftMs={phase==="finished"?0:nowMs}/>
          <div className="eaPDPrice"><strong>{cash(price)}</strong><span>ТЕКУЩА ДЕМО ОФЕРТА</span></div>
          <div className="eaPDBidButtons">
            {[100000,250000].map((value,i)=><button type="button" key={value} className={i===0?"eaPDMetalBid":"eaPDRedBid"} disabled={phase!=="live"} onClick={()=>offer(value)}>
              <span>{pendingStep===value?"ПОТВЪРДИ":"НАДДАЙ"}</span><strong>+{cash(value)}</strong>
            </button>)}
          </div>
          <p className="eaPDStatus" role="status" aria-live="polite">{status}</p>
        </section>
      </section>
      <aside className="eaPDAside">
        <div className="eaPDOfferHead"><strong>ПОСЛЕДНИ ОФЕРТИ</strong><button type="button" onClick={()=>setAllBids(v=>!v)}>{allBids?"Скрий":"Всички оферти"} ›</button></div>
        <div className="eaPDOfferList">{visibleBids.map(b=><div className="eaPDOffer" key={b.id}><span className="eaPDUserIcon">♟</span><span>{b.mine?"ВИЕ · ДЕМО":b.name}</span><b>{cash(b.amount)}</b><small>{timeLabel(b.time)}</small></div>)}</div>
        <div className="eaPDSpecs">
          <div><Icon name="gavel"/><span>Лот №001</span></div>
          <div><Icon name="engine"/><span>V12 Hybrid</span></div>
          <div><Icon name="bolt"/><span>1 015 к.с.</span></div>
          <div><Icon name="speed"/><span>0–100: 2.5 s</span></div>
          <div><Icon name="calendar"/><span>2024</span></div>
        </div>
        <details className="eaPDDetailsBox"><summary>ИНФОРМАЦИЯ ЗА ТЕСТОВИЯ ТЪРГ</summary><p>3 тестови бота · автоматични демо оферти · двустъпково наддаване · удължаване в последните 10 сек.</p><p>Звуков сигнал от 60 сек.; тик-так ×2 в последните 10 сек. Звукът е наличен след PLAY DEMO. Няма реални сделки или плащания.</p></details>
        {phase==="finished"&&<div className="eaPDWinner"><span>🏁 ТЕСТОВИЯТ ТЪРГ ЗАВЪРШИ</span><strong>Победител: {bidLead.current}</strong><b>{cash(price)}</b><button type="button" onClick={replay}><Icon name="refresh"/> НОВО ДЕМО</button></div>}
      </aside>
    </div>}
    <footer className="eaPDFooter"><span>ENCHEV AUCTIONS · LOCAL DEMO MODE</span><button onClick={phase==="finished"?replay:close}>{phase==="finished"?"РЕСТАРТИРАЙ ДЕМОТО":"НАЗАД КЪМ ЛОБИТО"}</button></footer>
  </main>;
}
