"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import s from "./presentation.module.css";

const CAR = "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1600&q=90";
const scenes = [
  ["EAUCTIONS BY ENCHEV", "Една кола.", "Безкрайни възможности.", "От първата снимка до ключовете в ръцете ти.", "Начало"],
  ["01 / ПРИЕМАНЕ", "Всичко започва", "с един автомобил.", "Добавяме автомобила. Създаваме неговото досие.", "Приемане"],
  ["02 / ПРОВЕРКА", "Познаваш колата.", "Преди да наддаваш.", "Снимки, състояние и документи. На едно място.", "Проверка"],
  ["03 / ИЗБОР", "Твоята следваща кола.", "Вече е тук.", "Разглеждаш информацията. Избираш. Следиш търга.", "Обява"],
  ["04 / ТЪРГ НА ЖИВО", "Моментът", "е твой.", "Наддаваш на живо. Следиш цената. Виждаш резултата.", "Търг"],
  ["05 / СДЕЛКА", "Печелиш търга.", "Ние продължаваме.", "Получаваш потвърждение и следващите стъпки за плащане.", "Плащане"],
  ["06 / ДОКУМЕНТИ", "Всичко необходимо.", "Без търсене.", "Документите и техният статус са в твоето досие.", "Документи"],
  ["07 / ДОСТАВКА", "От нашата площадка.", "До твоята врата.", "Следиш етапите на транспорта до предаването.", "Доставка"],
  ["08 / ПЪЛНА ИСТОРИЯ", "Ключовете са твои.", "Историята остава.", "Автомобилът, сделката и документите. Винаги свързани.", "История"],
  ["СЛЕДВАЩО НИВО / AI", "По-малко повторения.", "Повече възможности.", "AI помага с задачи, липсващи документи и важни действия.", "AI"],
  ["СЛЕДВАЩО НИВО / ПАЗАРИ", "Започваме тук.", "Мислим отвъд границите.", "Повече държави, езици и партньори. Една система.", "Пазари"],
  ["ENCHEV / CONTROL CENTER", "Целият път.", "В една система.", "Автомобили. Търгове. Сделки. Доставки. EAuctions by SOULFLAME.", "ENCHEV"],
] as const;

const voiceTracks = [
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=d5257023-b925-428f-9b1b-54e144b74234.wav", duration: 7184 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=c2af2297-39d7-4af5-93fa-6074d70c1c69.wav", duration: 7811 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=63e64a33-b08a-4299-98c7-f9991a22d5f1.wav", duration: 9326 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=93ce7694-2131-4a67-9e1a-e0acf82fcbbf.wav", duration: 7523 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=25ceacd9-fb76-49ce-8637-629f00701072.wav", duration: 8385 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=16898b0a-a073-44bd-b83e-c1241b1348f9.wav", duration: 8568 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=5db025e8-d0a4-489a-8358-532d5007751d.wav", duration: 8255 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=14079266-6ab5-45ba-90d2-193cc39774d8.wav", duration: 7445 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=d081d17c-197e-49e2-919f-c55ed7318a58.wav", duration: 8411 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=b4548aea-aed5-4cfe-8f4b-8845abf43d63.wav", duration: 8908 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/1803df59c37443789d2e4f71c82859a0/id=b7e79d66-7657-401b-bb84-534ddd2a8a89.wav", duration: 8255 },
  { src: "https://resource2.heygen.ai/text_to_speech/8875c20ec9c441a5995920ac3b6de8a5/fe5b9effb624445ba3913007dd68c77f/id=5af5f6c8-65ef-4a37-b3c6-02bead95443c.wav", duration: 8333 },
] as const;

const prices = ["18 400", "18 600", "18 800", "19 200"];

