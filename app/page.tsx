import SystemTrackerClean from "./components/SystemTrackerClean";

const cars = [
  {
    lot: "EA-10482",
    title: "2018 BMW M4 F82",
    meta: "3.0 бензин · Автоматик · 82 410 км",
    location: "София, България",
    status: "Търг след 2ч 18м",
    bid: "€12 750",
    badge: "RUN & DRIVE",
    image: "https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82",
    alt: "Бял BMW M4 F82"
  },
  {
    lot: "EA-10511",
    title: "2021 Mercedes-Benz GLC",
    meta: "2.0 дизел · Автоматик · 64 900 км",
    location: "Мюнхен, Германия",
    status: "Търг утре · 11:30",
    bid: "€18 400",
    badge: "BUY NOW",
    image: "https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82",
    alt: "Mercedes-Benz SUV"
  },
  {
    lot: "EA-10539",
    title: "2022 Audi RS3 Sportback",
    meta: "2.5 бензин · Автоматик · 41 280 км",
    location: "Крю, Великобритания",
    status: "Търг днес · 16:00",
    bid: "€21 900",
    badge: "HOT LOT",
    image: "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82",
    alt: "Син Audi RS3 Sportback"
  },
  {
    lot: "EA-10603",
    title: "2026 Volkswagen Golf GTI",
    meta: "2.0 бензин · DSG · 9 870 км",
    location: "Лондон, Великобритания",
    status: "Търг след 5ч 44м",
    bid: "€16 250",
    badge: "CLEAN TITLE",
    image: "https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82",
    alt: "Бял Volkswagen Golf GTI"
  }
];

export default function Home() {
  return (
    <main className="marketPage">
      <SystemTrackerClean />

      <div className="demoBar">
        <span className="livePulse" />
        ENCHEV AUCTIONS · DEMO HOMEPAGE
        <span>Примерните автомобили и цени са само за визуализация</span>
      </div>

      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Enchev Auctions начало">
          <span className="brandMark">E</span>
          <span><b>ENCHEV</b><small>AUCTIONS</small></span>
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
        <div className="heroAuctionContent">
          <div className="heroKicker">ЕВРОПЕЙСКА ПЛАТФОРМА ЗА АВТОМОБИЛНИ ТЪРГОВЕ</div>
          <h1>Намери автомобила.<br/><em>Спечели търга.</em></h1>
          <p>Употребявани, ремонтируеми и премиум автомобили на едно място.</p>

          <div className="heroSearch">
            <label>
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
            <button className="searchBtn">Търси автомобили →</button>
          </div>

          <div className="heroStats">
            <div><b>2 480+</b><span>активни автомобила</span></div>
            <div><b>38</b><span>търга тази седмица</span></div>
            <div><b>12</b><span>европейски държави</span></div>
            <div><b>24/7</b><span>онлайн достъп</span></div>
          </div>
        </div>
      </section>

      <section id="inventory" className="contentSection">
        <div className="sectionHeading">
          <div><span className="sectionEyebrow">ПОДБРАНИ ЛОТОВЕ</span><h2>Автомобили на търг</h2></div>
          <a href="#inventory">Виж всички автомобили <span>→</span></a>
        </div>

        <div className="carGrid">
          {cars.map((car) => (
            <article className="auctionCard" key={car.lot}>
              <div className="carImageWrap">
                <img src={car.image} alt={car.alt} />
                <span className="carBadge">{car.badge}</span>
                <button className="watchBtn" aria-label={`Добави ${car.title} в любими`}>♡</button>
              </div>
              <div className="carBody">
                <div className="lotLine"><span>LOT {car.lot}</span><span className="verifiedDot">● VERIFIED</span></div>
                <h3>{car.title}</h3>
                <p>{car.meta}</p>
                <div className="carInfo"><span>⌖ {car.location}</span><span>◷ {car.status}</span></div>
                <div className="bidRow">
                  <div><small>Текуща оферта</small><strong>{car.bid}</strong></div>
                  <button>Наддавай</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="live" className="liveAuctionStrip">
        <div>
          <span className="livePill"><i/> LIVE</span>
          <h2>Търговете се случват в реално време.</h2>
          <p>Следи текущата цена, наддавай и получавай моментален статус при промяна.</p>
        </div>
        <button className="lightBtn">Виж активните търгове →</button>
      </section>

      <section id="how" className="contentSection stepsSection">
        <div className="sectionHeading"><div><span className="sectionEyebrow">ЛЕСЕН ПРОЦЕС</span><h2>От регистрация до автомобил</h2></div></div>
        <div className="stepsGrid">
          <div><span>01</span><b>Регистрирай се</b><p>Създай профил и потвърди данните си.</p></div>
          <div><span>02</span><b>Намери автомобил</b><p>Използвай търсене и филтри по марка, модел, година и цена.</p></div>
          <div><span>03</span><b>Наддавай</b><p>Направи предварителна оферта или участвай в live търг.</p></div>
          <div><span>04</span><b>Плати и получи</b><p>След спечелване следва плащане, документи и транспорт.</p></div>
        </div>
      </section>

      <footer id="shipping" className="siteFooter">
        <div className="footerBrand"><span className="brandMark">E</span><div><b>ENCHEV AUCTIONS</b><p>Автомобилни търгове без излишна сложност.</p></div></div>
        <div className="footerLinks"><a href="#inventory">Автомобили</a><a href="#live">Търгове</a><a href="#how">Как работи</a><a href="#shipping">Транспорт</a></div>
        <small>Demo interface · Enchev Auctions © 2026</small>
      </footer>
    </main>
  );
}
