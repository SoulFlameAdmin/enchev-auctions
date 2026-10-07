import { primaryNavigation } from "../site-navigation";
import WatchlistPanel from "./WatchlistPanel";
import MyAuctionsPanel from "./MyAuctionsPanel";
import "./profile-shell.css";

export default function ProfilePage(){
  return <main id="main-content" className="navigationPage">
    <header className="navigationRouteHeader">
      <a href="/" className="navigationRouteBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="navigationRouteNav" aria-label="Основна навигация">
        {primaryNavigation.map(item=><a key={item.key} href={item.href}>{item.label}</a>)}
        <a href="/profile" aria-current="page">ПРОФИЛ</a>
      </nav>
    </header>

    <section className="navigationRouteMain profileRouteMain">
      <div className="profileDashboardShell" data-design-task="D31">
        <aside className="profileAccountRail" aria-label="Навигация на профила">
          <div className="profileAccountIdentity">
            <span className="profileAccountAvatar" aria-hidden="true">EA</span>
            <div>
              <small>BUYER WORKSPACE</small>
              <strong>ENCHEV Account</strong>
            </div>
          </div>

          <nav className="profileAccountNav" aria-label="Секции на профила">
            <a href="#overview"><span aria-hidden="true">⌂</span><b>Обзор</b></a>
            <a href="#watchlist"><span aria-hidden="true">☆</span><b>Запазени</b></a>
            <a href="#my-auctions"><span aria-hidden="true">↗</span><b>Моите търгове</b></a>
            <a href="/support"><span aria-hidden="true">?</span><b>Помощ</b></a>
          </nav>

          <div className="profileAccountRailNote">
            <span>Бърз достъп</span>
            <p>Следи запазени лотове и търгове от едно място.</p>
          </div>
        </aside>

        <div className="profileDashboardContent">
          <section className="profileOverview" id="overview" aria-labelledby="profile-overview-heading">
            <span className="navigationRouteKicker">BUYER WORKSPACE</span>
            <h1 id="profile-overview-heading">Твоят ENCHEV профил</h1>
            <p>Следи запазените автомобили и използвай buyer workspace като изходна точка към инвентара и LIVE търговете.</p>

            <div className="profileOverviewActions" aria-label="Бързи действия">
              <a href="/inventory">Търси автомобили</a>
              <a href="/live-auctions">LIVE търгове</a>
            </div>
          </section>

          <WatchlistPanel />
          <MyAuctionsPanel />

          <section className="profileQuickLinks" aria-labelledby="profile-quick-links-heading">
            <div className="profileSectionHeading">
              <span>QUICK LINKS</span>
              <h2 id="profile-quick-links-heading">Продължи от профила</h2>
            </div>
            <div className="navigationRouteGrid">
              <article className="navigationRouteCard"><b>Инвентар</b><p>Продължи към търсенето и намери следващ автомобил или лот.</p><a href="/inventory">Към инвентара →</a></article>
              <article className="navigationRouteCard"><b>LIVE търгове</b><p>Влез в отделната търгова зала и следи активния лот.</p><a href="/live-auctions">Отвори LIVE →</a></article>
              <article className="navigationRouteCard"><b>Поддръжка</b><p>Отвори помощния център за транспорт, история на МПС и работа с платформата.</p><a href="/support">Отвори помощ →</a></article>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>;
}
