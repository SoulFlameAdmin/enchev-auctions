"use client";

type Person={role:string;ready:boolean};
type Lobby={count:number;readyCount:number;minPlayers:number;participants:Person[];activeDevices?:number;admitted?:boolean};
type Props={
  status:"idle"|"countdown"|"live"|"closed"|"canceled";
  lobby:Lobby|null;countdownRemaining:number;connected:boolean;busy:boolean;
  participant:boolean;myReady:boolean;corePresent:boolean;minPlayers:number;
  canReady:boolean;onReady:(ready:boolean)=>void;
};
const nameOf=(r:string)=>r==="mitko"?"Митко":r==="borko"?"Борко":r==="enchev"?"Енчев":r==="admin"?"Администратор":r;
const clock=(t:number)=>String(Math.max(0,Math.floor(t/60))).padStart(2,"0")+":"+String(Math.max(0,t%60)).padStart(2,"0");
const folds=[
  ["M177 199C185 238 170 258 169 309","url(#coverDeep)",7],
  ["M227 169C233 239 212 269 210 315","url(#coverLight)",9],
  ["M277 149C289 224 254 281 258 323","url(#coverDeep)",8],
  ["M329 141C342 196 317 269 311 323","url(#coverLight)",11],
  ["M387 145C369 222 390 269 383 323","url(#coverDeep)",8],
  ["M441 167C431 221 460 284 448 315","url(#coverLight)",9],
  ["M498 201C492 254 510 288 507 305","url(#coverDeep)",7],
] as const;

