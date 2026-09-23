"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./presentation.module.css";

const AUTO_MS = 8500;

const scenes = [
  { id:"vision", kicker:"ENCHEV", title:"От автомобил до международна сделка.", accent:"Всичко в една система.", sub:"Автомобили · Хора · Търгове · Плащания · Документи · Транспорт" },
  { id:"flow", kicker:"КАКВО СТРОИМ", title:"Една компания. Една система.", accent:"Автомобилът влиза веднъж.", sub:"От приемането до приключването на сделката — процесът остава свързан." },
  { id:"vehicle", kicker:"АВТОМОБИЛЪТ", title:"Всеки автомобил има собствен дигитален живот.", accent:"Всичко важно на едно място.", sub:"Състояние · документи · местоположение · история · търг · купувач · транспорт" },
  { id:"auction", kicker:"ТЪРГЪТ", title:"Истинско наддаване. В реално време.", accent:"Официалният резултат идва от системата.", sub:"Кой наддава · кой води · как приключва · кой печели" },
  { id:"control", kicker:"УПРАВЛЕНИЕ", title:"Цялата компания от едно място.", accent:"ENCHEV Control Center", sub:"Автомобили · търгове · хора · сделки · документи · транспорт · поддръжка" },
  { id:"people", kicker:"ХОРАТА", title:"Всеки вижда точно това, което му трябва.", accent:"Купувач · Продавач · Служител · Управление", sub:"Различни роли. Единна система. Ясен контрол." },
  { id:"after-sale", kicker:"СЛЕД ПРОДАЖБАТА", title:"Търгът не е краят.", accent:"Сделката продължава до реалното предаване.", sub:"Плащане → Документи → Подготовка → Транспорт → Доставка" },
  { id:"international", kicker:"МЕЖДУНАРОДНО", title:"Системата не се строи само за една държава.", accent:"Ядрото остава едно.", sub:"Нови пазари · езици · валути · документи · правила · транспортни процеси" },
  { id:"scale", kicker:"РАСТЕЖ", title:"Започваме разумно. Растем без да започваме отначало.", accent:"START → GROWTH → INTERNATIONAL", sub:"Повече автомобили, хора и наддавания — повече ресурс, без смяна на системата." },
  { id:"servers", kicker:"ЗАД СИСТЕМАТА", title:"Технологията работи във фонов режим.", accent:"За клиента всичко остава една система.", sub:"Сървъри · данни · файлове · задачи · известия · наблюдение · резервни копия" },
  { id:"automation", kicker:"AI И АВТОМАТИЗАЦИЯ", title:"Системата не само пази информация.", accent:"Тя помага работата да се движи.", sub:"Следи липси · намира проблеми · подготвя отчети · подпомага служители · автоматизира рутина" },
  { id:"future", kicker:"КОМПАНИЯТА УТРЕ", title:"Хиляди автомобили. Много държави. Една операционна картина.", accent:"ENCHEV като международна автомобилна компания.", sub:"Търгове · транспорт · финанси · поддръжка · маркетинг · управление" },
  { id:"master", kicker:"MASTER PLAN", title:"Първо изграждаме основата. После добавяме мащаба.", accent:"Изградено · Проверено · Тествано · Доказано", sub:"Не добавяме функции хаотично. Всяка важна част минава през ясен процес." },
  { id:"final", kicker:"ENCHEV", title:"От автомобил. До търг. До сделка.", accent:"До международна компания.", sub:"Една система, която расте заедно с бизнеса." },
] as const;

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
        const distance=Math.abs(rect.top - window.innerHeight*0.18);
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

  const go=(index:number)=>{
    setActive(index);
    refs.current[index]?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  return <main id="main-content" className={styles.presentation}>
    <div className={styles.progress} aria-hidden="true"><span style={{width:`${progress}%`}}/></div>

    <div className={styles.floatingControls}>
      <button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?"Пауза":"Пусни"}</button>
      <span>{String(active+1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
    </div>

    <nav className={styles.dots} aria-label="Сцени на презентацията">
      {scenes.map((scene,index)=><button key={scene.id} type="button" className={active===index?styles.dotActive:""} aria-label={`Сцена ${index+1}: ${scene.kicker}`} onClick={()=>go(index)}><span/></button>)}
    </nav>

    {scenes.map((scene,index)=><section
      key={scene.id}
      ref={node=>{refs.current[index]=node;}}
      className={`${styles.scene} ${styles[`scene_${scene.id.replace("-","_")}`]||""}`}
      data-active={active===index?"true":"false"}
    >
      <div className={styles.glow} aria-hidden="true"/>
      <div className={styles.grid} aria-hidden="true"/>

      <div className={styles.copy}>
        <span className={styles.kicker}>{scene.kicker}</span>
        <h1>{scene.title}</h1>
        <h2>{scene.accent}</h2>
        <p>{scene.sub}</p>
      </div>

      <Visual id={scene.id} />

      <div className={styles.sceneFoot}><span>{String(index+1).padStart(2,"0")}</span><i/><b>ENCHEV SYSTEM</b></div>
    </section>)}
  </main>;
}

function Visual({id}:{id:string}){
  if(id==="vision") return <div className={styles.heroVisual}>
    <div className={styles.carStage}><div className={styles.carSilhouette}>ENCHEV</div></div>
    <div className={styles.orbit}><span>КУПУВАЧ</span><span>ТЪРГ</span><span>ПОБЕДИТЕЛ</span><span>ТРАНСПОРТ</span><span>ДОСТАВКА</span></div>
  </div>;

  if(id==="flow") return <div className={styles.flow}>{["ПРИЕМАНЕ","ПРОВЕРКА","ОБЯВА","ТЪРГ","ПРОДАЖБА","ДОКУМЕНТИ","ТРАНСПОРТ","ГОТОВО"].map((x,i)=><div key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b></div>)}</div>;

  if(id==="vehicle") return <div className={styles.vehicleVisual}><div className={styles.vehicleCore}>CAR<br/><small>DIGITAL LIFE</small></div>{["СНИМКИ","VIN","СЪСТОЯНИЕ","ДОКУМЕНТИ","МЕСТОПОЛОЖЕНИЕ","ИСТОРИЯ","ТЪРГ","ТРАНСПОРТ"].map(x=><span key={x}>{x}</span>)}</div>;

  if(id==="auction") return <div className={styles.auctionVisual}><div className={styles.liveBadge}>● LIVE AUCTION</div><div className={styles.priceStack}><span>€18 400</span><span>€18 600</span><span>€18 800</span><strong>€19 200</strong></div><div className={styles.sold}>SOLD</div></div>;

  if(id==="control") return <div className={styles.dashboard}><div className={styles.dashboardTop}><b>ENCHEV CONTROL CENTER</b><span>LIVE</span></div><div className={styles.metric}><small>Автомобили</small><strong>247</strong></div><div className={styles.metric}><small>Активни търгове</small><strong>12</strong></div><div className={styles.metric}><small>Сделки в движение</small><strong>38</strong></div><div className={styles.metric}><small>За внимание</small><strong>3</strong></div><div className={styles.activity}><i/><i/><i/><i/><i/></div></div>;

  if(id==="people") return <div className={styles.peopleVisual}>{["КУПУВАЧ","ПРОДАВАЧ","СЛУЖИТЕЛ","ENCHEV"].map((x,i)=><div key={x}><span>{i===3?"◆":"●"}</span><b>{x}</b></div>)}<i className={styles.peopleLine}/></div>;

  if(id==="after-sale") return <div className={styles.afterSale}>{["ПОБЕДИТЕЛ","ПЛАЩАНЕ","ДОКУМЕНТИ","ПОДГОТОВКА","ТРАНСПОРТ","ДОСТАВКА"].map((x,i)=><div key={x} className={i<4?styles.done:""}><span>{i<4?"✓":i+1}</span><b>{x}</b></div>)}</div>;

  if(id==="international") return <div className={styles.mapVisual}><div className={styles.mapCore}>BG</div>{[["DE","18%","14%"],["GR","69%","68%"],["RO","73%","30%"],["IT","32%","76%"],["UK","10%","50%"]].map(([c,l,t])=><span key={c} style={{left:l,top:t}}>{c}</span>)}</div>;

  if(id==="scale") return <div className={styles.scaleVisual}><div><small>01</small><b>START</b><span>1 core</span></div><div><small>02</small><b>GROWTH</b><span>cluster</span></div><div><small>03</small><b>INTERNATIONAL</b><span>multi-region</span></div></div>;

  if(id==="servers") return <div className={styles.serverVisual}><div className={styles.serverCore}>ENCHEV</div>{["САЙТ","ТЪРГОВЕ","ДАННИ","ФАЙЛОВЕ","ЗАДАЧИ","ИЗВЕСТИЯ","МОНИТОРИНГ","BACKUP"].map(x=><span key={x}>{x}</span>)}</div>;

  if(id==="automation") return <div className={styles.aiVisual}><div className={styles.aiCore}>AI</div>{["ПРОБЛЕМИ","ЗАДАЧИ","ОТЧЕТИ","АНАЛИЗ","ПОМОЩ","АВТОМАТИЗАЦИЯ"].map(x=><span key={x}>{x}</span>)}</div>;

  if(id==="future") return <div className={styles.futureVisual}><div className={styles.futureBrand}>ENCHEV</div><div className={styles.futureRing}/><div className={styles.futureRing2}/>{["CARS","AUCTIONS","PEOPLE","LOGISTICS","FINANCE","MARKETS"].map((x,i)=><span key={x} style={{transform:`rotate(${i*60}deg) translateX(145px) rotate(-${i*60}deg)`}}>{x}</span>)}</div>;

  if(id==="master") return <div className={styles.masterVisual}>{Array.from({length:48},(_,i)=><i key={i} className={i<36?styles.masterDone:""}/>)}</div>;

  return <div className={styles.finalVisual}><strong>ENCHEV</strong><span>ONE SYSTEM</span></div>;
}
