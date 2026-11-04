"use client";
import {useMemo,useState} from "react";
import {marketConfig,sections} from "./data";
import MasterPlanBlocks from "./MasterPlanBlocks";
import "./business-plan.css";

type Market=keyof typeof marketConfig;
type Channel="meta"|"search"|"youtube"|"tiktok";
type Spend=Record<Channel,number>;
const channels:Channel[]=["meta","search","youtube","tiktok"];
const title:Record<Channel,string>={meta:"Facebook + Instagram",search:"Google Search",youtube:"YouTube + Shorts",tiktok:"TikTok"};
const channelDescription:Record<Channel,string>={meta:"Един Meta Ads бюджет — разделен между Facebook и Instagram.",search:"Покупка на клик при търсене с намерение.",youtube:"Видео реклама през Google Ads; не AdSense.",tiktok:"Видео тест при реално допустим минимален бюджет."};
const range=(p:[number,number])=>p[0]===p[1]?eur(p[0]):eur(p[0])+" – "+eur(p[1]);
function eur(v:number){return new Intl.NumberFormat("bg-BG",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);}
function num(v:number){return new Intl.NumberFormat("bg-BG",{maximumFractionDigits:0}).format(Math.round(v));}
function clamp(x:number){return Number.isFinite(x)?Math.max(0,Math.min(1000000,x)):0;}
function CurrencyField({label,value,onChange,small}:{label:string;value:number;onChange:(n:number)=>void;small?:string}){
 return <label className="bp-field"><span>{label}</span><input aria-label={label} type="number" min="0" max="1000000" step="10" value={value} onChange={e=>onChange(clamp(Number(e.target.value)))}/>{small&&<small>{small}</small>}</label>;
}

