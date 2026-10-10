import { primaryNavigation } from "../site-navigation";
import WatchlistPanel from "./WatchlistPanel";
import BuyerSessionPanel from "../components/BuyerSessionPanel";
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
            <a href="#overview"><span aria-hidden="true">⌂</span><b>Overview</b></a>
            <a href="#watchlist"><span aria-hidden="true">☆</span><b>Saved</b></a>
            <a href="#my-auctions"><span aria-hidden="true">↗</span><b>My Auctions</b></a>
            <a href="/support"><span aria-hidden="true">?</span><b>Help</b></a>
          </nav>

          <div className="profileAccountRailNote">
            <span>Quick access</span>
            <p>Track saved lots and auctions from one place.</p>
          </div>
        </aside>

        <div className="profileDashboardContent">
          <BuyerSessionPanel />
          <section className="profileOverview" id="overview" aria-labelledby="profile-overview-heading">
            <span className="navigationRouteKicker">BUYER WORKSPACE</span>
            <h1 id="profile-overview-heading">Your ENCHEV account</h1>
            <p>Track saved vehicles and use the buyer workspace as your starting point for inventory and live auctions.</p>

            <div className="profileOverviewActions" aria-label="Бързи действия">
              <a href="/inventory">Search vehicles</a>
              <a href="/live-auctions">Live auctions</a>
            </div>
          </section>

          <WatchlistPanel />
          <MyAuctionsPanel />

          <section className="profileQuickLinks" aria-labelledby="profile-quick-links-heading">
            <div className="profileSectionHeading">
              <span>QUICK LINKS</span>
              <h2 id="profile-quick-links-heading">Continue from your account</h2>
            </div>
            <div className="navigationRouteGrid">
              <article className="navigationRouteCard"><b>Inventory</b><p>Continue searching and find your next vehicle or lot.</p><a href="/inventory">Go to inventory →</a></article>
              <article className="navigationRouteCard"><b>Live auctions</b><p>Enter the dedicated auction room and follow the active lot.</p><a href="/live-auctions">Open live →</a></article>
              <article className="navigationRouteCard"><b>Поддръжка</b><p>Open the help center for transport, vehicle history and platform use.</p><a href="/support">Open help →</a></article>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>;
}
