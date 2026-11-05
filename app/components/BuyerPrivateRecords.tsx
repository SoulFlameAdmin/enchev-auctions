"use client";
import {useEffect,useState} from "react";
import "./buyer-private-records.css";

type Scope="verification"|"auctions"|"payments"|"documents"|"deliveries";
type Records={
 ok:true;user:{id:string;email:string};
 verification:{buyer_type:string;kyc_status:string;deposit_status:string}|null;
 orders:Array<{id:string;status:string;invoice_number:string|null;currency:string;total_amount:number|null;lot_id:string;created_at:string}>;
 payments:Array<{id:string;order_id:string;provider:string;status:string;amount:number;currency:string}>;
 documents:Array<{id:string;order_id:string;kind:string;label:string;status:string}>;
 deliveries:Array<{id:string;order_id:string;status:string;destination_country:string|null;eta_at:string|null}>;
 lots:Array<{id:string;title:string;lot_number:string}>;
};
const meta={
 verification:{kicker:"02 / 07 · BUYER VERIFICATION",title:"Проверка и депозит",empty:"Проверката на самоличността и депозитите все още не са активирани.",link:"/register",linkText:"Регистрация"},
 auctions:{kicker:"05 / 07 · MY AUCTIONS",title:"Моите търгове и печалби",empty:"Няма потвърдени спечелени търгове или покупки на този акаунт.",link:"/auctions",linkText:"Търгове"},
 payments:{kicker:"06 / 07 · SECURE PAYMENTS",title:"Моите плащания",empty:"Няма официални платежни записи по този акаунт.",link:"/payments",linkText:"Плащания"},
 documents:{kicker:"06 / 07 · SECURE DOCUMENTS",title:"Моите документи",empty:"Няма издадени документи за реална покупка.",link:"/documents",linkText:"Документи"},
 deliveries:{kicker:"07 / 07 · SHIPPING STATUS",title:"Моите доставки",empty:"Няма активирани доставки по потвърдени поръчки.",link:"/transport",linkText:"Транспорт"},
} as const;
export default function BuyerPrivateRecords({scope}:{scope:Scope}){
 const [state,setState]=useState<"loading"|"inactive"|"signed-out"|"error"|"ready">("loading");
 const [records,setRecords]=useState<Records|null>(null);
 useEffect(()=>{let stop=false;(async()=>{
  try{
   const session=await fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store"});
   const user=await session.json();
   if(stop)return;
   if(user.available!==true){setState("inactive");return;}
   if(user.authenticated!==true){setState("signed-out");return;}
   const response=await fetch("/api/buyer/workspace",{credentials:"same-origin",cache:"no-store"});
   const data=await response.json();
   if(stop)return;
   if(!response.ok||data.ok!==true){setState("error");return;}
   setRecords(data as Records);setState("ready");
  }catch{if(!stop)setState("error");}
 })();return()=>{stop=true};},[]);
 const m=meta[scope];
 const content=records && (scope==="verification"?[]:scope==="auctions"?records.orders:scope==="payments"?records.payments:scope==="documents"?records.documents:records.deliveries);
 return <section className="eaPrivateRecords" aria-labelledby={"ea-private-"+scope}>
  <header><span>{m.kicker}</span><h2 id={"ea-private-"+scope}>{m.title}</h2></header>
  {state!=="ready"||!records?<div className="eaPrivateEmpty" role="status">
    <strong>{state==="loading"?"Проверка на личната сесия…":state==="inactive"?"Сигурните акаунти очакват активиране":state==="signed-out"?"Влез, за да видиш личните си записи":"Не успяхме да потвърдим данните"}</strong>
    <p>{state==="inactive"?"Системата няма да съхранява поръчки или плащания без реална потвърдена самоличност.":state==="signed-out"?"Тук се показват само записи за текущия влязъл потребител.":"Няма да показваме фиктивни търгове или документи вместо действителни данни."}</p>
    <a href="/login">Вход →</a><a href="/start#early-access">Ранен достъп →</a>
   </div>:
   scope==="verification"?<div className="eaPrivateVerification">
    <article><small>ПРОФИЛ</small><strong>{records.user.email}</strong><p>Регистрацията е потвърдена от доставчика на самоличност.</p></article>
    <article><small>KYC / KYB</small><strong>{records.verification?.kyc_status||"Не е започнала"}</strong><p>Само упълномощен екип или доставчик може да одобри проверката.</p></article>
    <article><small>ДЕПОЗИТ</small><strong>{records.verification?.deposit_status||"Не е изискан"}</strong><p>Сума и срок за възстановяване се публикуват само при одобрен конкретен търг.</p></article>
    <div className="eaPrivateEmpty"><strong>Истинското участие е заключено</strong><p>Не въвеждай лични документи или банкови данни, докато провереният KYC и платежен процес не бъде активиран.</p></div>
   </div>:
   content && content.length ? <div className="eaPrivateList">{content.map(row=>{
     const id=String(row.id);
     const title=scope==="auctions"?records.lots.find(l=>l.id===(row as Records["orders"][number]).lot_id)?.title||
       "Автомобил по поръчка":scope==="payments"?"Плащане "+(row as Records["payments"][number]).provider:
       scope==="documents"?(row as Records["documents"][number]).label:"Доставка";
     return <article key={id}><div><strong>{title}</strong><small>Референция {id.slice(0,8).toUpperCase()}</small></div>
       <span>{row.status}</span></article>;
   })}</div>:
   <div className="eaPrivateEmpty" role="status"><strong>{m.empty}</strong><p>Този раздел се попълва автоматично само при потвърдени събития от търга, платежния доставчик или оператора.</p><a href={m.link}>{m.linkText} ↗</a><a href="/profile">Моят профил ↗</a></div>
  }
 </section>;
}
