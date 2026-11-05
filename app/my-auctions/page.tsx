import BuyerPrivateRecords from "../components/BuyerPrivateRecords";
export const metadata={title:"Моите търгове · E&A"};
export default function MyAuctionsPage(){return <main id="main-content" style={{minHeight:"80vh",background:"#090a0c",padding:"38px 0 70px"}}>
  <div style={{maxWidth:1350,margin:"auto",padding:"0 20px",color:"#fff",fontFamily:"Arial, sans-serif"}}>
    <span style={{fontSize:12,color:"#e34b56",letterSpacing:".17em"}}>E&A / STEP 05</span>
    <h1 style={{fontSize:"clamp(42px,7vw,90px)",letterSpacing:"-.075em",margin:"18px 0"}}>МОИТЕ ТЪРГОВЕ</h1>
    <p style={{maxWidth:740,color:"#bcbec3",lineHeight:1.6}}>Реални спечелени автомобили, поръчки, финални цени и официални документи — свързани с единствено твоя регистриран акаунт.</p>
  </div>
  <BuyerPrivateRecords scope="auctions"/>
 </main>;}
