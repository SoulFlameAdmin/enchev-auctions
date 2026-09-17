import { primaryNavigation } from "../site-navigation";

export default function SupportPage(){
  return <main className="navigationPage">
    <header className="navigationRouteHeader">
      <a href="/" className="navigationRouteBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="navigationRouteNav" aria-label="Основна навигация">
        {primaryNavigation.map(item=><a key={item.key} href={item.href} aria-current={item.key==="support"?"page":undefined}>{item.label}</a>)}
        <a href="/profile">ПРОФИЛ</a>
      </nav>
    </header>
    <section className="navigationRouteMain">
      <span className="navigationRouteKicker">ENCHEV SUPPORT</span>
      <h1>Помощ и поддръжка</h1>
      <p>Една ясна входна точка за въпроси за търсене на автомобили, LIVE търгове, транспорт, история на МПС и работа с профила.</p>
      <div className="navigationRouteGrid">
        <article className="navigationRouteCard"><b>Търсене и инвентар</b><p>Отиди към автомобилите и използвай филтрите по марка, локация и състояние.</p></article>
        <article className="navigationRouteCard"><b>LIVE търгове</b><p>Отвори отделната LIVE зала и проследи текущия и следващия лот.</p></article>
        <article className="navigationRouteCard"><b>Транспорт и история</b><p>Използвай специализираните ENCHEV маршрути за доставка и проверка на автомобил.</p></article>
      </div>
      <div className="navigationRouteActions"><a href="/inventory">Отвори инвентара</a><a href="/live-auctions">LIVE търгове</a><a href="/profile">Профил</a></div>
    </section>
  </main>;
}
