import { primaryNavigation } from "../site-navigation";

export default function SupportPage(){
  return <main id="main-content" className="navigationPage">
    <header className="navigationRouteHeader">
      <a href="/" className="navigationRouteBrand"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
      <nav className="navigationRouteNav" aria-label="Основна навигация">
        {primaryNavigation.map(item=><a key={item.key} href={item.href} aria-current={item.key==="support"?"page":undefined}>{item.label}</a>)}
        <a href="/profile">ПРОФИЛ</a>
      </nav>
    </header>
    <section className="navigationRouteMain">
      <span className="navigationRouteKicker">ENCHEV SUPPORT</span>
      <h1>Help & Support</h1>
      <p>One clear entry point for questions about vehicle search, live auctions, transport, vehicle history and account use.</p>
      <div className="navigationRouteGrid">
        <article className="navigationRouteCard"><b>Search & inventory</b><p>Go to vehicles and use filters by make, location and condition.</p></article>
        <article className="navigationRouteCard"><b>Live auctions</b><p>Open the dedicated live room and follow the current and next lot.</p></article>
        <article className="navigationRouteCard"><b>Transport & history</b><p>Use ENCHEV's dedicated transport and vehicle-check flows.</p></article>
      </div>
      <div className="navigationRouteActions"><a href="/inventory">Open inventory</a><a href="/live-auctions">Live auctions</a><a href="/profile">Profile</a></div>
    </section>
  </main>;
}
