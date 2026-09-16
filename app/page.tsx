import SystemTrackerClean from "./components/SystemTrackerClean";

export default function Home() {
  return (
    <main className="page">
      <SystemTrackerClean />
      <section className="card">
        <div className="badge">ENCHEV AUCTIONS</div>
        <h1>System online.</h1>
        <p>Само реалната система от 0 → 100% се управлява от Command Center → Етапи.</p>
        <div className="homeStatus">
          <span className="homeStatusDot" />
          <span>GitHub → Vercel active · Следваща системна стъпка: Supabase</span>
        </div>
      </section>
    </main>
  );
}
