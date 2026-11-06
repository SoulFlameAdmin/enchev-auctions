import type {Metadata} from "next";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {hasEnchevMenuAccess} from "../../lib/enchev-menu-access";
import MasterSystemPlanV1 from "../../components/MasterSystemPlanV1";
import EaAdminSignOut from "../../components/EaAdminSignOut";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata:Metadata={title:"Администраторски център | E&A Auctions",robots:{index:false,follow:false}};

export default async function AdminConsole(){
 const store=await cookies();
 if(!hasEnchevMenuAccess(store.get("enchev_menu_access")?.value)){
   redirect("/admin/login");
 }
 return <main id="main-content" style={{minHeight:"100dvh",background:"#050608",color:"#f6f8fa",padding:"100px 24px 50px"}}>
  <div style={{maxWidth:860,margin:"0 auto"}}>
   <span style={{fontSize:12,letterSpacing:3,color:"#cfa2a1"}}>E&A · ЗАЩИТЕН АДМИНИСТРАТОРСКИ ЦЕНТЪР</span>
   <h1 style={{fontSize:"clamp(28px,5vw,46px)",margin:"14px 0"}}>Управление на Enchev Auctions</h1>
   <p style={{lineHeight:1.7,color:"#afb4bd"}}>От лявото меню отвори бизнес плана, спешния план, системните етапи и останалите административни модули.</p>
   <a href="/" style={{display:"inline-block",padding:"12px 17px",marginTop:18,color:"#fff",border:"1px solid #555",borderRadius:10,textDecoration:"none"}}>← Към сайта</a><EaAdminSignOut />
  </div>
  <MasterSystemPlanV1 initialMenuOpen authorizedByServer />
 </main>;
}
