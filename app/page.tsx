import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import EnchevCinematicLoginGate from "./components/EnchevCinematicLoginGate";
import EaHeroPhotoOcclusion from "./components/EaHeroPhotoOcclusion";

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
        <img src="/brand/ea-approved-1to1.jpg" alt="E&A East West Auctioneers Group — SOULFLAME" />
      </div>
      <style>{`
        .eaHeroBrand{
          position:fixed;
          top:max(16px,env(safe-area-inset-top));
          left:50%;
          transform:translateX(-50%);
          z-index:7;
          width:clamp(180px,24vw,315px);
          pointer-events:none;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          /* Blend the full logo layer with the Forge iframe backdrop.
             Blending only the img inside a filtered parent left a black box. */
          mix-blend-mode:screen;
          will-change:clip-path;
        }
        .eaHeroBrand img{
          display:block;
          width:100%;
          height:auto;
          object-fit:contain;
          mix-blend-mode:normal;
          border:0;
          background:transparent;
        }
        @media(max-width:760px){
          .eaHeroBrand{
            top:max(8px,env(safe-area-inset-top));
            width:min(44vw,195px);
          }
        }
        @media(max-height:550px){
          .eaHeroBrand{top:6px;width:min(36vw,185px)}
        }
      `}</style>
      <EaHeroPhotoOcclusion />
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
