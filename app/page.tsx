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
      
      
      <div className="eaHeroBrand" aria-label="E&A East West Auctioneers Group — SOULFLAME">
        <img src="/brand/ea-east-west.svg" alt="E&A East West Auctioneers Group — SOULFLAME" />
      </div>
      <style>{`
        .eaHeroBrand{
          position:fixed;
          top:max(16px,env(safe-area-inset-top));
          left:50%;
          transform:translateX(-50%);
          z-index:7;
          width:min(55vw,490px);
          pointer-events:none;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          filter:drop-shadow(0 6px 18px #000a);
        }
        .eaHeroBrand img{display:block;width:100%;height:auto;object-fit:contain}
        @media(max-width:760px){
          .eaHeroBrand{top:max(10px,env(safe-area-inset-top));width:min(66vw,330px)}
        }
        @media(max-height:550px){
          .eaHeroBrand{top:6px;width:min(48vw,280px)}
        }
      `}</style>
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
