"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./presentation.module.css";

const AUTO_MS = 9000;
const CAR = "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1400&q=88";
const LOT = "EA-10539";

const scenes = [
  { id:"intro", phase:0, kicker:"ЕДНА КОЛА · ЦЕЛИЯТ ПРОЦЕС", title:"Нека проследим един автомобил.", accent:"От приемането до приключената сделка.", sub:"Не говорим абстрактно. Показваме точно как една кола минава през ENCHEV." },
  { id:"arrival", phase:0, kicker:"01 · ПРИЕМАНЕ", title:"Автомобилът влиза в системата.", accent:"Получава собствено досие.", sub:"Колата се регистрира веднъж. Оттук нататък всичко, което се случва с нея, остава свързано." },
  { id:"inspection", phase:1, kicker:"02 · ПРОВЕРКА И СНИМКИ", title:"Виждаме реалното състояние.", accent:"Снимки, данни и проверка преди търга.", sub:"Екипът добавя снимките, километража, VIN, състоянието и наличните документи." },
  { id:"listing", phase:2, kicker:"03 · ПУБЛИКУВАНЕ", title:"Колата става готова за пазара.", accent:"Една обява. Пълната информация.", sub:"Купувачът вижда автомобила, реалните снимки, ключовите данни и условията преди да наддава." },
  { id:"auction", phase:3, kicker:"04 · LIVE ТЪРГ", title:"Започва наддаването.", accent:"Офертите се движат в реално време.", sub:"Всеки валиден bid се подрежда от системата. В края има един официален резултат." },
  { id:"payment", phase:4, kicker:"05 · ПОБЕДИТЕЛ И ПЛАЩАНЕ", title:"Търгът приключва. Сделката продължава.", accent:"Победителят вижда какво следва.", sub:"Резултатът се заключва, сделката се отваря и плащането преминава към следващия етап." },
  { id:"documents", phase:5, kicker:"06 · ДОКУМЕНТИ", title:"Документите вървят с автомобила.", accent:"Вижда се какво е готово и какво липсва.", sub:"Без търсене в чатове и папки. Статусът на документите е част от самата сделка." },
  { id:"transport", phase:6, kicker:"07 · ТРАНСПОРТ", title:"Колата тръгва към купувача.", accent:"Местоположението и етапът са видими.", sub:"От площадката до крайната точка ENCHEV следи движението на автомобила и следващата стъпка." },
  { id:"closed", phase:7, kicker:"08 · ЗАВЪРШЕНА СДЕЛКА", title:"Един автомобил. Пълна история.", accent:"От входа до доставката.", sub:"Когато сделката приключи, цялата история остава на едно място — кой, кога, колко и как." },
  { id:"dashboard", phase:8, kicker:"09 · УПРАВЛЕНИЕ", title:"После умножаваме това по цялата компания.", accent:"Всичко се събира в едно управленско табло.", sub:"Автомобили, търгове, плащания, документи и транспорт — в една оперативна картина." },
  { id:"beginning", phase:9, kicker:"ТОВА Е НАЧАЛОТО", title:"Първо свързваме целия процес.", accent:"После системата започва да помага сама.", sub:"Когато данните и процесите са на едно място, вече можем безопасно да добавим автоматизация и AI." },
  { id:"ai", phase:9, kicker:"AI И АВТОМАТИЗАЦИЯ", title:"Системата започва да следи работата.", accent:"Показва какво липсва, какво чака и къде има проблем.", sub:"AI подпомага хората, подготвя информация и автоматизира повторяемата работа — без да решава критичния резултат от търга." },
  { id:"scale", phase:9, kicker:"СЛЕДВАЩОТО НИВО", title:"Същият процес. Повече автомобили. Повече държави.", accent:"ENCHEV расте, без да започва отначало.", sub:"Добавяме хора, пазари, сървъри и капацитет върху същата основна система." },
  { id:"final", phase:9, kicker:"ENCHEV", title:"Не строим просто сайт.", accent:"Строим начина, по който ще работи компанията.", sub:"От първата кола до международна автомобилна система." },
] as const;

const journeyLabels = ["КОЛА","СНИМКИ","ОБЯВА","ТЪРГ","PAY","ДОКУМЕНТИ","ТРАНСПОРТ","ГОТОВО"];

