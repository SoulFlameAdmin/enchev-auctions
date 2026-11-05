import BuyerPrivateRecords from "../components/BuyerPrivateRecords";
export const metadata={title:"Проверка и депозит · E&A"};
export default function VerificationPage(){return <main id="main-content" style={{minHeight:"80vh",background:"#090a0c",padding:"38px 0 70px"}}>
  <div style={{maxWidth:1350,margin:"auto",padding:"0 20px",color:"#fff",fontFamily:"Arial, sans-serif"}}>
    <span style={{fontSize:12,color:"#e34b56",letterSpacing:".17em"}}>E&A / STEP 02</span>
    <h1 style={{fontSize:"clamp(40px,7vw,86px)",letterSpacing:"-.07em",margin:"18px 0"}}>ПРОВЕРКА И ДЕПОЗИТ</h1>
    <p style={{maxWidth:740,color:"#bcbec3",lineHeight:1.6}}>Личен или фирмен купувач. Допускането до реален търг се потвърждава от оторизираната система след проверка и приложимите условия за депозит.</p>
  </div>
  <BuyerPrivateRecords scope="verification"/>
 </main>;}
