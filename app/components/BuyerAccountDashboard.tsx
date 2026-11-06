"use client";

import {FormEvent,useCallback,useEffect,useState} from "react";
import "./buyer-account-dashboard.css";

type Profile={display_name:string|null;phone_e164:string|null;locale:"bg"|"en"};
type Verification={buyer_type:string;kyc_status:string;deposit_status:string;updated_at:string};
type Saved={lot_id:string;created_at:string};
type Lot={id:string;lot_number:string;title:string;make:string;model:string;status:string;model_year:number|null};
type Order={id:string;lot_id:string;status:string;total_amount:number|null;currency:string;invoice_number:string|null;created_at:string};
type Payment={id:string;order_id:string;provider:string;amount:number;currency:string;status:string;created_at:string};
type Document={id:string;order_id:string;kind:string;label:string;status:string;issued_at:string|null};
type Delivery={id:string;order_id:string;status:string;destination_country:string|null;eta_at:string|null};
type Workspace={
  ok:true;user:{id:string;email:string};profile:Profile|null;verification:Verification|null;
  savedLots:Saved[];lots:Lot[];orders:Order[];payments:Payment[];documents:Document[];
  deliveries:Delivery[];realMoneyEnabled:false;
};
type View="loading"|"inactive"|"signed-out"|"error"|"ready";
const journey=[
 {n:"01",name:"Регистрация",link:"/register",short:"Акаунт"},
 {n:"02",name:"Проверка",link:"/verification",short:"KYC / депозит"},
 {n:"03",name:"Автомобили",link:"/vehicles",short:"Любими лотове"},
 {n:"04",name:"LIVE търгове",link:"/auctions",short:"Наддаване"},
 {n:"05",name:"Спечелени",link:"/my-auctions",short:"Поръчки"},
 {n:"06",name:"Плащания",link:"/payments",short:"Документи"},
 {n:"07",name:"Транспорт",link:"/transport",short:"Доставка"},
] as const;

const fmt=(v:number|null|undefined,currency="EUR")=>
  v===null||v===undefined?"—":new Intl.NumberFormat("bg-BG",{style:"currency",currency,maximumFractionDigits:2}).format(v);