export default function PresentationExperience(){
  const [active,setActive]=useState(0);
  const [playing,setPlaying]=useState(true);
  const refs=useRef<(HTMLElement|null)[]>([]);
  const total=scenes.length;

  useEffect(()=>{
    const onScroll=()=>{
      let best=0;
      let bestDistance=Infinity;
      refs.current.forEach((node,index)=>{
        if(!node)return;
        const rect=node.getBoundingClientRect();
        const distance=Math.abs(rect.top-window.innerHeight*.16);
        if(distance<bestDistance){bestDistance=distance;best=index;}
      });
      setActive(best);
    };
    onScroll();
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);

  useEffect(()=>{
    if(!playing)return;
    const timer=window.setInterval(()=>{
      setActive(current=>{
        const next=(current+1)%total;
        refs.current[next]?.scrollIntoView({behavior:"smooth",block:"start"});
        return next;
      });
    },AUTO_MS);
    return()=>window.clearInterval(timer);
  },[playing,total]);

  const progress=useMemo(()=>((active+1)/total)*100,[active,total]);
  const activePhase=scenes[active]?.phase ?? 0;

  const go=(index:number)=>{
    setActive(index);
    refs.current[index]?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  return <main id="main-content" className={styles.presentation}>
    <div className={styles.progress}><span style={{width:`${progress}%`}}/></div>

    <div className={styles.storyRail}>
      <div className={styles.storyLot}><span>LOT</span><b>{LOT}</b></div>
      <div className={styles.storySteps}>
        {journeyLabels.map((label,index)=><div key={label} className={index<=activePhase?styles.storyDone:""}><i>{index<activePhase?"✓":index+1}</i><span>{label}</span></div>)}
      </div>
    </div>

    <div className={styles.floatingControls}>
      <button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?"ПАУЗА":"ПУСНИ"}</button>
      <span>{String(active+1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
    </div>

    <nav className={styles.dots} aria-label="Сцени">
      {scenes.map((scene,index)=><button key={scene.id} type="button" className={active===index?styles.dotActive:""} onClick={()=>go(index)} aria-label={`Сцена ${index+1}: ${scene.kicker}`}><span/></button>)}
    </nav>

    {scenes.map((scene,index)=><section
      key={scene.id}
      ref={node=>{refs.current[index]=node;}}
      className={styles.scene}
      data-active={active===index?"true":"false"}
    >
      <div className={styles.grid}/>
      <div className={styles.glow}/>
      <div className={styles.copy}>
        <span className={styles.kicker}>{scene.kicker}</span>
        <h1>{scene.title}</h1>
        <h2>{scene.accent}</h2>
        <p>{scene.sub}</p>
      </div>
      <Visual id={scene.id}/>
      <div className={styles.sceneFoot}><span>{String(index+1).padStart(2,"0")}</span><i/><b>{LOT} · ENCHEV</b></div>
    </section>)}
  </main>;
}

function CarPhoto({compact=false}:{compact?:boolean}){
  return <div className={compact?styles.carPhotoCompact:styles.carPhoto}>
    <img src={CAR} alt="Автомобил LOT EA-10539"/>
    <div className={styles.carPhotoShade}/>
    <span className={styles.lotBadge}>LOT {LOT}</span>
    <div className={styles.carCaption}><strong>2022 Audi RS3 Sportback</strong><small>41 280 км · VERIFIED</small></div>
  </div>;
}

function Visual({id}:{id:string}){
  if(id==="intro") return <div className={styles.visual}><CarPhoto/><div className={styles.miniFlow}>{["ВЛИЗА","ТЪРГ","ПЛАЩАНЕ","ДОКУМЕНТИ","ТРАНСПОРТ"].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}</div></div>;

  if(id==="arrival") return <div className={styles.visual}><CarPhoto/><div className={styles.sideCard}><span className={styles.cardLabel}>НОВО ДОСИЕ</span><h3>EA-10539</h3><dl><div><dt>VIN</dt><dd>WAU••••539</dd></div><div><dt>Локация</dt><dd>Crewe, UK</dd></div><div><dt>Статус</dt><dd className={styles.ok}>Приет</dd></div></dl></div></div>;

  if(id==="inspection") return <div className={styles.visual}><div className={styles.photoBoard}><div className={styles.mainPhoto}><img src={CAR} alt="Главна снимка"/></div><div className={styles.thumbPhoto}><img src={CAR} alt="Детайл отпред"/></div><div className={styles.thumbPhoto}><img src={CAR} alt="Детайл отстрани"/></div><div className={styles.checkList}><b>ПРОВЕРКА</b><span>✓ VIN потвърден</span><span>✓ 41 280 км</span><span>✓ Снимки готови</span><span>✓ Състояние описано</span></div></div></div>;

  if(id==="listing") return <div className={styles.visual}><div className={styles.listingCard}><CarPhoto compact/><div className={styles.listingBody}><span className={styles.cardLabel}>ГОТОВ ЗА ПАЗАРА</span><h3>2022 Audi RS3 Sportback</h3><p>2.5 TFSI · 41 280 км · Crewe, UK</p><div className={styles.dataRow}><span>VERIFIED</span><span>REAL PHOTOS</span><span>HISTORY</span></div><div className={styles.listingBottom}><small>Стартова цена</small><strong>€18 400</strong><button>ВИЖ ЛОТА →</button></div></div></div></div>;

  if(id==="auction") return <div className={styles.visual}><div className={styles.auctionShell}><div className={styles.auctionHeader}><span>● LIVE AUCTION</span><b>{LOT}</b><small>00:18</small></div><div className={styles.auctionGrid}><CarPhoto compact/><div className={styles.bidPanel}><small>ТЕКУЩА ОФЕРТА</small><strong>€19 200</strong><div className={styles.bidHistory}><span><i/>€18 400</span><span><i/>€18 600</span><span><i/>€18 800</span><span className={styles.bidHot}><i/>€19 200</span></div><button>НАДДАЙ + €200</button></div></div></div></div>;

  if(id==="payment") return <div className={styles.visual}><div className={styles.dealCard}><div className={styles.dealTop}><span className={styles.sold}>SOLD</span><b>{LOT}</b></div><div className={styles.dealCar}><img src={CAR} alt="Продаден автомобил"/><div><small>Крайна цена</small><strong>€19 200</strong><p>Победител: Buyer #2841</p></div></div><div className={styles.paymentSteps}><span className={styles.complete}>✓ Търг приключен</span><span className={styles.current}>2 Плащане</span><span>3 Потвърждение</span></div></div></div>;

  if(id==="documents") return <div className={styles.visual}><div className={styles.docsShell}><div className={styles.docsCar}><CarPhoto compact/></div><div className={styles.docsList}><span className={styles.cardLabel}>ДОКУМЕНТИ · {LOT}</span>{[["Фактура","Готова"],["Договор / sale confirmation","Готов"],["Export пакет","В подготовка"],["Транспортни документи","Очакват маршрут"]].map(([a,b],i)=><div key={a}><i className={i<2?styles.docDone:styles.docPending}>{i<2?"✓":"•"}</i><b>{a}</b><small>{b}</small></div>)}</div></div></div>;

  if(id==="transport") return <div className={styles.visual}><div className={styles.transportShell}><div className={styles.routeTop}><span>CREWE, UK</span><b>→</b><span>SOFIA, BG</span></div><div className={styles.routeMap}><i className={styles.routeLine}/><span className={styles.pinA}>UK</span><span className={styles.pinB}>BG</span><div className={styles.truck}>▰</div></div><div className={styles.routeStatus}><span className={styles.complete}>✓ Взет от площадката</span><span className={styles.current}>● В транспорт</span><span>○ Доставка</span></div></div></div>;

  if(id==="closed") return <div className={styles.visual}><div className={styles.historyShell}><CarPhoto compact/><div className={styles.historyTimeline}>{[["12 SEP","Приет"],["13 SEP","Проверен"],["14 SEP","Публикуван"],["18 SEP","Продаден · €19 200"],["19 SEP","Платен"],["20 SEP","Документи"],["22 SEP","Транспорт"],["24 SEP","Доставен"]].map(([d,s],i)=><div key={s}><span>{d}</span><i>✓</i><b>{s}</b></div>)}</div></div></div>;

  if(id==="dashboard") return <div className={styles.visual}><div className={styles.dashboard}><div className={styles.dashboardTop}><b>ENCHEV · CONTROL CENTER</b><span>LIVE</span></div><div className={styles.metric}><small>Автомобили</small><strong>247</strong><span>38 в движение</span></div><div className={styles.metric}><small>LIVE търгове</small><strong>12</strong><span>286 активни bidders</span></div><div className={styles.metric}><small>Плащания</small><strong>31</strong><span>4 чакат действие</span></div><div className={styles.metric}><small>Транспорт</small><strong>22</strong><span>7 доставки днес</span></div><div className={styles.dashboardTable}><div><b>EA-10539</b><span>Доставен</span><strong>€19 200</strong></div><div><b>EA-10614</b><span>В транспорт</span><strong>€24 800</strong></div><div><b>EA-10633</b><span>Документи</span><strong>€17 600</strong></div></div></div></div>;

  if(id==="beginning") return <div className={styles.visual}><div className={styles.beginning}><span>01</span><b>СВЪРЗАН ПРОЦЕС</b><i>→</i><span>02</span><b>АВТОМАТИЗАЦИЯ</b><i>→</i><span>03</span><b>AI</b><i>→</i><span>04</span><b>МАЩАБ</b></div></div>;

  if(id==="ai") return <div className={styles.visual}><div className={styles.aiBoard}><div className={styles.aiSummary}><span>AI OPERATIONS</span><strong>3 неща искат внимание</strong><small>Системата анализира процесите, но не променя резултатите от търга.</small></div><div className={styles.aiTasks}><div><i>!</i><b>EA-10633</b><span>Липсва export документ</span></div><div><i>↻</i><b>EA-10614</b><span>Транспортът е без update 6ч.</span></div><div><i>✓</i><b>Доклад</b><span>Дневният отчет е готов</span></div></div></div></div>;

  if(id==="scale") return <div className={styles.visual}><div className={styles.scaleBoard}><div><span>START</span><strong>100 коли</strong><small>1 пазар</small></div><i>→</i><div><span>GROWTH</span><strong>10 000 коли</strong><small>няколко пазара</small></div><i>→</i><div><span>INTERNATIONAL</span><strong>100 000+</strong><small>много държави</small></div></div></div>;

  return <div className={styles.visual}><div className={styles.finalVisual}><img src={CAR} alt="ENCHEV автомобил"/><div className={styles.finalShade}/><div className={styles.finalBrand}><strong>ENCHEV</strong><span>ONE CONNECTED AUTOMOTIVE SYSTEM</span></div></div></div>;
}
