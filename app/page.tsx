import SystemTrackerClean from "./components/SystemTrackerClean";
import "./home.css";

const featuredCars = [
  {
    lot: "EA-10482",
    title: "2018 BMW M4 F82",
    spec: "3.0 бензин · Автоматик · 82 410 км",
    location: "София, България",
    time: "Търг след 2ч 18м",
    price: "€12 750",
    badge: "RUN & DRIVE",
    image: "https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot: "EA-10511",
    title: "2021 Mercedes-Benz GLC",
    spec: "2.0 дизел · Автоматик · 64 900 км",
    location: "Мюнхен, Германия",
    time: "Търг утре · 11:30",
    price: "€18 400",
    badge: "BUY NOW",
    image: "https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot: "EA-10539",
    title: "2022 Audi RS3 Sportback",
    spec: "2.5 бензин · Автоматик · 41 280 км",
    location: "Крю, Великобритания",
    time: "Търг днес · 16:00",
    price: "€21 900",
    badge: "HOT LOT",
    image: "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82",
  },
  {
    lot: "EA-10603",
    title: "2026 Volkswagen Golf GTI",
    spec: "2.0 бензин · DSG · 9 870 км",
    location: "Лондон, Великобритания",
    time: "Търг след 5ч 44м",
    price: "€16 250",
    badge: "CLEAN TITLE",
    image: "https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82",
  },
];

const chips = ["Всички", "BMW", "Mercedes", "Audi", "SUV", "Buy Now", "До €20 000"];

