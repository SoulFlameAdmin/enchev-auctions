import type {Metadata} from "next";
export const metadata:Metadata={title:"Администраторски вход · ENCHEV AUCTIONS",robots:{index:false,follow:false}};
export default async function AdminGoogleLogin({searchParams}:{searchParams:Promise<{error?:string}>}){
  const p=await searchParams;
  const error=p.error==="denied"?"Този Google профил няма администраторски достъп.":p.error?"Google входът не завърши. Проверете дали Google provider и callback адресът са настроени в Supabase.":null;
  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#06090d",color:"#f5f1e9",fontFamily:"Arial, sans-serif",padding:"20px"}}>
    <section style={{width:"min(100%,440px)",background:"#111820",border:"1px solid #38424c",borderRadius:24,padding:"clamp(24px,5vw,42px)",boxShadow:"0 20px 90px #0008"}}>
      <span style={{color:"#c6ad80",fontWeight:700,letterSpacing:3,fontSize:12}}>E&A · EAST WEST AUCTIONEERS GROUP</span>
      <h1 style={{fontSize:"clamp(27px,6vw,35px)",lineHeight:1.15,margin:"24px 0 14px"}}>Защитено администраторско меню</h1>
      <p style={{color:"#b4bec8",lineHeight:1.65}}>Входът е разрешен само на одобрените администратори. Използвай своя Google профил; няма отделна парола за сайта.</p>
      {error&&<p role="alert" style={{color:"#ffb3a8",padding:12,border:"1px solid #7d3e3a",borderRadius:10}}>{error}</p>}
      <a href="/api/admin/google" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:17,marginTop:27,borderRadius:12,background:"#f7f8fa",color:"#17202b",textDecoration:"none",fontWeight:700,fontSize:16}}>◉ Продължи с Google</a>
      <p style={{color:"#7c8995",fontSize:13,lineHeight:1.5,marginTop:22}}>Сесията се запомня на това устройство до 30 дни, освен ако не излезеш или достъпът не бъде отменен.</p>
      <a href="/" style={{display:"inline-block",marginTop:15,color:"#dabd88"}}>← Към публичния сайт</a>
    </section>
  </main>;
}
