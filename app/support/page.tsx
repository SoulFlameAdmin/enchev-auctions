"use client";
import {useState} from "react";
import EaInfoShell,{InfoIcon,InfoDialog,type InfoIconName} from "../components/EaInfoShell";

const topics:{icon:InfoIconName;title:string;description:string;href:string}[]=[
 {icon:"car",title:"Автомобили",description:"Каталог, филтри и лотове",href:"/vehicles"},
 {icon:"live",title:"LIVE търгове",description:"Зала, таймер и наддаване",href:"/auctions"},
 {icon:"history",title:"История на автомобил",description:"VIN, щети и документи",href:"/vehicle-history"},
 {icon:"transport",title:"Транспорт",description:"Цени, маршрут и получаване",href:"/transport"},
 {icon:"user",title:"Моят профил",description:"Вход, запазени и заявки",href:"/profile"},
 {icon:"card",title:"Плащания и документи",description:"Официални поръчки и фактури",href:"/payments"}
];
const faqs=[
 {q:"Как да участвам в търг?",a:"Създай акаунт, премини проверка на купувача и изчакай официално одобрение за конкретния търг. Докато системата е демо, не може да се наддава с реални пари.",href:"/start",action:"Стъпки за покупка"},
 {q:"Как да запазя автомобил?",a:"Отвори автомобил от проверения каталог и използвай функцията за наблюдение. За запис в личния профил може да е необходим активен потребителски акаунт.",href:"/vehicles",action:"Отвори автомобилите"},
 {q:"Кога се извършва плащане?",a:"Единствено след официално потвърдена покупка и проверена платежна заявка или фактура. В момента реалните плащания не са активирани.",href:"/payments",action:"Плащания"},
 {q:"Мога ли да проверя VIN?",a:"Страницата за история проверява формата на VIN в демонстрационен режим. Външни данни за щети, пробег и собственост все още не се извличат.",href:"/vehicle-history",action:"Провери VIN"},
 {q:"Как получавам автомобила?",a:"След приключване на реална поръчка се организира логистика според маршрута, превозвача и документите. Показаният транспортен калкулатор дава само примерни стойности.",href:"/transport",action:"Към транспорта"}
];
export default function SupportPage(){
 const [faq,setFaq]=useState<number|null>(null);
 const [selected,setSelected]=useState(false);
 const dialog=faq!==null?<InfoDialog title={faqs[faq].q} onClose={()=>setFaq(null)}>
  <span className="eaInfoKicker">E&A / ВЪПРОСИ И ОТГОВОРИ</span><h2>{faqs[faq].q}</h2><p>{faqs[faq].a}</p>
  <div className="eaInfoDialogActions"><a className="eaInfoPrimary" href={faqs[faq].href}>{faqs[faq].action} <InfoIcon name="arrow" size={17}/></a><button type="button" className="eaInfoButton" onClick={()=>setFaq((faq+1)%faqs.length)}>Следващ въпрос</button></div>
 </InfoDialog>:selected?<InfoDialog title="Контакт и съдействие" onClose={()=>setSelected(false)}>
  <span className="eaInfoKicker">E&A / ПОДДРЪЖКА</span><h2>Свържи се с екипа</h2>
  <p>Избери темата на запитването. Тази страница все още няма активен чат или система за изпращане на билети и няма да показва фалшиво потвърждение за изпратено съобщение.</p>
  <div className="eaInfoDialogActions"><a className="eaInfoPrimary" href="/profile">Моят профил <InfoIcon name="arrow" size={17}/></a><a className="eaInfoButton" href="/start">Как се купува</a></div>
 </InfoDialog>:undefined;
 return <EaInfoShell kind="support" eyebrow="E&A · CLIENT SUPPORT CENTER" title="ПОМОЩ И" accent="ПОДДРЪЖКА" description="Единен център за съдействие с автомобили, търгове, плащания, история и транспорт." footer={<a href="/start">Ръководство за купувача <InfoIcon name="arrow" size={15}/></a>} dialog={dialog}>
  <section className="eaInfoPanel eaInfoSupportTopics">
   <div><span className="eaInfoKicker">ИЗБЕРИ ТЕМА</span><h2 className="eaInfoPanelTitle">С какво можем да помогнем?</h2></div>
   <div className="eaInfoTopicGrid">{topics.map(t=><a className="eaInfoTile" key={t.href} href={t.href}><InfoIcon name={t.icon} size={25}/><span className="eaInfoTileText"><strong>{t.title}</strong><small>{t.description}</small></span><InfoIcon name="next" size={17}/></a>)}</div>
  </section>
  <section className="eaInfoPanel eaInfoSupportHelp">
   <div><span className="eaInfoKicker">БЪРЗИ ОТГОВОРИ</span><h2 className="eaInfoPanelTitle">Често задавани въпроси</h2></div>
   <div className="eaInfoFaqButtons">{faqs.slice(0,4).map((f,i)=><button type="button" key={f.q} onClick={()=>setFaq(i)}><span>{f.q}</span><InfoIcon name="next" size={16}/></button>)}</div>
   <div className="eaInfoSupportActions"><button className="eaInfoButton" type="button" onClick={()=>setFaq(4)}>Още въпроси</button><button className="eaInfoPrimary" type="button" onClick={()=>setSelected(true)}><InfoIcon name="help" size={18}/> Свържи се с нас</button></div>
   <p className="eaInfoSupportNote">Акаунти, плащания и реални заявки се активират поетапно. Информационните екрани не са потвърждение за услуга.</p>
  </section>
 </EaInfoShell>;
}
