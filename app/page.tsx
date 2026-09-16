import StageTracker from "./components/StageTracker";

export default function Home() {
  return (
    <main className="page">
      <StageTracker />
      <section className="card">
        <div className="badge">ENCHEV AUCTIONS</div>
        <h1>System online.</h1>
        <p>GitHub → Vercel automatic deployment is connected.</p>
        <div className="homeStatus">
          <span className="homeStatusDot" />
          <span>Foundation active · Open the burger menu → Етапи</span>
        </div>
      </section>
    </main>
  );
}