export default function Home() {
  return (
    <main className="marketPage">
      <SystemTrackerClean />

      <div className="demoBar">
        <span className="livePulse" />
        <b>ENCHEV AUCTIONS</b>
        <span className="demoLabel">PREMIUM DEMO</span>
        <span className="demoNote">Примерните автомобили и цени са само за визуализация</span>
      </div>

      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Enchev Auctions начало">
          <span className="brandMark">E</span>
          <span className="brandText"><b>ENCHEV</b><small>AUCTIONS</small></span>
        </a>

        <nav className="mainNav" aria-label="Основна навигация">
          <a href="#inventory">Автомобили</a>
          <a href="#live">Търгове</a>
          <a href="#how">Как работи</a>
          <a href="#shipping">Транспорт</a>
        </nav>

        <div className="headerActions">
          <button className="ghostBtn">BG · EUR</button>
          <button className="ghostBtn">Вход</button>
          <button className="primaryBtn">Регистрация</button>
        </div>
      </header>

      <section id="top" className="heroAuction">
        <img
          className="heroAuctionImage"
          src="https://images.unsplash.com/photo-1770068511812-f61fae05c0f7?auto=format&fit=crop&w=2200&q=86"
          alt="Автомобили в автомобилен двор"
        />
        <div className="heroAuctionShade" />
        <div className="heroGlow heroGlowOne" />
        <div className="heroGlow heroGlowTwo" />

        <div className="heroAuctionContent heroSplit">
          <div className="heroPanel">
            <div className="heroKicker"><span /> ЕВРОПЕЙСКА ПЛАТФОРМА ЗА АВТОМОБИЛНИ ТЪРГОВЕ</div>
            <h1>Купувай по-умно.<br/><em>Наддавай уверено.</em></h1>
            <p className="heroLead">Употребявани, ремонтируеми и премиум автомобили на едно място. Бързо търсене, live търгове и прозрачен процес.</p>

            <div className="heroSearch">
              <label className="wideField">
                <span>Търси автомобил</span>
                <input placeholder="Марка, модел, VIN или Lot №" />
              </label>
              <label>
                <span>Марка</span>
                <select defaultValue="">
                  <option value="">Всички марки</option>
                  <option>BMW</option><option>Mercedes-Benz</option><option>Audi</option><option>Volkswagen</option>
                </select>
              </label>
              <label>
                <span>Година</span>
                <select defaultValue="">
                  <option value="">Всички</option><option>2026</option><option>2025</option><option>2024</option><option>2023</option><option>2022</option>
                </select>
              </label>
              <button className="searchBtn">Търси <span>→</span></button>
            </div>

            <div className="trustRow">
              <div className="trustItem"><b>✓</b> Проверени лотове</div>
              <div className="trustItem"><b>↗</b> Live наддаване</div>
              <div className="trustItem"><b>◆</b> Транспорт и документи</div>
            </div>

            <div className="heroStats">
              <div><b>2 480+</b><span>активни автомобила</span></div>
              <div><b>38</b><span>търга тази седмица</span></div>
              <div><b>12</b><span>европейски държави</span></div>
              <div><b>24/7</b><span>онлайн достъп</span></div>
            </div>
          </div>

          <aside className="heroVisualCard">
            <span className="floatingBadge"><i /> SPOTLIGHT LOT</span>
            <div className="spotImageWrap">
              <img
                src="https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82"
                alt="Audi RS3 Sportback"
              />
              <span className="spotCount">01 / 04</span>
            </div>
            <div className="heroLotMeta">
              <div className="lotLine"><span>LOT EA-10539</span><span className="verifiedDot">● VERIFIED</span></div>
              <h3>2022 Audi RS3 Sportback</h3>
              <p>2.5 бензин · Автоматик · 41 280 км</p>
              <div className="miniMeta"><span>⌖ Крю, Великобритания</span><span>◷ Днес · 16:00</span></div>
              <div className="spotBidRow">
                <div><small>Текуща оферта</small><strong>€21 900</strong></div>
                <button>Наддавай →</button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="valueStrip" aria-label="Предимства">
        <div className="infoCard"><span>01</span><div><b>Бързо търсене</b><p>Марка, модел, VIN, лот номер, местоположение и статус.</p></div></div>
        <div className="infoCard"><span>02</span><div><b>Прозрачни оферти</b><p>Ясна текуща цена, таймер и статус за всеки автомобил.</p></div></div>
        <div className="infoCard"><span>03</span><div><b>Една по-чиста система</b><p>Създадена за бърза работа на desktop и mobile.</p></div></div>
      </section>

      <section id="inventory" className="contentSection">
        <div className="sectionHeading">
          <div><span className="sectionEyebrow">ПОДБРАНИ ЛОТОВЕ</span><h2>Автомобили на търг</h2><p>Нови предложения, live оферти и Buy Now автомобили.</p></div>
          <a href="#inventory">Виж всички автомобили <span>→</span></a>
        </div>

        <div className="filterRow">
          {chips.map((chip, index) => <button key={chip} className={`filterChip ${index === 0 ? "active" : ""}`}>{chip}</button>)}
        </div>

        <div className="carGrid">
          {featuredCars.map((car) => (
            <article key={car.lot} className="auctionCard">
              <div className="carImageWrap">
                <img src={car.image} alt={car.title} />
                <span className="carBadge">{car.badge}</span>
                <button className="watchBtn" aria-label={`Добави ${car.title} в любими`}>♡</button>
                <div className="imageFade" />
              </div>
              <div className="carBody">
                <div className="lotLine"><span>LOT {car.lot}</span><span className="verifiedDot">● VERIFIED</span></div>
                <h3>{car.title}</h3>
                <p>{car.spec}</p>
                <div className="carInfo"><span>⌖ {car.location}</span><span>◷ {car.time}</span></div>
                <div className="bidRow">
                  <div><small>Текуща оферта</small><strong>{car.price}</strong></div>
                  <button>Наддавай →</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="live" className="liveAuctionStrip">
        <div className="liveVisual"><span className="livePill"><i /> LIVE NOW</span><div className="liveCounter"><b>04</b><span>активни търга</span></div></div>
        <div className="liveCopy"><span className="sectionEyebrow">REAL-TIME AUCTIONS</span><h2>Търговете се случват в реално време.</h2><p>Следи текущата цена, наддавай и получавай моментален статус при промяна.</p></div>
        <button className="lightBtn">Виж активните търгове →</button>
      </section>

      <section id="how" className="contentSection stepsSection">
        <div className="sectionHeading"><div><span className="sectionEyebrow">ЛЕСЕН ПРОЦЕС</span><h2>От регистрация до автомобил</h2><p>Четири ясни стъпки без излишна сложност.</p></div></div>
        <div className="stepsGrid">
          <div><span>01</span><b>Регистрирай се</b><p>Създай профил и потвърди данните си.</p></div>
          <div><span>02</span><b>Намери автомобил</b><p>Филтрирай по марка, модел, година, цена и локация.</p></div>
          <div><span>03</span><b>Наддавай</b><p>Направи предварителна оферта или участвай в live търг.</p></div>
          <div><span>04</span><b>Плати и получи</b><p>Плащане, документи, освобождаване и транспорт.</p></div>
        </div>
      </section>

      <section className="finalCta">
        <div><span className="sectionEyebrow">ENCHEV AUCTIONS</span><h2>Следващият ти автомобил е на един търг разстояние.</h2><p>Разгледай лотовете и подготви профила си за участие.</p></div>
        <div className="finalActions"><button className="primaryBtn bigBtn">Създай профил →</button><a href="#inventory">Разгледай автомобилите</a></div>
      </section>

      <footer id="shipping" className="siteFooter">
        <div className="footerBrand"><span className="brandMark">E</span><div><b>ENCHEV AUCTIONS</b><p>Автомобилни търгове без излишна сложност.</p></div></div>
        <div className="footerLinks"><a href="#inventory">Автомобили</a><a href="#live">Търгове</a><a href="#how">Как работи</a><a href="#shipping">Транспорт</a></div>
        <small>Demo interface · Enchev Auctions © 2026</small>
      </footer>
    </main>
  );
}
