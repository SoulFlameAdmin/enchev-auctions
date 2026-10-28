import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import EnchevCinematicLoginGate from "./components/EnchevCinematicLoginGate";

export default function Home(){
  return (
    <main
      id="main-content"
      aria-label="E&A East West Auctioneers Group"
      data-cinematic-tracker="connected"
      style={{ minHeight:"100vh", background:"#000", overflow:"hidden" }}
    >
      <iframe
        src="/forge/index.html"
        title="ENCHEV Auctions cinematic homepage"
        style={{
          position:"fixed",
          inset:0,
          width:"100vw",
          height:"100dvh",
          border:0,
          background:"#000",
          zIndex:0,
        }}
      />
      
      
      <section className="eaIntroWords" aria-label="E&A East West Auctioneers Group — SOULFLAME">
        <h1>E&amp;A EAST WEST</h1>
        <p>AUCTIONEERS GROUP</p>
        <p>SOULFLAME</p>
      </section>
      <style>{`
      .eaIntroWords{position:fixed;left:50%;top:23.2%;transform:translateX(-50%);width:min(94vw,780px);z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;pointer-events:none;text-shadow:0 3px 22px rgba(0,0,0,.85)}
      .eaIntroWords h1,.eaIntroWords p{margin:0;color:#ead4b1;font-family:Arial,Helvetica,sans-serif;font-size:clamp(20px,3.1vw,35px);font-weight:700;letter-spacing:.12em;line-height:1.2;white-space:nowrap}
      @media(max-width:760px){.eaIntroWords{top:23%;gap:13px}.eaIntroWords h1,.eaIntroWords p{font-size:clamp(17px,5.1vw,24px);letter-spacing:.1em}}
      @media(max-height:650px){.eaIntroWords{top:17%;gap:8px}.eaIntroWords h1,.eaIntroWords p{font-size:clamp(17px,3vw,27px)}}
      `}</style>
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
