import Link from "next/link";

export const metadata = { title: "Няма връзка · E&A Auctions", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <main id="main-content" style={{ minHeight: "100dvh", background: "#080c09", color: "#f4f8f4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 460, padding: 32, border: "1px solid #3b7049", background: "#111e16", borderRadius: 24 }}>
        <img src="/brand/ea-2026-app.svg" alt="E&A" width={100} height={100} style={{ objectFit: "contain", margin: "0 auto" }} />
        <h1 style={{ margin: "18px 0 12px", fontSize: 32 }}>Няма интернет връзка</h1>
        <p style={{ color: "#b6c9ba", lineHeight: 1.65, marginBottom: 26 }}>Може да отвориш приложението от иконата, но автомобили, оферти и търгове изискват активна връзка със сървъра. Не изпращай наддаване, докато мрежата не се възстанови.</p>
        <Link href="/app" style={{ display: "block", color: "#061109", background: "#63e58c", padding: "14px 20px", borderRadius: 12, fontWeight: 750, textDecoration: "none" }}>Опитай отново</Link>
      </section>
    </main>
  );
}
