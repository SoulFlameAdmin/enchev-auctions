import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";
import ForgeBulgarianHomeBridge from "./components/ForgeBulgarianHomeBridge";

export default function Home(){
  return (
    <main
      id="main-content"
      aria-label="EAuctions by SoulFlame"
      data-cinematic-tracker="connected"
      style={{ minHeight:"100vh", background:"#000", overflow:"hidden" }}
    >
      <iframe
        id="ea-forge-home"
        src="/forge/index.html"
        title="EAuctions by SoulFlame — начало"
        style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",border:0,background:"#000",zIndex:0}}
      />
      <ForgeBulgarianHomeBridge />
      <MasterSystemPlanV1 />
    </main>
  );
}