function CoveredCar(){
  return <div className="eaLxDisplay" aria-label="Кинематографична 3D анимация на концептуален автомобил под червен покривен плат">
    <div className="eaLxGroundGlow"/>
    <div className="eaLxStage"><div className="eaLxStageInner"/></div>
    <div className="eaLxCarMotion">
      <svg className="eaLxCoveredSvg" viewBox="0 0 680 390" role="img" aria-label="Покрит с червен плат концептуален автомобил, който плавно се завърта на подиум">
        <defs>
          <linearGradient id="coverBody" x1="0" y1="0" x2="1" y2=".3"><stop stopColor="#3c0208"/><stop offset=".11" stopColor="#d91b32"/><stop offset=".22" stopColor="#4b0010"/><stop offset=".35" stopColor="#fa4152"/><stop offset=".48" stopColor="#700313"/><stop offset=".62" stopColor="#f30c2c"/><stop offset=".76" stopColor="#7e0419"/><stop offset=".9" stopColor="#ca091d"/><stop offset="1" stopColor="#220007"/></linearGradient>
          <linearGradient id="coverDeep" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff5768"/><stop offset=".24" stopColor="#5d0011"/><stop offset=".59" stopColor="#ba081d"/><stop offset="1" stopColor="#160006"/></linearGradient>
          <linearGradient id="coverLight" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff8a92"/><stop offset=".24" stopColor="#9d0a1f"/><stop offset=".48" stopColor="#fb3149"/><stop offset=".9" stopColor="#32000b"/></linearGradient>
          <linearGradient id="coverFloor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fa4a58" stopOpacity=".65"/><stop offset=".5" stopColor="#ec1024" stopOpacity=".65"/><stop offset="1" stopColor="#380008" stopOpacity=".3"/></linearGradient>
          <radialGradient id="coverBloom"><stop stopColor="#ff1248" stopOpacity=".6"/><stop offset="1" stopColor="#cc0a21" stopOpacity="0"/></radialGradient>
          <clipPath id="coverSilhouette"><path d="M81 245Q112 208 160 202Q197 193 247 146Q285 120 341 123Q398 122 439 153Q484 178 529 202Q592 212 616 251L625 308Q602 322 579 311Q539 326 503 315Q446 336 407 320Q360 339 314 322Q262 340 218 320Q181 329 157 316Q106 331 80 307Z"/></clipPath>
        </defs>
        <ellipse cx="344" cy="310" rx="274" ry="67" fill="url(#coverBloom)" opacity=".85"/>
        <ellipse cx="346" cy="324" rx="270" ry="31" fill="#000" opacity=".7"/>
        <path d="M81 245Q112 208 160 202Q197 193 247 146Q285 120 341 123Q398 122 439 153Q484 178 529 202Q592 212 616 251L625 308Q602 322 579 311Q539 326 503 315Q446 336 407 320Q360 339 314 322Q262 340 218 320Q181 329 157 316Q106 331 80 307Z" fill="url(#coverBody)" stroke="#fd6171" strokeWidth="2.5"/>
        <g clipPath="url(#coverSilhouette)">
          <path d="M70 215Q337 177 637 221L631 354H80Z" fill="url(#coverFloor)" opacity=".45"/>
          {folds.map(([d,fill,w],i)=><path key={i} d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" opacity=".9"/>)}
          <path d="M85 255C158 199 206 199 253 155Q331 109 435 156Q504 198 607 245" fill="none" stroke="#ff8f94" strokeOpacity=".8" strokeWidth="7"/>
          <path d="M81 284Q188 294 262 301Q391 311 491 291Q565 279 620 293" fill="none" stroke="#260008" strokeOpacity=".8" strokeWidth="9"/>
          <path d="M173 213Q167 273 159 322M235 171Q243 257 228 323M320 135Q320 225 306 326M392 140Q389 243 394 326M463 180Q479 266 474 323M548 213Q562 268 578 309" fill="none" stroke="#ffb3aa" strokeOpacity=".18" strokeWidth="5"/>
        </g>
        <path d="M85 309Q100 331 128 317Q157 335 185 315Q225 334 249 316Q278 341 308 323Q348 337 375 326Q410 340 447 321Q485 334 512 317Q540 334 565 314Q600 324 622 307" fill="none" stroke="#fc1729" strokeOpacity=".5" strokeWidth="3"/>
        <ellipse cx="345" cy="317" rx="265" ry="17" fill="#260008" opacity=".48"/>
      </svg>
    </div>
    <div className="eaLxTurntableLabel">360° SHOWROOM PREVIEW <span>·</span> КОНЦЕПТУАЛНА ВИЗУАЛИЗАЦИЯ</div>
  </div>;
}

export default function CinematicLobby(p:Props){
  const count=p.lobby?.count??0,ready=p.lobby?.readyCount??0;
  const countdown=p.status==="countdown";
  const started=p.status==="live";
  const active=!countdown&&!started;
  return <section className={`eaReadyCard eaLuxuryLobby ${countdown?"is-counting":""}`} aria-label="Participant readiness">
    <div className="eaLxHero">
      <div className="eaLxRoof"><i/><i/><i/></div>
      <div className="eaLxWorldMap" aria-hidden="true">✦ <span>Ｅ ＆ Ａ</span> ✦</div>
      <div className="eaLxBrandWall"><img src="/brand/ea-official-dark.svg" alt="E&A East and West Auctioneers Group"/><small>МЕЖДУНАРОДНИ АВТОМОБИЛНИ ТЪРГОВЕ</small></div>
      <div className="eaLxStageArea">
        <CoveredCar/>
        <div className="eaLxLightBeams" aria-hidden="true"/>
      </div>
      <aside className="eaLxCountdown" aria-live="polite">
        <div className="eaLxTimerEyebrow">◷ <b>ЛОБИ</b></div>
        <span className="eaLxTimerCaption">{countdown?"ТЪРГЪТ ЗАПОЧВА СЛЕД":started?"ТЪРГЪТ ВЕЧЕ Е В ХОД":"ИЗЧАКВАНЕ НА УЧАСТНИЦИТЕ"}</span>
        <strong className="eaLxDigits">{countdown?clock(p.countdownRemaining):"--:--"}</strong>
        <span className="eaLxServerNote">{countdown?"СЪРВЪРНО ОТБРОЯВАНЕ":started?"НА ЖИВО":"ОТБРОЯВАНЕТО СТАРТИРА ПРИ ГОТОВНОСТ"}</span>
        <div className="eaLxReadyStats"><span>УЧАСТНИЦИ <b>{count}/{p.minPlayers}</b></span><span>ГОТОВИ <b>{ready}/{p.minPlayers}</b></span></div>
        <div className="eaLxConnection" role="status"><i className={p.connected?"online":""}/>{p.connected?"СВЪРЗАНО СЪС СЪРВЪРА":"ИЗЧАКВАМЕ ВРЪЗКА"}</div>
      </aside>
      <div className="eaLxHeroCaption"><span>БЪЛГАРИЯ</span><i/> <span>ИСПАНИЯ</span><i/><span>ЕВРОПА</span></div>
    </div>
    <div className="eaLxControlDeck">
      <div className="eaLxWelcome">
        <span className="eaLxSmall">E&A EAST AND WEST · PRIVATE DEMO LOBBY</span>
        <h2>{countdown?"Всички са готови. Търгът започва.":started?"Търгът е започнал.":p.myReady?"Вие сте готови за старта.":"ЛОБИ НА ТЪРГА"}</h2>
        <p>{countdown?"Стартът се контролира от сървъра. Офертите ще се отключат автоматично.":started?"Изчакайте текущия кръг да приключи, преди следващата готовност.":!p.corePresent||count<p.minPlayers?"Митко, Борко и Енчев влизат със своите покани, задават ДЕМО бюджет и натискат ГОТОВ СЪМ.":"Когато всички трима са готови, започва реалното сървърно отброяване."}</p>
      </div>
      <div className="eaLxRoster" aria-label="Участници в лобито">{["mitko","borko","enchev"].map(r=>{const person=p.lobby?.participants.find(x=>x.role===r);return <span key={r} className={person?.ready?"ready":""}><i>{person?.ready?"✓":"○"}</i>{nameOf(r)} <small>{person?.ready?"ГОТОВ":person?"В ЗАЛАТА":"ЧАКАМЕ"}</small></span>;})}</div>
      <div className="eaLxReadyAction">
        {p.participant&&!countdown&&!started?<button type="button" disabled={!p.canReady||p.busy} onClick={()=>p.onReady(!p.myReady)} className={p.myReady?"is-ready":""}>{p.busy?"СИНХРОНИЗАЦИЯ…":p.myReady?"✓ ГОТОВ СЪМ":"ГОТОВ СЪМ →"}</button>:<div className="eaLxLocked">{countdown?"◷ ИЗЧАКВАНЕ НА СТАРТА":started?"● ТЪРГЪТ Е АКТИВЕН":"◉ РЕЖИМ НА НАБЛЮДЕНИЕ"}</div>}
        {p.participant&&!p.myReady&&active&&!p.canReady&&<small>За READY е нужен активен сървър и ДЕМО бюджет минимум 16 300 €.</small>}
        <small>Само ДЕМО · без реални плащания</small>
      </div>
    </div>
  </section>;
}
