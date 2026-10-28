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
      <a href="/presentation-2" style={{position:"fixed",bottom:24,left:24,zIndex:1000,padding:"14px 18px",borderRadius:6,background:"#dfb476",color:"#111",fontSize:12,fontWeight:700,textDecoration:"none"}}>презентация 2 ↗</a>
      <div aria-label="E&A East West Auctioneers Group — 🔥SOULFLAME🔥" style={{position:"fixed",top:15,left:18,zIndex:5,pointerEvents:"none",width:"clamp(155px,21vw,230px)",height:84,background:"linear-gradient(90deg,rgba(0,0,0,.82),transparent)",borderRadius:12}}><img src="/brand/ea-east-west.svg" alt="E&A East West Auctioneers Group 🔥SOULFLAME🔥" style={{width:"100%",height:"100%",objectFit:"contain"}} /></div>
      <MasterSystemPlanV1 />
      <EnchevCinematicLoginGate />
    </main>
  );
}
