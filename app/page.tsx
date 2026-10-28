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
        <div className="eaBrandDesktop" aria-hidden="true">
          <div className="eaBrandSymbol">
            <img src="/brand/ea-approved-1to1.jpg" alt="" />
          </div>
          <div className="eaBrandCopy">
            <span className="eaBrandName">EAST WEST</span>
            <span className="eaBrandGroup">AUCTIONEERS GROUP</span>
            <span className="eaBrandSoul">SOULFLAME</span>
          </div>
        </div>
        <img className="eaBrandMobileImg" src="/brand/ea-approved-1to1.jpg" alt="" />
      </div>
      <style>{`
        .eaHeroBrand{
          position:fixed;
          top:max(16px,env(safe-area-inset-top));
          left:50%;
          transform:translateX(-50%);
          z-index:7;
          width:min(475px,calc(100vw - 40px));
          pointer-events:none;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          mix-blend-mode:screen;
          will-change:clip-path;
        }
        .eaBrandDesktop{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:clamp(10px,1.45vw,20px);
          max-width:100%;
        }
        /* Show just the E&A emblem from the approved asset; never distort it. */
        .eaBrandSymbol{
          display:block;
          width:clamp(106px,12.8vw,162px);
          aspect-ratio:500/233;
          overflow:hidden;
          flex:none;
        }
        .eaBrandSymbol img{
          display:block;
          width:100%;
          height:auto;
          max-width:none;
        }
        .eaBrandCopy{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          justify-content:center;
          gap:7px;
          white-space:nowrap;
          line-height:1.1;
          text-shadow:0 1px 10px rgba(0,0,0,.85);
        }
        .eaBrandName{
          font:700 clamp(18px,2vw,27px)/1.05 Georgia,"Times New Roman",serif;
          letter-spacing:.13em;
          color:#f5e8d4;
        }
        .eaBrandGroup{
          font:700 clamp(8px,.78vw,11px)/1.2 Arial,sans-serif;
          letter-spacing:.22em;
          color:#d8ac59;
        }
        .eaBrandSoul{
          font:500 clamp(8px,.7vw,10px)/1.2 Arial,sans-serif;
          letter-spacing:.4em;
          color:#e0e8f2;
        }
        .eaBrandMobileImg{display:none}
        @media(max-width:760px){
          .eaHeroBrand{
            top:max(8px,env(safe-area-inset-top));
            width:min(38vw,167px);
          }
          .eaBrandDesktop{display:none}
          .eaBrandMobileImg{
            display:block;
            width:100%;
            height:auto;
            object-fit:contain;
            border:0;
            background:transparent;
          }
        }
        @media(max-height:550px) and (max-width:760px){
          .eaHeroBrand{top:6px;width:min(31vw,155px)}
        }
      `}</style>
      <EaHeroPhotoOcclusion />
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
