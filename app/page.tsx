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
      .eaIntroWords{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);width:min(92vw,780px);z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;pointer-events:none;text-shadow:0 2px 14px #000b}
      .eaIntroWords h1,.eaIntroWords p{margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif;font-style:normal;line-height:1.14;white-space:nowrap}
      .eaIntroWords h1{font-size:clamp(24px,3.1vw,40px);font-weight:800;letter-spacing:.08em}
      .eaIntroWords p{font-size:clamp(13px,1.4vw,18px);font-weight:600;letter-spacing:.19em}
      .eaIntroWords p:last-child{font-size:clamp(11px,1.15vw,15px);font-weight:600;letter-spacing:.22em;margin-top:1px}
      @media(max-width:760px){.eaIntroWords{top:max(12px,env(safe-area-inset-top));left:calc(50% + 42px);width:calc(100vw - 124px);gap:3px}.eaIntroWords h1{font-size:clamp(16px,4.5vw,21px);letter-spacing:.045em}.eaIntroWords p{font-size:clamp(10px,2.75vw,13px);letter-spacing:.13em}.eaIntroWords p:last-child{font-size:clamp(10px,2.6vw,12px);letter-spacing:.16em}}
      @media(max-height:550px){.eaIntroWords{top:9px;gap:2px}.eaIntroWords h1{font-size:clamp(15px,3vw,26px)}.eaIntroWords p{font-size:11px}.eaIntroWords p:last-child{font-size:10px}}
      `}</style>
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