function project(spend:Spend,market:Market,ctr:number,cv:number,qual:number,close:number){
 const cfg=marketConfig[market];
 return channels.map(ch=>{
  const budget=spend[ch], cpc=ch==="search"?cfg.cpc.search:null, cpm=ch!=="search"?cfg.cpm[ch]:null;
  const lowImpr=cpm?budget/cpm[1]*1000:0, highImpr=cpm?budget/cpm[0]*1000:0;
  const lowClicks=cpc?budget/cpc[1]:lowImpr*ctr*0.65/100;
  const highClicks=cpc?budget/cpc[0]:highImpr*ctr*1.35/100;
  const channelCv=ch==="youtube"||ch==="tiktok"?cv*.3:cv;
  const lowLeads=lowClicks*channelCv*.55/100,highLeads=highClicks*channelCv*1.45/100;
  return {ch,budget,lowImpr,highImpr,lowClicks,highClicks,lowLeads,highLeads,lowQualified:lowLeads*qual/100,highQualified:highLeads*qual/100,lowDealers:lowLeads*qual*close/10000,highDealers:highLeads*qual*close/10000};
 });
}
export default function BusinessPlanPage(){
 const [selected,setSelected]=useState("02");
 const [market,setMarket]=useState<Market>("BG");
 const [level,setLevel]=useState("pilot");
 const [spend,setSpend]=useState<Spend>({...marketConfig.BG.defaultSpend});
 const [metaFb,setMetaFb]=useState(55);
 const [videos,setVideos]=useState(6);
 const [videoCost,setVideoCost]=useState(130);
 const [sales,setSales]=useState(1);
 const [support,setSupport]=useState(1);
 const [marketers,setMarketers]=useState(1);
 const [seo,setSeo]=useState(250);
 const [crm,setCrm]=useState(110);
 const [phone,setPhone]=useState(80);
 const [ctr,setCtr]=useState(1);
 const [conversion,setConversion]=useState(3);
 const [qualified,setQualified]=useState(40);
 const [close,setClose]=useState(20);
 const [workspaceAnnual,setWorkspaceAnnual]=useState(true);
 const [creativeAds,setCreativeAds]=useState({facebook:3,instagram:3,search:4,youtube:2,tiktok:2});
 const section=sections.find(s=>s.id===selected)||sections[1];
 const cfg=marketConfig[market];
 const adMonthly=channels.reduce((n,ch)=>n+spend[ch],0);
 const staffCost=sales*cfg.staff.sales+support*cfg.staff.support+marketers*cfg.staff.marketing;
 const seats=sales+support+marketers+2;
 const workspaceCost=seats*(workspaceAnnual?6.8:8.1);
 const creativeCost=videos*videoCost;
 const toolsCost=seo+crm+phone+workspaceCost;
 const total=adMonthly+staffCost+creativeCost+toolsCost;
 const projections=useMemo(()=>project(spend,market,ctr,conversion,qualified,close),[spend,market,ctr,conversion,qualified,close]);
 const lowImpr=projections.reduce((n,p)=>n+p.lowImpr,0);
 const highImpr=projections.reduce((n,p)=>n+p.highImpr,0);
 const lowClicks=projections.reduce((n,p)=>n+p.lowClicks,0);
 const highClicks=projections.reduce((n,p)=>n+p.highClicks,0);
 const lowLeads=projections.reduce((n,p)=>n+p.lowLeads,0);
 const highLeads=projections.reduce((n,p)=>n+p.highLeads,0);
 const lowQualified=projections.reduce((n,p)=>n+p.lowQualified,0);
 const highQualified=projections.reduce((n,p)=>n+p.highQualified,0);
 const lowDealers=projections.reduce((n,p)=>n+p.lowDealers,0);
 const highDealers=projections.reduce((n,p)=>n+p.highDealers,0);
 const setPreset=(m:Market,lv:string)=>{
  const mult=lv==="growth"?2.5:lv==="scale"?6:1;const vals=marketConfig[m].defaultSpend;
  setMarket(m);setLevel(lv);setSpend({meta:Math.round(vals.meta*mult),search:Math.round(vals.search*mult),youtube:Math.round(vals.youtube*mult),tiktok:Math.round(vals.tiktok*mult)});
  setVideoCost(marketConfig[m].video);setVideos(lv==="pilot"?6:lv==="growth"?12:20);
 };
 const download=()=>{
  const data=[["Категория","Месечно EUR"],...channels.map(ch=>[title[ch],String(spend[ch])]),["Видео/Reels",String(creativeCost)],["Google Workspace",workspaceCost.toFixed(2)],["SEO",String(seo)],["CRM",String(crm)],["Телефония",String(phone)],["Sales",String(sales*cfg.staff.sales)],["Support",String(support*cfg.staff.support)],["Маркетинг персонал",String(marketers*cfg.staff.marketing)],["ОБЩО",total.toFixed(2)],["Показвания минимум (модел)",Math.round(lowImpr).toString()],["Показвания максимум (модел)",Math.round(highImpr).toString()],["Лийдове минимум (модел)",lowLeads.toFixed(1)],["Лийдове максимум (модел)",highLeads.toFixed(1)]];
  const csv="\uFEFF"+data.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");
  const a=document.createElement("a");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="enchev-marketing-plan-"+market.toLowerCase()+".csv";a.click();URL.revokeObjectURL(url);
 };
 const choose=(id:string)=>{setSelected(id);document.getElementById("bp-detail")?.scrollIntoView({behavior:"smooth",block:"start"});};
 return <main id="main-content" className="bp" lang="bg">
  <div className="bp-container">
   <div className="bp-top"><div><span className="bp-overline">E&A EAST WEST AUCTIONEERS GROUP</span><h1>Бизнес план <em>&</em> услуги</h1><p>16 раздела → услуги → задачи → труд Митко и Борко → всички наши екипи → обща цена за България и Европа.</p></div><a className="bp-back" href="/">← Начална страница</a></div>
   <div className="bp-truth"><strong>ИНВЕСТИЦИОНЕН ПЛАН · НЕ Е ОФЕРТА</strong><span>Всички бюджети са ориентировъчни без ДДС. Трудът на едни и същи хора не се начислява повторно между разделите. Реалните цени се определят след техническо задание и доставни оферти.</span></div>
   <div className="bp-summary">
    <div><span>ОБЛАСТИ</span><b>16</b><small>Бизнес и технологии</small></div>
    <div><span>ГЕОГРАФИЯ</span><b>BG → ES → EU</b><small>Старт по доказани етапи</small></div>
    <div><span>ЦЕЛ 2029</span><b>40 млн. €</b><small>Агресивна цел, не прогноза</small></div>
    <div><span>REAL-MONEY</span><b className="bp-warning">NO-GO</b><small>D003 и правни проверки</small></div>
   </div>
   <div className="bp-section-header"><div><span className="bp-overline">01 / НАПРАВЛЕНИЯ</span><h2>Целият бизнес план</h2><p>Избери карта, за да видиш дейности, предложени цени, екипи и етапи.</p></div><span className="bp-counter">16 СЕКЦИИ</span></div>
   <div className="bp-cards">{sections.map(s=><button className={"bp-card "+(selected===s.id?"is-selected":"")} key={s.id} onClick={()=>choose(s.id)} aria-pressed={selected===s.id}><span className="bp-card-top"><span className="bp-card-icon">{s.icon}</span><small>{s.id}/16</small></span><strong>{s.title}</strong><span className="bp-card-tag">{s.tagline}</span><span className="bp-card-arrow">ОТВОРИ <b>↗</b></span></button>)}</div>
   <section id="bp-detail" className="bp-detail">
    <div className="bp-section-header"><div><span className="bp-overline">РАЗДЕЛ {section.id} / 16</span><h2>{section.title}</h2><p>{section.goal}</p></div><span className="bp-detail-icon">{section.icon}</span></div>
    <div className="bp-detail-grid"><div className="bp-panel"><h3>Необходими хора</h3><div className="bp-chips">{section.team.map(t=><span key={t}>{t}</span>)}</div></div><div className="bp-panel"><h3>Последователност</h3><ol>{section.steps.map((x,i)=><li key={i}>{x}</li>)}</ol></div></div>
    <MasterPlanBlocks selected={section} marketing={{adMonthly,creativeCost,toolsCost,staffCost,sales,support,marketers,market}} onMarket={m=>setPreset(m,level)}/>
   </section>
   {selected==="02"&&<section id="bp-marketing" className="bp-marketing" aria-label="Интерактивен маркетинг калкулатор">
    <div className="bp-section-header"><div><span className="bp-overline">MARKETING INTELLIGENCE</span><h2>Маркетинг калкулатор</h2><p>Редактирай бюджетите и виж моделни показвания, кликове, лийдове, потенциални дилъри и общ месечен разход.</p></div><button className="bp-export" onClick={download}>↓ Свали CSV</button></div>
    <div className="bp-market-bar"><div><label htmlFor="bp-market">ПАЗАР</label><select id="bp-market" value={market} onChange={e=>setPreset(e.target.value as Market,level)}><option value="BG">България</option><option value="ES">Испания</option><option value="EU">Международно / ЕС</option></select></div><div><label htmlFor="bp-level">МАЩАБ</label><select id="bp-level" value={level} onChange={e=>setPreset(market,e.target.value)}><option value="pilot">Пилот</option><option value="growth">Развитие ×2,5</option><option value="scale">Мащаб ×6</option></select></div><p>Сумите в полетата може да се редактират. Не са текущи данни от Ads Manager.</p></div>
    <div className="bp-ad-grid">{channels.map(ch=><div className="bp-ad-card" key={ch}><div className="bp-ad-title"><b>{title[ch]}</b><span>{ch==="meta"?"META":ch==="search"?"SEARCH":ch==="youtube"?"VIDEO":"SOCIAL"}</span></div><p>{channelDescription[ch]}</p><CurrencyField label="Рекламен бюджет / месец (€)" value={spend[ch]} onChange={v=>setSpend(s=>({...s,[ch]:v}))}/><div className="bp-miniresult"><span>{ch==="search"?"Моделни кликове":"Моделни показвания"}</span><strong>{ch==="search"?num(projections.find(x=>x.ch===ch)!.lowClicks)+" – "+num(projections.find(x=>x.ch===ch)!.highClicks):num(projections.find(x=>x.ch===ch)!.lowImpr)+" – "+num(projections.find(x=>x.ch===ch)!.highImpr)}</strong></div>{ch!=="search"&&<div className="bp-miniresult bp-reach"><span>Моделни достигнати профили* (само този канал)</span><strong>{num(projections.find(x=>x.ch===ch)!.lowImpr/3)} – {num(projections.find(x=>x.ch===ch)!.highImpr/1.5)}</strong></div>}{ch==="meta"&&<div className="bp-split"><span>Facebook {metaFb}% · Instagram {100-metaFb}%</span><input type="range" min="0" max="100" value={metaFb} onChange={e=>setMetaFb(Number(e.target.value))}/><small>FB: {eur(spend.meta*metaFb/100)} · IG: {eur(spend.meta*(100-metaFb)/100)}</small></div>}{ch==="tiktok"&&spend.tiktok>0&&spend.tiktok<750&&<small className="bp-caution">Провери минималния бюджет: TikTok обичайно изисква над $50/ден на ниво кампания. Малък месечен бюджет може да не стартира.</small>}</div>)}</div>
    <div className="bp-detail-grid">
     <div className="bp-panel"><h3>Колко реклами подготвяме?</h3><p className="bp-muted">Примерни активни варианти на креативи и текстове, не автоматично включени рекламни кампании.</p><div className="bp-fields-2">{(Object.keys(creativeAds) as (keyof typeof creativeAds)[]).map(ch=><CurrencyField key={ch} label={{facebook:"Facebook реклами",instagram:"Instagram реклами",search:"Google Search реклами",youtube:"YouTube видеореклами",tiktok:"TikTok видеореклами"}[ch]} value={creativeAds[ch]} onChange={v=>setCreativeAds(s=>({...s,[ch]:Math.min(99,Math.round(v))}))}/>)}</div><strong className="bp-muted">Общо рекламни варианта: {Object.values(creativeAds).reduce((a,b)=>a+b,0)}</strong></div>
     <div className="bp-panel"><h3>Видео / Reels / Shorts</h3><p className="bp-muted">Брой реално произведени видеа × цена на монтаж и производство.</p><div className="bp-fields-2"><CurrencyField label="Видеа / месец" value={videos} onChange={v=>setVideos(Math.min(200,v))}/><CurrencyField label="Цена на видео (€)" value={videoCost} onChange={setVideoCost}/></div><div className="bp-miniresult"><span>Креативно производство / месец</span><strong>{eur(creativeCost)}</strong></div><small className="bp-muted">Ориентир: 10–30 сек Reels, 30–60 сек представяне на услуга, кратки видео от реален търг; индивидуални оферти са необходими за 3D и пълно заснемане.</small></div>
    </div>
    <div className="bp-detail-grid">
     <div className="bp-panel"><h3>Нашите хора — включени в калкулацията</h3><p className="bp-muted">Бюджетни месечни разходи за екип, не гарантирани заплати. Сумата НЕ се прибавя отново в Sales, HR или Support.</p><div className="bp-fields-2"><CurrencyField label="B2B Sales хора" value={sales} onChange={v=>setSales(Math.min(100,v))}/><CurrencyField label="Support оператори" value={support} onChange={v=>setSupport(Math.min(100,v))}/><CurrencyField label="Маркетинг хора" value={marketers} onChange={v=>setMarketers(Math.min(100,v))}/></div><div className="bp-miniresult"><span>Общ труд / месец (план)</span><strong>{eur(staffCost)}</strong></div></div>
     <div className="bp-panel"><h3>Google, CRM и маркетинг инструменти</h3><div className="bp-google"><span>Google Business Profile</span><b>БЕЗПЛАТНО*</b></div><p className="bp-muted">*При допустим реален локален бизнес; не всеки чисто онлайн marketplace има право на Business Profile.</p><label className="bp-check"><input type="checkbox" checked={workspaceAnnual} onChange={e=>setWorkspaceAnnual(e.target.checked)}/> Workspace Starter — годишен план (€6,80 вместо €8,10/акаунт месечно)</label><div className="bp-google"><span>Google Workspace · {seats} акаунта</span><b>{eur(workspaceCost)}/мес.</b></div><div className="bp-fields-2"><CurrencyField label="SEO / месец" value={seo} onChange={setSeo}/><CurrencyField label="CRM / месец" value={crm} onChange={setCrm}/><CurrencyField label="Телефония / месец" value={phone} onChange={setPhone}/></div><p className="bp-muted">Google AdSense е за получаване на приходи като издател, не за купуване на реклама. Рекламата в Google и YouTube се купува през Google Ads.</p></div>
    </div>
    <div className="bp-forecast-inputs"><h3>Промени допусканията за рекламния резултат</h3><p>Не са реални платформи данни. По подразбиране са сценарни стойности; диапазоните се изчисляват от CPM/CPC и условните конверсии.</p><div className="bp-fields-4"><CurrencyField label="CTR на визуалните реклами (%)" value={ctr} onChange={v=>setCtr(Math.min(20,v))}/><CurrencyField label="Конверсия клик → лийд (%)" value={conversion} onChange={v=>setConversion(Math.min(100,v))}/><CurrencyField label="Квалифицирани лийдове (%)" value={qualified} onChange={v=>setQualified(Math.min(100,v))}/><CurrencyField label="Клиенти от квалифицирани (%)" value={close} onChange={v=>setClose(Math.min(100,v))}/></div></div>
    <div className="bp-breakdown"><h3>Какво очакваме от всеки рекламен канал?</h3><div className="bp-table-scroll"><table><thead><tr><th>Платформа</th><th>Реклами / мес.</th><th>Показвания (модел)</th><th>Кликове (модел)</th><th>Контакти (модел)</th><th>Потенциални активирани фирми</th></tr></thead><tbody>{projections.map(p=><tr key={p.ch}><th>{title[p.ch]}</th><td>{eur(p.budget)}</td><td>{p.ch==="search"?"Няма CPM оценка":num(p.lowImpr)+" – "+num(p.highImpr)}</td><td>{num(p.lowClicks)} – {num(p.highClicks)}</td><td>{num(p.lowLeads)} – {num(p.highLeads)}</td><td>{p.lowDealers.toFixed(1)} – {p.highDealers.toFixed(1)}</td></tr>)}</tbody></table></div><p className="bp-muted">* Ориентировъчният reach за един визуален канал е показванията, разделени на допусната честота 1,5–3. Това не е доказан брой уникални хора; аудитории между Facebook, Instagram, YouTube и TikTok се припокриват. Search е CPC и е отчетен с кликове, без да измисляме CPM.</p></div>
    <div className="bp-results">
     <div><span>МЕСЕЧНА РЕКЛАМА</span><b>{eur(adMonthly)}</b><small>Само закупуване на реклами</small></div>
     <div><span>МОДЕЛНИ ПОКАЗВАНИЯ</span><b>{num(lowImpr)} – {num(highImpr)}</b><small>Meta + YouTube + TikTok; НЕ уникални хора</small></div>
     <div><span>МОДЕЛНИ КЛИКОВЕ</span><b>{num(lowClicks)} – {num(highClicks)}</b><small>Вкл. Google Search</small></div>
     <div><span>МОДЕЛНИ ЛИЙДОВЕ</span><b>{num(lowLeads)} – {num(highLeads)}</b><small>Контакти, НЕ сделки</small></div>
     <div><span>КВАЛИФИЦИРАНИ</span><b>{num(lowQualified)} – {num(highQualified)}</b><small>Изискват реална проверка</small></div>
     <div><span>ПОТЕНЦИАЛНИ АКТИВИРАНИ КЛИЕНТИ</span><b>{lowDealers.toFixed(1)} – {highDealers.toFixed(1)}</b><small>Теоретичен funnel; не гаранция</small></div>
    </div>
    <div className="bp-total"><div><span>ОБЩ МЕСЕЧЕН МАРКЕТИНГ И ЕКИПЕН БЮДЖЕТ</span><strong>{eur(total)}</strong><small>Реклами {eur(adMonthly)} + видео {eur(creativeCost)} + хора {eur(staffCost)} + инструменти {eur(toolsCost)}</small></div><div><span>12-МЕСЕЧЕН ЕКВИВАЛЕНТ</span><strong>{eur(total*12)}</strong><small>При непроменени условия; не е годишна оферта.</small></div></div>
    <div className="bp-advice"><b>Как се чете прогнозата?</b><p>Изчислените показвания са рекламни импресии, не уникални хора. Един човек може да види няколко реклами и да бъде преброен многократно в различни платформи. Не можем надеждно да сумираме уникален reach между Meta, TikTok и Google. Реалните стойности се получават от Ads Manager и GA4 след старта на кампаниите. Google Reach Planner и TikTok forecast инструментите също не гарантират резултат.</p></div>
    <div className="bp-evidence"><h3>Официални източници</h3><a href="https://business.google.com/en-all/business-profile/" target="_blank" rel="noreferrer">Google Business Profile — безплатно</a><a href="https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans" target="_blank" rel="noreferrer">Google Workspace — €6,80 / €8,10</a><a href="https://ads.tiktok.com/resources/help/article/budget" target="_blank" rel="noreferrer">TikTok — минимален рекламен бюджет</a><a href="https://support.google.com/adsense/answer/76231" target="_blank" rel="noreferrer">AdSense срещу Google Ads</a><a href="https://support.google.com/google-ads/answer/9427120" target="_blank" rel="noreferrer">YouTube Reach Planner</a></div>
   </section>}
   <section className="bp-roadmap"><span className="bp-overline">ОБЩ МАСТЕР ПЛАН</span><h2>От демо до истински международен бизнес</h2><div className="bp-steps"><article><span>0–90 дни</span><b>Пилот и доказателства</b><p>D003, правни проверки, 5–10 продавача, първи годни автомобили, реални цени.</p></article><article><span>90–180 дни</span><b>Работещи операции</b><p>Контролиран B2B пилот, CRM, външни превозвачи, измерени CAC и разходи.</p></article><article><span>180–365 дни</span><b>България + подготовка за Испания</b><p>Реални продажби, Country GO, плащания и повторяем инвентар.</p></article><article><span>2028–2029</span><b>Международно мащабиране</b><p>Екипи и услуги по търсене; собствен автовоз само след доказана печалба.</p></article></div></section>
   <footer className="bp-footer"><strong>E&A EAST WEST AUCTIONEERS GROUP</strong><span>Работен бизнес калкулатор · версия 1.0 · 04.11.2026</span><a href="/">← Към ENCHEV AUCTIONS</a></footer>
  </div>
 </main>;
}
