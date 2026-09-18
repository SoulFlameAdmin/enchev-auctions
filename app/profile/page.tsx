import { primaryNavigation } from "../site-navigation";
import WatchlistPanel from "./WatchlistPanel";
import MyAuctionsPanel from "./MyAuctionsPanel";

export default function ProfilePage(){
  return <main className="navigationPage">
    <header className="navigationRouteHeader">
      <a href="/" className="navigationRouteBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="navigationRouteNav" aria-label="Основна навигация">
        {primaryNavigation.map(item=><a key={item.key} href={item.href}>{item.label}</a>)}
        <a href="/profile" aria-current="page">ПРОФИЛ</a>
      </nav>
    </header>
    <section className="navigationRouteMain">
      <span className="navigationRouteKicker">BUYER WORKSPACE</span>
      <h1>Твоят ENCHEV профил</h1>
      <p>Следи запазените автомобили и използвай buyer workspace като изходна точка към инвентара и LIVE търговете.</p>

      <WatchlistPanel />
      <MyAuctionsPanel />

      <div className="navigationRouteGrid">
        <article className="navigationRouteCard"><b>Инвентар</b><p>Продължи към търсенето и намери следващ автомобил или лот.</p></article>
        <article className="navigationRouteCard"><b>LIVE търгове</b><p>Влез в отделната търгова зала и следи активния лот.</p></article>
        <article className="navigationRouteCard"><b>Поддръжка</b><p>Отвори помощния център за транспорт, история на МПС и работа с платформата.</p></article>
      </div>
      <div className="navigationRouteActions"><a href="/inventory">Търси автомобили</a><a href="/live-auctions">LIVE търгове</a><a href="/support">Помощ</a></div>
    </section>
  </main>;
}
