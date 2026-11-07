"use client";
import {useMemo,useState} from "react";
import EaInfoShell,{InfoIcon,InfoDialog,type InfoIconName} from "../components/EaInfoShell";
import BuyerPrivateRecords from "../components/BuyerPrivateRecords";

const baseByOrigin:Record<string,number>={"Europe":780,"East Coast USA":1650,"West Coast USA":2150,"Canada":1850};
const typeExtra:Record<string,number>={"Sedan":0,"SUV":180,"Pickup":260,"EV":120};
const routeSteps=[
 {label:"Аукцион",detail:"Автомобилът се освобождава от площадката след потвърждение на покупката."},
 {label:"Вътрешен транспорт",detail:"Превоз до хъб, терминал или пристанище според маршрута и автомобила."},
 {label:"Международен превоз",detail:"Сухопътен, контейнерен или RoRo транспорт според наличността и превозвача."},
 {label:"Доставка",detail:"Получаване в България и доставка до избрания град или адрес."}
];
const extras:{icon:InfoIconName;title:string;detail:string}[]=[
 {icon:"pin",title:"Проследяване",detail:"Планирани етапи: взет от площадката, в транспорт, терминал, пристигнал, доставен. Реалните статуси ще се показват само след потвърдени събития."},
 {icon:"file",title:"Документи",detail:"Документите за доставка и собственост се предоставят за действителна поръчка, а не за демонстрационен автомобил."},
 {icon:"shield",title:"Застраховка",detail:"Покритието зависи от маршрута, държавата, превозвача и договорените условия. Не е автоматично включено."},
 {icon:"help",title:"Съдействие",detail:"За въпроси и индивидуална оферта използвай страницата Поддръжка и данните на избрания автомобил."}
];
export default function TransportPage(){
 const [origin,setOrigin]=useState("East Coast USA");
 const [vehicle,setVehicle]=useState("Sedan");
 const [destination,setDestination]=useState("София");
 const [info,setInfo]=useState<number|null>(null);
 const [route,setRoute]=useState<number|null>(null);
 const [question,setQuestion]=useState<number|null>(null);
 const [records,setRecords]=useState(false);
 const estimate=useMemo(()=>baseByOrigin[origin]+typeExtra[vehicle]+(destination==="Варна"?120:destination==="Сливен"?90:0),[origin,vehicle,destination]);
 const faqs=[
  {q:"Колко време отнема?",a:"Срокът зависи от държавата, наличността за вземане, вида превоз и графика на превозвача. Точен срок не може да бъде обещан без конкретен лот и маршрут."},
  {q:"Цената окончателна ли е?",a:"Не. Показаната стойност е демонстрационна. Реалната оферта отчита локация, размери, тегло, превозвач, пристанищни и други такси."},
  {q:"Как се следи доставката?",a:"Планирано е проследяване на потвърдени статуси. За действителни доставки използвай личния си профил, след като услугата е активирана."}
 ];
 const dialog=records?<InfoDialog title="Моите доставки" onClose={()=>setRecords(false)}>
  <BuyerPrivateRecords scope="deliveries"/>
 </InfoDialog>:route!==null?<InfoDialog title={routeSteps[route].label} onClose={()=>setRoute(null)}>
  <span className="eaInfoKicker">E&A / ТРАНСПОРТ · ЕТАП {route+1} ОТ 4</span><h2>{routeSteps[route].label}</h2><p>{routeSteps[route].detail}</p><span className="eaInfoDialogSmall">План на процеса. Реалният статус се появява само при потвърдена поръчка и активен превоз.</span><div className="eaInfoDialogActions"><button className="eaInfoPrimary" type="button" onClick={()=>setRoute(null)}>Разбрах <InfoIcon name="check" size={18}/></button></div>
 </InfoDialog>:info!==null?<InfoDialog title={extras[info].title} onClose={()=>setInfo(null)}>
  <span className="eaInfoKicker">E&A / ЛОГИСТИКА</span><h2>{extras[info].title}</h2><p>{extras[info].detail}</p><div className="eaInfoDialogActions"><a href="/support" className="eaInfoPrimary">Поддръжка <InfoIcon name="arrow" size={17}/></a></div>
 </InfoDialog>:question!==null?<InfoDialog title={faqs[question].q} onClose={()=>setQuestion(null)}>
  <span className="eaInfoKicker">E&A / ТРАНСПОРТ · ВЪПРОСИ</span><h2>{faqs[question].q}</h2><p>{faqs[question].a}</p><div className="eaInfoDialogActions"><button type="button" className="eaInfoButton" onClick={()=>setQuestion((question+1)%faqs.length)}>Следващ въпрос <InfoIcon name="next" size={17}/></button><a href="/support" className="eaInfoPrimary">Свържи се с нас</a></div>
 </InfoDialog>:undefined;
 return <EaInfoShell kind="transport" eyebrow="E&A · SHIPPING & LOGISTICS" title="ТРАНСПОРТ НА" accent="АВТОМОБИЛИ" description="От аукционната площадка до България — прозрачен маршрут, документи и доставка." footer={<button type="button" onClick={()=>setRecords(true)}>Моите доставки <InfoIcon name="arrow" size={15}/></button>} dialog={dialog}>
  <section className="eaInfoPanel eaInfoTransportLeft">
   <div><span className="eaInfoKicker">ОТ ТЪРГА ДО ТВОЯ АДРЕС</span><h2 className="eaInfoPanelTitle">4 стъпки на транспортиране</h2></div>
   <div className="eaInfoRoute">{routeSteps.map((step,i)=><button type="button" key={step.label} className="eaInfoRouteStep" onClick={()=>setRoute(i)}><b>{i+1}</b><strong>{step.label}</strong></button>)}</div>
   <div><h2 className="eaInfoPanelTitle">Включени възможности</h2><div className="eaInfoTransportBenefits">{extras.map((x,i)=><button type="button" key={x.title} onClick={()=>setInfo(i)}><InfoIcon name={x.icon} size={20}/>{x.title}</button>)}</div></div>
  </section>
  <section className="eaInfoPanel eaInfoCalc">
   <div><span className="eaInfoKicker">ДЕМОНСТРАЦИОНЕН КАЛКУЛАТОР</span><h2 className="eaInfoPanelTitle">Изчисли ориентировъчен транспорт</h2></div>
   <div className="eaInfoCalcForm">
    <label htmlFor="ea-shipping-from">Произход<select id="ea-shipping-from" value={origin} onChange={e=>setOrigin(e.target.value)}>{Object.keys(baseByOrigin).map(x=><option key={x} value={x}>{x==="Europe"?"Европа":x==="East Coast USA"?"САЩ · Източно крайбрежие":x==="West Coast USA"?"САЩ · Западно крайбрежие":"Канада"}</option>)}</select></label>
    <label htmlFor="ea-shipping-type">Тип автомобил<select id="ea-shipping-type" value={vehicle} onChange={e=>setVehicle(e.target.value)}>{Object.keys(typeExtra).map(x=><option key={x} value={x}>{x==="Sedan"?"Седан":x==="Pickup"?"Пикап":x==="EV"?"Електрически":"SUV / Джип"}</option>)}</select></label>
    <label htmlFor="ea-shipping-destination">Дестинация<select id="ea-shipping-destination" value={destination} onChange={e=>setDestination(e.target.value)}><option>София</option><option>Варна</option><option>Сливен</option></select></label>
   </div>
   <div className="eaInfoPriceBox"><div><span>ПРИМЕРНА ОФЕРТА · ДЕМО</span><strong>от {estimate.toLocaleString("bg-BG")} €</strong></div><small>Не е реална оферта</small></div>
   <div className="eaInfoCalcLinks"><a className="eaInfoPrimary" href="/vehicles">Избери автомобил <InfoIcon name="arrow" size={16}/></a><button className="eaInfoButton" type="button" onClick={()=>setQuestion(0)}>Чести въпроси</button></div>
   <p className="eaInfoCalcDisclaimer">Примерен калкулатор без връзка с превозвач. Цената не включва мита, данъци, местни такси и разходи по конкретен лот. Финална оферта се потвърждава индивидуално.</p>
  </section>
 </EaInfoShell>;
}
