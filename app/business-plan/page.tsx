import { cookies } from "next/headers";
import { hasEnchevMenuAccess } from "../lib/enchev-menu-access";
import BusinessPlanClient from "./BusinessPlanClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessPlanPage() {
  const store = await cookies();
  const valid = hasEnchevMenuAccess(store.get("enchev_menu_access")?.value);
  if (!valid) {
    return <main style={{minHeight:"70vh",background:"#0c0e12",color:"#f4e8d4",display:"grid",placeItems:"center",padding:"32px 18px"}}>
      <div style={{maxWidth:520,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:15}} aria-hidden="true">🔒</div>
        <h1 style={{fontSize:"clamp(25px,4vw,39px)",margin:"0 0 16px"}}>Бизнес планът е в защитеното меню</h1>
        <p style={{color:"#c7c3bc",lineHeight:1.7}}>Отвори началната страница на ENCHEV AUCTIONS, натисни трите линии вляво, въведи паролата и избери „Бизнес план и услуги“.</p>
        <a href="/" style={{display:"inline-block",padding:"13px 24px",background:"#bd9865",color:"#121113",textDecoration:"none",borderRadius:10,fontWeight:800}}>Към защитеното ляво меню</a>
      </div>
    </main>;
  }
  return <BusinessPlanClient/>;
}
