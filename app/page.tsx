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
      <a
        href="/profile?view=register"
        aria-label="Регистрация"
        style={{
          position:"fixed",left:"50%",bottom:28,transform:"translateX(-50%)",zIndex:5,
          padding:"15px 24px",borderRadius:999,background:"#b7ff2a",color:"#0b0d0b",
          fontWeight:900,fontSize:14,letterSpacing:".08em",textDecoration:"none",
          boxShadow:"0 8px 30px rgba(0,0,0,.38)",whiteSpace:"nowrap"
        }}
      >
        РЕГИСТРАЦИЯ
      </a>
      <MasterSystemPlanV1 />
    </main>
  );
}
