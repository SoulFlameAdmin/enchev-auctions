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
      
      
      <section className="eaIntroWords" aria-label="E&A East West Auctioneers Group — 🔥SOULFLAME🔥">
        <h1>E&amp;A <span>EAST WEST</span></h1>
        <p>AUCTIONEERS GROUP</p>
        <small>🔥SOULFLAME🔥</small>
      </section>
      <style>{`
      .eaIntroWords{position:fixed;left:50%;top:23.2%;transform:translateX(-50%);width:min(92vw,780px);z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;pointer-events:none;text-shadow:0 3px 22px rgba(0,0,0,.85);font-family:Arial,Helvetica,sans-serif}
      .eaIntroWords h1{color:#e6c28a;margin:0;font-size:clamp(27px,5vw,58px);font-weight:850;letter-spacing:.04em;line-height:1.03;white-space:nowrap}
      .eaIntroWords h1 span{color:#f3f0ea;font-size:.67em;letter-spacing:.09em}
      .eaIntroWords p{color:#dfd5c5;margin:0;font-size:clamp(11px,1.6vw,19px);font-weight:700;letter-spacing:.29em}
      .eaIntroWords small{color:#e4b86e;font-weight:800;font-size:clamp(12px,2vw,19px);letter-spacing:.13em;margin-top:5px}
      @media(max-width:760px){.eaIntroWords{top:23%;gap:5px}.eaIntroWords h1{font-size:clamp(25px,7.2vw,39px)}.eaIntroWords h1 span{font-size:.63em}.eaIntroWords p{font-size:clamp(10px,2.7vw,15px);letter-spacing:.19em}.eaIntroWords small{font-size:12px}}
      @media(max-height:650px){.eaIntroWords{top:17%;gap:3px}.eaIntroWords h1{font-size:clamp(23px,4vw,38px)}}
      `}</style>
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
