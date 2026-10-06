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
        title="EAuctions by SoulFlame cinematic marketplace"
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
      <nav
        aria-label="EAuctions marketplace"
        style={{position:"fixed",right:18,bottom:18,zIndex:4,display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}
      >
        <a href="/inventory" style={{padding:"12px 16px",borderRadius:999,background:"#f3efe5",color:"#10110f",fontWeight:800,textDecoration:"none"}}>АВТОМОБИЛИ</a>
        <a href="/live-auctions" style={{padding:"12px 16px",borderRadius:999,background:"#b7ff2a",color:"#10110f",fontWeight:900,textDecoration:"none"}}>LIVE ТЪРГОВЕ</a>
        <a href="/profile" style={{padding:"12px 16px",borderRadius:999,background:"rgba(10,10,10,.78)",color:"#fff",border:"1px solid rgba(255,255,255,.28)",fontWeight:800,textDecoration:"none"}}>ПРОФИЛ</a>
      </nav>
      <MasterSystemPlanV1 />
    </main>
  );
}