export default function BuyerAccountDashboard(){
  const [view,setView]=useState<View>("loading");
  const [data,setData]=useState<Workspace|null>(null);
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [locale,setLocale]=useState<"bg"|"en">("bg");
  const [saving,setSaving]=useState(false);
  const [removing,setRemoving]=useState<string|null>(null);
  const [feedback,setFeedback]=useState("");

  const load=useCallback(async()=>{
    try{
      // Session endpoint can refresh a valid HTTP-only session before querying RLS.
      const sessionResponse=await fetch("/api/enchev-auth/session",{credentials:"same-origin",cache:"no-store"});
      const session=await sessionResponse.json();
      if(!session.available){setView("inactive");setData(null);return;}
      if(!session.authenticated){setView("signed-out");setData(null);return;}
      const response=await fetch("/api/buyer/workspace",{credentials:"same-origin",cache:"no-store"});
      const payload=await response.json();
      if(!response.ok || payload.ok!==true){setView("error");setData(null);return;}
      const fresh=payload as Workspace;
      setData(fresh);setName(fresh.profile?.display_name??"");
      setPhone(fresh.profile?.phone_e164??"");setLocale(fresh.profile?.locale??"bg");
      setView("ready");
    }catch{setView("error");setData(null);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function saveProfile(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(view!=="ready"||saving)return;
    setSaving(true);setFeedback("");
    try{
      const result=await fetch("/api/buyer/workspace",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({display_name:name.trim()||null,phone_e164:phone.trim()||null,locale}),
      });
      const body=await result.json();
      if(!result.ok||body.ok!==true)throw Error(body.error||"Неуспешен запис.");
      setData(previous=>previous?{...previous,profile:body.profile as Profile}:null);
      setFeedback("Промените са записани в защитения ти профил.");
    }catch(e){setFeedback(e instanceof Error?e.message:"Неуспешен запис.");}
    finally{setSaving(false);}
  }
  async function removeSaved(id:string){
    if(removing)return;
    setRemoving(id);setFeedback("");
    try{
      const response=await fetch("/api/buyer/saved?lot_id="+encodeURIComponent(id),{
        method:"DELETE",credentials:"same-origin",
      });
      const payload=await response.json();
      if(!response.ok || payload.ok!==true)throw Error(payload.error||"Неуспешно премахване.");
      setData(previous=>previous?{...previous,savedLots:previous.savedLots.filter(v=>v.lot_id!==id)}:null);
      setFeedback("Автомобилът е премахнат от любимите.");
    }catch(e){setFeedback(e instanceof Error?e.message:"Възникна грешка.");}
    finally{setRemoving(null);}
  }

  return <div className="eaBuyerAccount">
    <header className="eaBuyerAccountHero">
      <span>ENCHEV AUCTIONS / SECURE BUYER WORKSPACE</span>
      <h1>МОЯТ <em>ПРОФИЛ.</em></h1>
      <p>Една самоличност, един запис на купувача и седем свързани етапа — без фалшиви спечелени търгове, плащания или документи.</p>
    </header>

    {view!=="ready"||!data?<section className="eaBuyerAccountEmpty" aria-live="polite">
      <h2>{view==="loading"?"Проверка на достъпа…":view==="inactive"?"Регистрацията се активира":view==="signed-out"?"Влез в профила си":"Профилът е временно недостъпен"}</h2>
      <p>{view==="inactive"?"Системата за потребителски акаунти още не е включена във Vercel. Данните няма да се записват като реален профил, докато няма проверен вход.":view==="signed-out"?"Търгове, документи, плащания и любими автомобили ще се заредят само след защитен вход.":view==="loading"?"Проверяваме валидната сесия, без да разкриваме данни на други потребители.":"Не успяхме да прочетем защитените записи; не показваме примерни данни вместо тях."}</p>
      <div><a href="/login">Вход →</a><a href="/register">Регистрация →</a><a href="/start#early-access">Ранен достъп →</a></div>
    </section>:<>
      <section className="eaBuyerIdentity" aria-label="Данни за профила">
        <div><small>ВЛЯЗЪЛ КУПУВАЧ</small><h2>{data.profile?.display_name||"E&A Buyer"}</h2><p>{data.user.email}</p><span className="eaBuyerIdentitySafe">Защитен индивидуален акаунт</span></div>
        <div className="eaBuyerIdentityFacts"><div><small>ПРОВЕРКА</small><strong>{data.verification?.kyc_status||"not started"}</strong></div><div><small>ДЕПОЗИТ</small><strong>{data.verification?.deposit_status||"not required"}</strong></div><div><small>ТЪРГОВЕ</small><strong>{data.orders.length} поръчки</strong></div></div>
      </section>

      <section className="eaBuyerJourneyGrid" aria-labelledby="ea-journey-title">
        <div className="eaBuyerSectionHead"><span>ПРОЦЕС НА ПОКУПКА</span><h2 id="ea-journey-title">7 свързани етапа</h2></div>
        <nav className="eaBuyerStages" aria-label="Навигация на профила">{journey.map((step,i)=><a href={step.link} key={step.n}>
          <small>{step.n} / 07</small><strong>{step.name}</strong><span>{step.short}</span>
          <em>{i===0?"Акаунт":i===1&&data.verification?.kyc_status==="approved"?"Проверен":i===2?data.savedLots.length+" любими":i===4?data.orders.length+" поръчки":i===5?data.payments.length+" плащания":"Към страницата"} ↗</em>
        </a>)}</nav>
      </section>

      <div className="eaBuyerAccountColumns">
        <section className="eaBuyerAccountBox" aria-labelledby="ea-profile-edit">
          <div className="eaBuyerSectionHead"><span>ЛИЧНИ ДАННИ</span><h2 id="ea-profile-edit">Настройки на профила</h2></div>
          <form onSubmit={saveProfile}>
            <label>Име за показване<input maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Име на купувача"/></label>
            <label>Телефон с код на държавата<input value={phone} maxLength={16} onChange={e=>setPhone(e.target.value)} placeholder="+359888123456" type="tel"/></label>
            <label>Език<select value={locale} onChange={e=>setLocale(e.target.value==="en"?"en":"bg")}><option value="bg">Български</option><option value="en">English</option></select></label>
            <button disabled={saving}>{saving?"Записване…":"Запази в профила →"}</button>
          </form>
        </section>

        <section className="eaBuyerAccountBox" aria-labelledby="ea-real-favs">
          <div className="eaBuyerSectionHead"><span>ЗАПАЗЕНО В АКАУНТА</span><h2 id="ea-real-favs">Любими автомобили · {data.savedLots.length}</h2></div>
          {data.savedLots.length?data.savedLots.map(v=>{
            const lot=data.lots.find(a=>a.id===v.lot_id);
            return <div className="eaBuyerAccountRow" key={v.lot_id}>
              <div><strong>{lot?.title||"Одобрен лот"}</strong><small>{lot?.lot_number||v.lot_id} · {lot?.status||"visible to account"}</small></div>
              <button type="button" disabled={removing===v.lot_id} onClick={()=>void removeSaved(v.lot_id)}>Премахни</button>
            </div>;
          }):<p className="eaBuyerEmptyCopy">Все още няма запазени реални автомобили. Демонстрационните лотове не се пренасят в купуваческия профил.</p>}
          <a className="eaBuyerBoxLink" href="/vehicles">Виж проверените автомобили ↗</a>
        </section>
      </div>

      <section className="eaBuyerOrders" aria-labelledby="ea-account-orders">
        <div className="eaBuyerSectionHead"><span>ИСТИНСКИ ЗАПИСИ ОТ СИСТЕМАТА</span><h2 id="ea-account-orders">Търгове, плащания и доставки</h2></div>
        <div className="eaBuyerOrdersStats">
          <a href="/my-auctions"><strong>{data.orders.length}</strong><span>Поръчки / спечелени</span></a>
          <a href="/payments"><strong>{data.payments.length}</strong><span>Платежни записи</span></a>
          <a href="/documents"><strong>{data.documents.length}</strong><span>Документи</span></a>
          <a href="/transport"><strong>{data.deliveries.length}</strong><span>Доставки</span></a>
        </div>
        {data.orders.length?data.orders.map(order=><div className="eaBuyerAccountRow" key={order.id}>
          <div><strong>{data.lots.find(l=>l.id===order.lot_id)?.title||"Автомобил"}</strong>
          <small>Статус: {order.status} · {order.invoice_number||"Без издадена фактура"}</small></div>
          <strong>{fmt(order.total_amount,order.currency)}</strong>
        </div>):<p className="eaBuyerEmptyCopy">Няма потвърдени реални поръчки. Резултатите от демо търговете не се показват като твои покупки.</p>}
      </section>
      {feedback&&<p className="eaBuyerAccountFeedback" role="status">{feedback}</p>}
    </>}
  </div>;
}
