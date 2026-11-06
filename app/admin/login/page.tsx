import type {Metadata} from "next";
import EaAdminPasswordLogin from "../../components/EaAdminPasswordLogin";
export const metadata:Metadata={title:"Административен вход · ENCHEV AUCTIONS",robots:{index:false,follow:false}};
export default function AdminLogin(){
 return <main id="main-content" style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#060607",color:"#f4f4f5",padding:"24px",fontFamily:"Montserrat,Arial,sans-serif"}}>
  <section style={{width:"min(100%,460px)",padding:"clamp(24px,5vw,40px)",border:"1px solid #343438",background:"#111115",borderRadius:20}}>
   <span style={{color:"#f66",fontSize:12,fontWeight:700,letterSpacing:2}}>E&A · EAST AND WEST AUCTIONEERS GROUP</span>
   <h1 style={{fontSize:"clamp(25px,6vw,36px)",margin:"20px 0 12px",lineHeight:1.18}}>Защитен администраторски вход</h1>
   <p style={{color:"#b4b4ba",fontSize:14,lineHeight:1.6}}>Системният център е достъпен само след успешна проверка на паролата на сървъра.</p>
   <EaAdminPasswordLogin />
   <a href="/api/admin/google" style={{display:"block",marginTop:23,color:"#cfbbc0",fontSize:13}}>Google вход за защитени административни данни</a>
   <a href="/" style={{display:"inline-block",marginTop:26,color:"#fff",fontSize:14}}>← Към началната страница</a>
  </section>
 </main>;
}
