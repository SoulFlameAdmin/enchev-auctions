import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import SeedAuditGaps from "./components/SeedAuditGaps";
import BulgarianStageLabels from "./components/BulgarianStageLabels";
import DesignPlanExtension from "./components/DesignPlanExtension";
import HomeLiveSpotlight from "./components/HomeLiveSpotlight";
import { accountNavigation, primaryNavigation } from "./site-navigation";

const featuredCars = [
  { lot:"EA-10482", title:"2018 BMW M4 F82", spec:"3.0 бензин · Автоматик · 82 410 км", location:"София, България", time:"Търг след 2ч 18м", price:"€12 750", state:"upcoming", stateLabel:"UPCOMING", bidLabel:"Текуща ставка", image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10511", title:"2021 Mercedes-Benz GLC", spec:"2.0 дизел · Автоматик · 64 900 км", location:"Мюнхен, Германия", time:"Купи веднага", price:"€18 400", state:"buy-now", stateLabel:"BUY NOW", bidLabel:"Цена Buy Now", image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10539", title:"2022 Audi RS3 Sportback", spec:"2.5 бензин · Автоматик · 41 280 км", location:"Крю, Великобритания", time:"LIVE · приема оферти", price:"€21 900", state:"live", stateLabel:"LIVE", bidLabel:"Текуща ставка", image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82" },
  { lot:"EA-10603", title:"2026 Volkswagen Golf GTI", spec:"2.0 бензин · DSG · 9 870 км", location:"Лондон, Великобритания", time:"Търгът приключи", price:"€16 250", state:"sold", stateLabel:"SOLD", bidLabel:"Продадено за", image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82" },
];

export default function Home(){
  return <main className="eaHome">
    <MasterSystemPlanV1 />
    <SeedAuditGaps />
    <BulgarianStageLabels />
    <DesignPlanExtension />

    <section className="eaHero" id="top">
      <div className="eaTopbar">
        <div className="eaTopbarLeft"><span className="eaDot"/><strong>LIVE MARKET</strong><span>Европа · САЩ · Канада</span></div>
        <div className="eaTopbarRight"><span>BG · EUR</span><a href="/support">Помощ</a><span>+359 000 000 000</span></div>
      </div>

      <header className="eaMainnav">
        <a href="#top" className="eaBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
        <nav className="eaNavlinks" aria-label="Основна навигация">
          {primaryNavigation.map(item=><a key={item.key} href={item.href}>{item.label}</a>)}
        </nav>
        <div className="eaNavactions">
          <form action={accountNavigation.profile}><button className="eaBtnGhost" type="submit">Вход</button></form>
          <form action={accountNavigation.register}><button className="eaBtnPrimary" type="submit">Регистрация</button></form>
        </div>
      </header>

      <div className="eaHeroInner">
        <div className="eaHeroCopy">
          <div className="eaEyebrow"><i/>АВТОМОБИЛНИ ТЪРГОВЕ БЕЗ ГРАНИЦИ</div>
          <h1><span>НАМЕРИ.</span><span>НАДДАВАЙ.</span><em>СПЕЧЕЛИ.</em></h1>
          <p className="eaHeroLead">Търси автомобили от международни търгове, следи LIVE наддаванията и управлявай целия процес от една ENCHEV платформа.</p>
          <form className="eaSearch" action="/inventory" role="search"><input type="search" name="q" aria-label="Търси по марка, модел, VIN или LOT номер" autoComplete="off" spellCheck={false} enterKeyHint="search" placeholder="Марка, модел, VIN или LOT номер..."/><button type="submit" aria-label="Търси автомобили">→</button></form>
          <nav className="eaHeroQuick" aria-label="Популярни категории"><a href="/inventory?q=BMW">BMW</a><a href="/inventory?q=Mercedes">Mercedes</a><a href="/inventory?q=Audi">Audi</a><a href="/inventory?q=Porsche">Porsche</a><a href="/inventory?q=USA">САЩ</a><a href="/inventory?q=Front%20end">Front end</a></nav>
          <div className="eaHeroStats"><div className="eaHeroStat"><b>10K+</b><span>активни лота</span></div><div className="eaHeroStat"><b>24/7</b><span>наблюдение на търгове</span></div><div className="eaHeroStat"><b>1 платформа</b><span>оферта → транспорт</span></div></div>
        </div>

        <HomeLiveSpotlight />
      </div>

      <div className="eaHeroFoot"><strong>DRIVE A BETTER TOMORROW</strong><span>ENCHEV AUCTIONS · INTERNATIONAL MARKETPLACE</span></div>
    </section>

    <section className="eaSection" id="inventory" aria-labelledby="featured-inventory-heading">
      <div className="eaSectionHead"><div><span>ПОДБРАНИ ЛОТОВЕ</span><h2 id="featured-inventory-heading">Автомобили в търг</h2><p>LIVE, Buy Now, предстоящи и приключили лотове в един изглед.</p></div><a href="/inventory">Виж целия инвентар →</a></div>
      <div className="eaFeaturedGrid">{featuredCars.map(car=><article className={`eaFeaturedCard eaFeaturedCard--${car.state}`} data-auction-state={car.state} aria-label={`${car.title} — ${car.stateLabel}`} key={car.lot}><div className="eaFeaturedImage"><img src={car.image} alt={car.title}/><span className={`eaFeaturedBadge eaFeaturedBadge--${car.state}`}>{car.stateLabel}</span></div><div className="eaFeaturedBody"><div className="eaFeaturedLot"><span>LOT {car.lot}</span><b>● VERIFIED</b></div><h3>{car.title}</h3><p>{car.spec}</p><div className="eaFeaturedInfo"><span>⌖ {car.location}</span><span className="eaFeaturedAuctionState">◷ {car.time}</span></div><div className="eaFeaturedBid"><div><small>{car.bidLabel}</small><strong>{car.price}</strong></div><a href={`/lot/${car.lot}`}>{car.state === "live" ? "Влез в LIVE →" : car.state === "buy-now" ? "Купи сега →" : car.state === "sold" ? "Виж резултата →" : "Виж лота →"}</a></div></div></article>)}</div>
    </section>

    <section className="eaProcess" id="how" aria-labelledby="buyer-journey-heading">
      <div className="eaSection">
        <div className="eaSectionHead"><div><span>КАК РАБОТИ</span><h2 id="buyer-journey-heading">От търсене до доставка</h2><p>Четири ясни стъпки с директен път към следващото действие.</p></div></div>
        <ol className="eaSteps eaJourneySteps" aria-label="Стъпки за покупка през ENCHEV">
          <li className="eaStep eaJourneyStep"><span aria-hidden="true">01</span><small>ТЪРСЕНЕ</small><b>Намери подходящия автомобил</b><p>Търси по марка, модел, VIN или LOT и сравни наличните автомобили в инвентара.</p><a className="eaJourneyLink" href="/inventory">Разгледай инвентара →</a></li>
          <li className="eaStep eaJourneyStep"><span aria-hidden="true">02</span><small>ПРОВЕРКА</small><b>Прегледай лота и състоянието</b><p>Отвори детайлите на избрания автомобил и провери ключовите данни преди участие.</p><a className="eaJourneyLink" href="/inventory">Избери лот →</a></li>
          <li className="eaStep eaJourneyStep"><span aria-hidden="true">03</span><small>ТЪРГ</small><b>Следи и участвай LIVE</b><p>Виж текущия лот, таймера и движението на офертите в търга на живо.</p><a className="eaJourneyLink" href="/live-auctions">Отвори LIVE търговете →</a></li>
          <li className="eaStep eaJourneyStep"><span aria-hidden="true">04</span><small>ДОСТАВКА</small><b>Организирай транспорта</b><p>След приключване на търга премини към транспорт и проследяване до избраната дестинация.</p><a className="eaJourneyLink" href="/transport">Виж транспорта →</a></li>
        </ol>
        <div className="eaJourneyFooter"><span>Нов купувач? Прегледай помощта преди първото си участие.</span><a href="/support">Помощ за купувачи →</a></div>
      </div>
    </section>

    <section className="eaCta" id="transport"><div><h2>Готов ли си за следващия търг?</h2><p>Отвори целия инвентар и виж кой лот е LIVE в момента.</p></div><div className="eaCtaActions"><a href="/inventory">Отвори инвентара</a><a href="/live-auctions">LIVE търгове</a></div></section>

    <footer className="eaFooter" id="contact"><div><b>ENCHEV AUCTIONS</b><div>International vehicle auction marketplace</div></div><div><a href="/support">Поддръжка</a> · <a href="/profile">Профил</a> · © 2026 ENCHEV · BG / EUR</div></footer>
  </main>
}