export default function PresentationExperience() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voice, setVoice] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scene = scenes[active];
  const sceneDuration = voiceTracks[active].duration;
  const bid = Math.min(3, Math.floor(elapsed / Math.max(sceneDuration / 4, 1)));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    sync();
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", sync); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = voiceTracks[active].src;
    audio.currentTime = 0;
    audio.volume = 1;

    const onTime = () => setElapsed(Math.min(sceneDuration, audio.currentTime * 1000));
    const onEnded = () => {
      setElapsed(sceneDuration);
      if (active === scenes.length - 1) {
        setPlaying(false);
        return;
      }
      setActive(value => value + 1);
      setElapsed(0);
    };
    const onError = () => setVoice(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (voice && playing && visible) {
      audio.play().catch(() => setPlaying(false));
    }

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [active, voice, playing, visible, sceneDuration]);

  useEffect(() => {
    if (!playing || !visible || voice) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - last, 250);
      last = now;
      setElapsed(value => Math.min(sceneDuration, value + delta));
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, visible, voice, sceneDuration]);

  useEffect(() => {
    if (voice || elapsed < sceneDuration) return;
    if (active === scenes.length - 1) {
      setPlaying(false);
      return;
    }
    setActive(value => value + 1);
    setElapsed(0);
  }, [elapsed, active, voice, sceneDuration]);

  const go = (index: number) => {
    const next = Math.max(0, Math.min(scenes.length - 1, index));
    audioRef.current?.pause();
    setActive(next);
    setElapsed(0);
  };

  const toggle = () => {
    if (active === scenes.length - 1 && elapsed >= sceneDuration) go(0);
    setPlaying(value => !value);
  };

  const toggleVoice = () => {
    audioRef.current?.pause();
    setElapsed(0);
    setVoice(value => !value);
  };

  return <main id="main-content" ref={root} className={s.presentation} data-playing={playing && visible} data-reduced={reduced}
    onKeyDown={event => { if ((event.target as HTMLElement).closest("button,a,input")) return; if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1); } if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1); } }} tabIndex={-1}>
    <audio ref={audioRef} preload="auto" aria-hidden="true" />
    <header className={s.topbar}><a href="/" className={s.brand}><b>E<span>Auctions</span></b><small>BY ENCHEV</small></a><span className={s.edition}>ЕДИН АВТОМОБИЛ. ЦЕЛИЯТ ПЪТ.</span><a className={s.exit} href="/">Към сайта ↗</a></header>
    <section className={s.stage} aria-label="Анимирана продуктова презентация">
      <div className={s.ambient}/><div className={s.grain}/>
      <div key={`copy-${active}`} className={s.copy}>
        <div className={s.eyebrow}><i/>{scene[0]}</div>
        <h1>{scene[1]}<span>{scene[2]}</span></h1><p>{scene[3]}</p>
        {active === 0 && <button className={s.primary} onClick={() => { setElapsed(0); setPlaying(true); }}>Пусни презентацията <span>▶</span></button>}
        {active === 11 && <a className={s.primary} href="/inventory">Разгледай автомобилите <span>↗</span></a>}
        <div className={s.chapter}><span>{String(active + 1).padStart(2,"0")}</span><i/><small>{scene[4]}</small></div>
      </div>
      <div key={`visual-${active}`} className={`${s.visual} ${active === 0 ? s.hero : ""}`}>
        {active <= 8 && <div className={s.carFrame} data-scene={active}>
          <Image unoptimized src={CAR} alt="Автомобилът в демонстрационната история на EAuctions" fill sizes="(max-width: 760px) 100vw, 65vw" priority className={s.car}/>
          <div className={s.carShade}/><span className={s.lot}>EA–10539 <i/> DEMO</span>
          {active === 0 && <div className={s.orbit}><span>01 / Избираш</span><span>02 / Наддаваш</span><span>03 / Получаваш</span></div>}
          {active === 1 && <div className={s.glass}><small>ДИГИТАЛНО ДОСИЕ</small><h2>EA–10539 <em>✓</em></h2><Row label="Автомобил" value="Регистриран"/><Row label="Местоположение" value="Площадка ENCHEV"/><Row label="Следва" value="Проверка →"/></div>}
          {active === 2 && <><div className={s.scan}/><div className={s.glass}><small>ПРЕДИ ТЪРГА</small>{["Идентификация / VIN", "Състояние и пробег", "Снимки и документи"].map((v,i)=><div className={s.check} key={v} style={{animationDelay:`${i*.5}s`}}><i>✓</i>{v}</div>)}</div></>}
          {active === 3 && <div className={s.glass}><small>ОТКРИЙ СЛЕДВАЩАТА СИ КОЛА</small><h2>Един поглед.<br/>Пълната картина.</h2><div className={s.tags}><span>Снимки</span><span>История</span><span>Условия</span></div><Row label="Начална цена" value="€18 400"/><span className={s.demoAction}>Следиш търга ♡</span></div>}
          {active === 4 && <div className={`${s.glass} ${s.auction}`}><div className={s.live}><i/>{bid === 3 ? "ПРОДАДЕН" : "НАДДАВАНЕ НА ЖИВО"}<span>DEMO</span></div><small>{bid === 3 ? "КРАЙНА ЦЕНА" : "ТЕКУЩА ОФЕРТА"}</small><strong key={bid} className={s.price}>€{prices[bid]}</strong><div className={s.bids}>{prices.slice(0,bid+1).map((p,i)=><div key={p}><span>Купувач #{2840+i}</span><b>€{p}</b></div>)}</div><span className={s.demoAction}>{bid === 3 ? "✓ Победителят е потвърден" : "↑ Нова оферта"}</span></div>}
          {active === 5 && <div className={s.glass}><div className={s.seal}>✓</div><small>ЧЕСТИТО. ТЪРГЪТ Е ТВОЙ.</small><h2>Продаден.<br/><em>€19 200</em></h2><Row label="Победител" value="#2843"/><Row label="Следваща стъпка" value="Плащане →"/></div>}
          {active === 6 && <div className={s.glass}><small>ТВОИТЕ ДОКУМЕНТИ</small><h2>Подредени.<br/>Свързани.</h2>{["Потвърждение за покупка", "Фактура", "Транспортни документи"].map((v,i)=><div className={s.document} key={v} style={{animationDelay:`${i*.4}s`}}><span>▤</span><b>{v}</b><em>{i<2 ? "Готов" : "Подготовка"}</em></div>)}</div>}
          {active === 7 && <div className={`${s.glass} ${s.transport}`}><small>СЛЕДВАЩА СПИРКА: ТВОЯТ АДРЕС</small><h2>В движение.</h2><div className={s.route}><span>Площадка</span><i/><b>→</b><span>Купувач</span></div><div className={s.check}><i>✓</i>Подготвен за транспорт</div><div className={s.check}><i>↗</i>Пътува към теб</div><small>Илюстрация на етапите · не е GPS карта</small></div>}
          {active === 8 && <div className={s.glass}><small>ДОСТАВЕН / EA–10539</small><h2>Една кола.<br/><em>Цялата история.</em></h2><div className={s.history}>{["Приет", "Проверен", "Продаден", "Платен", "Доставен"].map(v=><div key={v}><i>✓</i><span>{v}</span></div>)}</div></div>}
        </div>}
        {active === 9 && <div className={s.ai}><div className={s.aiCore}>E<span>AI ASSIST</span></div><div className={s.aiCards}>{[["01","Липсва документ","Напомняне до екипа"],["02","Предстои доставка","Следваща задача"],["03","Дневен отчет","Информация за управителя"]].map(([n,t,d])=><div key={n}><small>{n} / АВТОМАТИЗАЦИЯ</small><h3>{t}</h3><p>{d}</p></div>)}</div><span className={s.protected}>✓ Резултатът от търга се определя от основната система</span></div>}
        {active === 10 && <div className={s.world}><div className={s.worldRing}/><div className={s.worldRing}/><div className={s.worldRing}/><strong>ENCHEV<small>ЕДНО ЯДРО. НОВИ ПАЗАРИ.</small></strong>{["България", "Германия", "Гърция", "Румъния", "Италия"].map((v,i)=><span key={v} className={s.market} style={{animationDelay:`${i*.3}s`}}>{v}<i/></span>)}</div>}
        {active === 11 && <div className={s.dashboard}><div className={s.dashboardHead}><b>ENCHEV <span>/ CONTROL CENTER</span></b><small>ПРИМЕРНИ ДАННИ</small></div><div className={s.metrics}>{[["247","Автомобили"],["12","Търгове"],["22","Доставки"]].map(([n,l])=><div key={l}><small>{l}</small><strong>{n}</strong><span>Всичко пред теб ↗</span></div>)}</div><div className={s.chart}>{[30,45,38,55,48,70,62,78,73,89,85,100].map((h,i)=><i key={i} style={{height:`${h}%`,animationDelay:`${i*.06}s`}}/>)}</div><Row label="EA–10539" value="✓ Доставен"/><Row label="EA–10614" value="↗ В транспорт"/><Row label="EA–10633" value="▤ Документи"/><div className={s.dashboardFoot}>EAuctions by SOULFLAME.</div></div>}
      </div>
      <span className={s.watermark}>EA</span>
    </section>
    <footer className={s.player}><div className={s.playerTop}><div className={s.controls}><button onClick={() => go(active-1)} disabled={active===0} aria-label="Предишна сцена">←</button><button className={s.play} onClick={toggle} aria-label={playing ? "Пауза" : "Пусни презентацията"}>{playing ? "Ⅱ" : "▶"}</button><button onClick={() => go(active+1)} disabled={active===scenes.length-1} aria-label="Следваща сцена">→</button><span>{String(active+1).padStart(2,"0")} <em>/ {scenes.length}</em></span></div><button className={s.voice} onClick={toggleVoice} aria-pressed={voice} title="Професионален женски и мъжки рекламен глас">{voice ? "◉ Студио глас" : "◎ Включи студио глас"}</button><small className={s.disclaimer}>Продуктова визия · студио voice · демонстрационни данни</small></div><nav className={s.timeline} aria-label="Сцени">{scenes.map((v,i)=><button key={v[4]} onClick={()=>go(i)} aria-label={`Сцена ${i+1}: ${v[4]}`} aria-current={active===i ? "step" : undefined}><span><i style={{width:`${i<active ? 100 : i===active ? elapsed/sceneDuration*100 : 0}%`}}/></span><small>{v[4]}</small></button>)}</nav></footer>
  </main>;
}

function Row({label,value}:{label:string;value:string}) { return <div className={s.row}><span>{label}</span><b>{value}</b></div>; }
