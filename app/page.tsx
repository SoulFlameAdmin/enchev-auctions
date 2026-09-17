import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import SeedAuditGaps from "./components/SeedAuditGaps";
import BulgarianStageLabels from "./components/BulgarianStageLabels";

const featuredCars = [
  { lot:"EA-10482", title:"2018 BMW M4 F82", spec:"3.0 бензин · Автоматик · 82 410 км", location:"София, България", time:"Търг след 2ч 18м", price:"€12 750", badge:"RUN & DRIVE", image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10511", title:"2021 Mercedes-Benz GLC", spec:"2.0 дизел · Автоматик · 64 900 км", location:"Мюнхен, Германия", time:"Търг утре · 11:30", price:"€18 400", badge:"BUY NOW", image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10539", title:"2022 Audi RS3 Sportback", spec:"2.5 бензин · Автоматик · 41 280 км", location:"Крю, Великобритания", time:"LIVE · 00:10", price:"€21 900", badge:"LIVE NOW", image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10603", title:"2026 Volkswagen Golf GTI", spec:"2.0 бензин · DSG · 9 870 км", location:"Лондон, Великобритания", time:"Търг след 5ч 44м", price:"€16 250", badge:"CLEAN TITLE", image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82" },
];

export default function Home(){
  return <main className="eaHome">
    <MasterSystemPlanV1 />
    <SeedAuditGaps />
    <BulgarianStageLabels />

    <section className="eaHero" id="top">
      <div className="eaTopbar">
        <div className="eaTopbarLeft"><span className="eaDot"/><strong>LIVE MARKET</strong><span>Европа · САЩ · Канада</span></div>
        <div className="eaTopbarRight"><span>BG · EUR</span><span>Помощ</span><span>+359 000 000 000</span></div>
      </div>

      <header className="eaMainnav">
        <a href="#top" className="eaBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
        <nav className="eaNavlinks">
          <a href="/inventory">АВТОМОБИЛИ</a>
          <a href="/inventory">ТЪРГОВЕ НА ЖИВО</a>
          <a href="#how">КАК ДА КУПЯ</a>
          <a href="#transport">ТРАНСПОРТ</a>
          <a href="#contact">ПОДДРЪЖКА</a>
        </nav>
        <div className="eaNavactions"><button className="eaBtnGhost">Вход</button><button className="eaBtnPrimary">Регистрация</button></div>
      </header>

      <div className="eaHeroInner">
        <div className="eaHeroCopy">
          <div className="eaEyebrow"><i/>АВТОМОБИЛНИ ТЪРГОВЕ БЕЗ ГРАНИЦИ</div>
          <h1><span>НАМЕРИ.</span><span>НАДДАВАЙ.</span><em>СПЕЧЕЛИ.</em></h1>
          <p className="eaHeroLead">Търси автомобили от международни търгове, следи LIVE наддаванията и управлявай целия процес от една ENCHEV платформа.</p>
          <form className="eaSearch" action="/inventory"><input name="q" placeholder="Марка, модел, VIN или LOT номер..."/><button type="submit">→</button></form>
          <div className="eaHeroQuick"><a href="/inventory">BMW</a><a href="/inventory">Mercedes</a><a href="/inventory">Audi</a><a href="/inventory">SUV</a><a href="/inventory">Buy Now</a><a href="/inventory">До €20 000</a></div>
          <div className="eaHeroStats"><div className="eaHeroStat"><b>10K+</b><span>активни лота</span></div><div className="eaHeroStat"><b>24/7</b><span>наблюдение на търгове</span></div><div className="eaHeroStat"><b>1 платформа</b><span>оферта → транспорт</span></div></div>
        </div>

        <aside className="eaLiveCard">
          <div className="eaLiveTop"><span className="eaLivePill"><i/>ПРОДАВА СЕ НА ЖИВО</span><small>LOT EA-10539</small></div>
          <div className="eaLiveImage"><img src="https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=86" alt="2022 Audi RS3 Sportback"/><div className="eaLiveOrb"><b>NEW<br/>BID</b><small>00:10</small></div></div>
          <div className="eaLiveBody"><div className="eaLiveMeta"><span>LOT EA-10539</span><span>● VERIFIED</span></div><h3>2022 Audi RS3 Sportback</h3><p>41 280 км · Minor scratches · Crewe, UK</p><div className="eaLiveBid"><div><small>Текуща ставка</small><strong>€21 900</strong></div><a href="/inventory">Влез в търга →</a></div></div>
        </aside>
      </div>

      <div className="eaHeroFoot"><strong>DRIVE A BETTER TOMORROW</strong><span>ENCHEV AUCTIONS · INTERNATIONAL MARKETPLACE</span></div>
    </section>

    <section className="eaSection" id="inventory">
      <div className="eaSectionHead"><div><span>ПОДБРАНИ ЛОТОВЕ</span><h2>Автомобили в търг</h2><p>LIVE, Buy Now и предстоящи лотове в един изглед.</p></div><a href="/inventory">Виж целия инвентар →</a></div>
      <div className="eaFeaturedGrid">{featuredCars.map(car=><article className="eaFeaturedCard" key={car.lot}><div className="eaFeaturedImage"><img src={car.image} alt={car.title}/><span className="eaFeaturedBadge">{car.badge}</span></div><div className="eaFeaturedBody"><div className="eaFeaturedLot"><span>LOT {car.lot}</span><b>● VERIFIED</b></div><h3>{car.title}</h3><p>{car.spec}</p><div className="eaFeaturedInfo"><span>⌖ {car.location}</span><span>◷ {car.time}</span></div><div className="eaFeaturedBid"><div><small>Текуща ставка</small><strong>{car.price}</strong></div><a href="/inventory">Оферирай →</a></div></div></article>)}</div>
    </section>

    <section className="eaProcess" id="how">
      <div className="eaSection"><div className="eaSectionHead"><div><span>КАК РАБОТИ</span><h2>От търсене до доставка</h2><p>Прост процес, ясни стъпки, пълна видимост.</p></div></div><div className="eaSteps"><div className="eaStep"><span>01</span><b>Намери автомобил</b><p>Филтрирай по марка, година, локация, цена и състояние.</p></div><div className="eaStep"><span>02</span><b>Влез в търга</b><p>Следи LIVE таймера, текущата оферта и следващия лот.</p></div><div className="eaStep"><span>03</span><b>Спечели лота</b><p>Потвърди покупката, документите и плащането.</p></div><div className="eaStep"><span>04</span><b>Организирай транспорт</b><p>Проследяване на доставката до избраната дестинация.</p></div></div></div>
    </section>

    <section className="eaCta" id="transport"><div><h2>Готов ли си за следващия търг?</h2><p>Отвори целия инвентар и виж кой лот е LIVE в момента.</p></div><div className="eaCtaActions"><a href="/inventory">Отвори инвентара</a><a href="/inventory">LIVE търгове</a></div></section>

    <footer className="eaFooter" id="contact"><div><b>ENCHEV AUCTIONS</b><div>International vehicle auction marketplace</div></div><div>© 2026 ENCHEV · BG / EUR</div></footer>
  </main>
}
