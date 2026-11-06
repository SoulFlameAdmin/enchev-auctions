import EaOfficialLogo from "./components/EaOfficialLogo";
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
        allow="accelerometer; gyroscope"
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
      
      
      <div className="eaHeroBrand"><EaOfficialLogo /></div>
      <EaHeroPhotoOcclusion />
      <EnchevCinematicLoginGate />
    </main>
  );
}
