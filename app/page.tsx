import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import SeedAuditGaps from "./components/SeedAuditGaps";
import BulgarianStageLabels from "./components/BulgarianStageLabels";
import "./home.css";

const featuredCars = [
  { lot:"EA-10482", title:"2018 BMW M4 F82", spec:"3.0 бензин · Автоматик · 82 410 км", location:"София, България", time:"Търг след 2ч 18м", price:"€12 750", badge:"RUN & DRIVE", image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10511", title:"2021 Mercedes-Benz GLC", spec:"2.0 дизел · Автоматик · 64 900 км", location:"Мюнхен, Германия", time:"Търг утре · 11:30", price:"€18 400", badge:"BUY NOW", image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10539", title:"2022 Audi RS3 Sportback", spec:"2.5 бензин · Автоматик · 41 280 км", location:"Крю, Великобритания", time:"Търг днес · 16:00", price:"€21 900", badge:"HOT LOT", image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10603", title:"2026 Volkswagen Golf GTI", spec:"2.0 бензин · DSG · 9 870 км", location:"Лондон, Великобритания", time:"Търг след 5ч 44м", price:"€16 250", badge:"CLEAN TITLE", image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82" },
];
const chips=["Всички","BMW","Mercedes","Audi","SUV","Buy Now","До €20 000"];

export default function Home(){return <main className="marketPage referenceMarket">
  <MasterSystemPlanV1 />
  <SeedAuditGaps />
  <BulgarianStageLabels />
  <section id="top" className="referenceHero">
    <div className="referenceShade" />
    <header className="referenceHeader">
      <a className="referenceLogo" href="#top"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav><a href="/inventory">АВТОМОБИЛИ</a><a href="#how">КАК РАБОТИ</a><a href="#about">ЗА НАС</a><a href="#contact">КОНТАКТИ</a></nav>
      <button className="referenceLogin">ВХОД <span>♙</span></button>
    </header>
    <div className="referenceHeroCopy">
      <p className="referenceKicker">АВТОМОБИЛНИ ТЪРГОВЕ ОТ САЩ</p>
      <h1><span>ПОВЕЧЕ ОТ</span><em>ТЪРГОВЕ</em></h1>
      <p className="referenceLead">Реални автомобили. Реални възможности.<br/>Спести повече. Карай по-добре.</p>
      <form className="referenceSearch" action="/inventory"><span>⌕</span><input name="q" placeholder="Търси по марка, модел или VIN..."/><button type="submit">›</button></form>
      <div className="referenceBenefits">
        <div><i>▱</i><span>Хиляди<br/>автомобили</span></div>
        <div><i>♢</i><span>Проверена<br/>история</span></div>
        <div><i>⚒</i><span>Реални<br/>търгове</span></div>
      </div>
      <div className="referenceMotto"><b></b><span>DRIVE A BETTER TOMORROW</span></div>
    </div>
    <div className="referenceLive"><span>ТЪРГУВАЙ</span><b>LIVE</b><i>◉</i></div>
    <div className="referenceSlides"><b></b><span></span><span></span></div>
  </section>

  <section id="inventory" className="contentSection"><div className="sectionHeading"><div><span className="sectionEyebrow">ПОДБРАНИ ЛОТОВЕ</span><h2>Автомобили на търг</h2><p>Нови предложения, live оферти и Buy Now автомобили.</p></div><a href="/inventory">Виж целия инвентар →</a></div><div className="filterRow">{chips.map((c,i)=><button key={c} className={`filterChip ${i===0?"active":""}`}>{c}</button>)}</div><div className="carGrid">{featuredCars.map(car=><article key={car.lot} className="auctionCard"><div className="carImageWrap"><img src={car.image} alt={car.title}/><span className="carBadge">{car.badge}</span><button className="watchBtn">♡</button><div className="imageFade"/></div><div className="carBody"><div className="lotLine"><span>LOT {car.lot}</span><span className="verifiedDot">● VERIFIED</span></div><h3>{car.title}</h3><p>{car.spec}</p><div className="carInfo"><span>⌖ {car.location}</span><span>◷ {car.time}</span></div><div className="bidRow"><div><small>Текуща оферта</small><strong>{car.price}</strong></div><button>Наддавай →</button></div></div></article>)}</div><div style={{display:"flex",justifyContent:"center",marginTop:28}}><a href="/inventory" style={{textDecoration:"none",padding:"14px 28px",borderRadius:12,background:"linear-gradient(135deg,#17c861,#27f183)",color:"#061009",fontWeight:900}}>Виж целия инвентар →</a></div></section>
  <section id="how" className="contentSection stepsSection"><div className="sectionHeading"><div><span className="sectionEyebrow">ЛЕСЕН ПРОЦЕС</span><h2>От регистрация до автомобил</h2></div></div><div className="stepsGrid"><div><span>01</span><b>Регистрирай се</b><p>Създай профил и потвърди данните си.</p></div><div><span>02</span><b>Намери автомобил</b><p>Избери подходящия лот.</p></div><div><span>03</span><b>Наддавай</b><p>Участвай в live търга.</p></div><div><span>04</span><b>Получи автомобила</b><p>Плащане, документи и транспорт.</p></div></div></section>
  <footer id="contact" className="siteFooter"><div className="footerBrand"><div><b>ENCHEV AUCTIONS</b><p>Автомобилни търгове без излишна сложност.</p></div></div><small>Enchev Auctions © 2026</small></footer>
</main>}
