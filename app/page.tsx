import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";

export default function Home(){
  return (
    <main
      id="main-content"
      aria-label="EAuctions by SoulFlame"
      data-cinematic-tracker="connected"
      style={{ minHeight:"100vh", background:"#000", overflow:"hidden" }}
    >
      <iframe
        src="/forge/index.html"
        title="EAuctions by SoulFlame cinematic homepage"
        style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",border:0,background:"#000",zIndex:0}}
      />
      <a
        href="/live-auctions"
        aria-label="Старт търгове"
        style={{
          position:"fixed",left:"50%",bottom:28,transform:"translateX(-50%)",zIndex:5,
          padding:"15px 24px",borderRadius:999,background:"#b7ff2a",color:"#0b0d0b",
          fontWeight:900,fontSize:14,letterSpacing:".08em",textDecoration:"none",
          boxShadow:"0 8px 30px rgba(0,0,0,.38)",whiteSpace:"nowrap"
        }}
      >
        START ТЪРГОВЕ
      </a>
      <MasterSystemPlanV1 />
    </main>
  );
}
