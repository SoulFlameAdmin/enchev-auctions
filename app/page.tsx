import MasterSystemPlanV1 from "./components/MasterSystemPlanV1";

export default function Home(){
  return (
    <main
      id="main-content"
      aria-label="ENCHEV Auctions"
      data-cinematic-tracker="connected"
      data-release="official-cinematic-v1"
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
      <MasterSystemPlanV1 />
    </main>
  );
}
