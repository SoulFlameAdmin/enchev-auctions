import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import SeedAuditGaps from "./components/SeedAuditGaps";
import BulgarianStageLabels from "./components/BulgarianStageLabels";
import DesignPlanExtension from "./components/DesignPlanExtension";
import HomeTrustSupport from "./components/HomeTrustSupport";
import HomeHeroV2 from "./components/HomeHeroV2";
import HomeFeaturedLotsV2 from "./components/HomeFeaturedLotsV2";

export default function Home(){
  return <main id="main-content" className="eaHome">
    <MasterSystemPlanV1 />
    <SeedAuditGaps />
    <BulgarianStageLabels />
    <DesignPlanExtension />

    <HomeHeroV2 />

    <HomeFeaturedLotsV2 />

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

    <HomeTrustSupport />

    <section className="eaCta" id="transport"><div><h2>Готов ли си за следващия търг?</h2><p>Отвори целия инвентар и виж кой лот е LIVE в момента.</p></div><div className="eaCtaActions"><a href="/inventory">Отвори инвентара</a><a href="/live-auctions">LIVE търгове</a></div></section>

    <footer className="eaFooter" id="contact"><div><b>ENCHEV AUCTIONS</b><div>International vehicle auction marketplace</div></div><div><a href="/support">Поддръжка</a> · <a href="/profile">Профил</a> · © 2026 ENCHEV · BG / EUR</div></footer>
  </main>
}
