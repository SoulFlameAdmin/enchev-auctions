"use client";
import {useState,type FormEvent} from "react";
import EaInfoShell,{InfoIcon,InfoDialog,type InfoIconName} from "../components/EaInfoShell";

type Feature={icon:InfoIconName;title:string;description:string;details:string};
const features:Feature[]=[
 {icon:"car",title:"VIN и идентификация",description:"Марка, модел, година и двигател",details:"17-символен VIN идентификатор, базова заводска конфигурация, година и основни технически данни, когато са достъпни от надежден източник."},
 {icon:"file",title:"Документи и статус",description:"Регистрация и правен статус",details:"Тип документ и регистрационен статус на автомобила според източника, държавата и наличните официални записи."},
 {icon:"shield",title:"Щети и произшествия",description:"История на известните щети",details:"Налични записи за инциденти, видове повреди, снимки и предишни аукционни участия, само когато са действително потвърдени."},
 {icon:"time",title:"Пробег и сервиз",description:"История на отчетените километри",details:"Хронология на известните показания на километража и предупреждения за вероятни несъответствия между записи."},
 {icon:"globe",title:"Собственост и държава",description:"Налични регистрации",details:"Държави на регистрация, минали регистрации и собственост, доколкото законът и наличните доставчици позволяват."},
 {icon:"info",title:"Рискови сигнали",description:"Пропуски и несъответствия",details:"Разграничаване между потвърдена информация, непотвърдени данни и липсващи записи. Липсата на информация не доказва липса на щети."}
];
export default function VehicleHistoryPage(){
 const [vin,setVin]=useState("");
 const [result,setResult]=useState<string|null>(null);
 const [feature,setFeature]=useState<number|null>(null);
 const [error,setError]=useState("");
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const normalized=vin.trim().toUpperCase().replace(/\s/g,"");
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)){setError("Въведи валиден 17-символен VIN без I, O и Q.");return;}
  setError("");
  setResult(normalized);
 }
 const dialog=result!==null?<InfoDialog title="Демонстрационна VIN справка" onClose={()=>setResult(null)}>
  <span className="eaInfoKicker">E&A / ПРИМЕРЕН ОТЧЕТ</span>
  <h2>VIN: {result}</h2>
  <p>VIN номерът е проверен само за формат. <strong>Не е извършена реална проверка</strong> в регистър или платен доставчик на автомобилна история.</p>
  <div className="eaInfoDemoSummary">
   <article><span>VIN формат</span><strong>17 символа</strong></article>
   <article><span>Външен доставчик</span><strong>Не е свързан</strong></article>
   <article><span>Пробег</span><strong>Няма проверени данни</strong></article>
   <article><span>Щети и история</span><strong>Няма проверени данни</strong></article>
  </div>
  <span className="eaInfoDialogSmall">Не приемай липсата на данни като доказателство за безавариен автомобил. В бъдеще отчети ще се извличат само от интегрирани, проверени източници.</span>
  <div className="eaInfoDialogActions"><a className="eaInfoPrimary" href="/vehicles">Виж автомобили <InfoIcon name="arrow" size={18}/></a><button className="eaInfoButton" type="button" onClick={()=>setResult(null)}>Затвори</button></div>
 </InfoDialog>:feature!==null?<InfoDialog title={features[feature].title} onClose={()=>setFeature(null)}>
  <span className="eaInfoKicker">E&A / VEHICLE INTELLIGENCE</span>
  <h2>{features[feature].title}</h2><p>{features[feature].details}</p>
  <span className="eaInfoDialogSmall">Информационен преглед. Реалните VIN справки изискват допълнителен доставчик на данни.</span>
  <div className="eaInfoDialogActions"><button type="button" className="eaInfoPrimary" onClick={()=>setFeature(null)}>Разбрах <InfoIcon name="check" size={17}/></button></div>
 </InfoDialog>:undefined;
 return <EaInfoShell kind="history" eyebrow="E&A · VEHICLE INTELLIGENCE" title="ИСТОРИЯ НА" accent="АВТОМОБИЛ" description="Провери идентификация, документи, пробег и рискови сигнали преди наддаване." footer={<a href="/vehicles">Виж автомобилите <InfoIcon name="arrow" size={15}/></a>} dialog={dialog}>
  <section className="eaInfoPanel eaInfoHistorySearch">
   <div><span className="eaInfoKicker">VIN ПРОВЕРКА</span><h2 className="eaInfoPanelTitle">Провери автомобил по VIN</h2><p className="eaInfoMuted">Провери формата на VIN и виж какво ще включва бъдещият отчет.</p></div>
   <form className="eaInfoVinForm" onSubmit={submit}>
    <label htmlFor="ea-history-vin">VIN номер (17 символа)</label>
    <div className="eaInfoVinRow"><input id="ea-history-vin" value={vin} onChange={e=>{setVin(e.target.value.toUpperCase());setError("");}} autoComplete="off" maxLength={17} placeholder="WAUZZZ8V5KA123456" aria-invalid={!!error}/><button className="eaInfoPrimary" type="submit"><InfoIcon name="search" size={17}/> Провери</button></div>
    <small role="status">{error||"ДЕМО: само проверка на формат · няма връзка с реална VIN база."}</small>
   </form>
   <div className="eaInfoHistoryTip"><InfoIcon name="shield" size={20}/><span>Не показваме измислени данни за щети, пробег или собственици като истински.</span></div>
  </section>
  <section className="eaInfoPanel eaInfoFeaturePanel">
   <h2 className="eaInfoPanelTitle">Какво показва автомобилната история?</h2>
   <div className="eaInfoFeatureGrid">{features.map((item,i)=><button className="eaInfoTile" type="button" key={item.title} onClick={()=>setFeature(i)}><InfoIcon name={item.icon} size={25}/><span className="eaInfoTileText"><strong>{item.title}</strong><small>{item.description}</small></span><InfoIcon name="next" size={16}/></button>)}</div>
   <p className="eaInfoDemoFlag">* Обхватът на бъдещия отчет зависи от наличните и лицензирани източници.</p>
  </section>
 </EaInfoShell>;
}
