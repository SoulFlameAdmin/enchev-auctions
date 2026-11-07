"use client";
import {useEffect,useState,type ReactNode} from "react";
import EaOfficialLogo from "./EaOfficialLogo";
import "../buyer-info.css";

type PageKind="history"|"transport"|"support";
export const infoPaths={
 car:"M4 16h16l-2-7H6zM7 9l1-4h8l1 4M5 16v3m14-3v3",
 live:"M12 12h.01M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 0 0 14",
 history:"M4 7V4h5M4 4l3 3M4 12a8 8 0 1 0 3-6M9 12h3l2 2",
 transport:"M3 5h12v11H3zM15 9h4l3 4v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
 help:"M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v7H4zM17 13h3v7h-3zM17 21h-4",
 shield:"m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6zM8 12l3 3 5-6",
 search:"M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm6 14 5 5",
 check:"M5 12l4 4 10-10",
 arrow:"M5 12h14m-6-6 6 6-6 6",
 next:"m9 18 6-6-6-6",
 sun:"M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 moon:"M20 15.7A8.8 8.8 0 0 1 8.3 4 8.8 8.8 0 1 0 20 15.7Z",
 user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2",
 x:"M5 5l14 14M19 5 5 19",
 file:"M6 2h9l5 5v15H6zM15 2v5h5M9 12h8M9 16h8",
 time:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
 globe:"M3 12h18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-6 7-6 11 0 18m0-18c6 7 6 11 0 18",
 card:"M3 5h18v14H3zM3 10h18M7 15h4",
 message:"M3 4h18v13H8l-5 4zM7 9h10M7 13h8",
 pin:"M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
 flag:"M5 3v19M5 4h14l-3 5 3 5H5",
 info:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v5m0-9h.01"
} as const;
export type InfoIconName=keyof typeof infoPaths;
export function InfoIcon({name,size=22}:{name:InfoIconName;size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={infoPaths[name]}/></svg>;
}
export function InfoDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[onClose]);
 return <div className="eaInfoBackdrop" role="presentation" onClick={onClose}>
  <section className="eaInfoDialog" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
   <button type="button" className="eaInfoDialogClose" onClick={onClose} aria-label="Затвори"><InfoIcon name="x" size={21}/></button>
   {children}
  </section>
 </div>;
}
const menus=[
 {href:"/",name:"Начало",mobile:"Начало"},
 {href:"/vehicles",name:"Автомобили",mobile:"Автомобили"},
 {href:"/auctions",name:"LIVE търгове",mobile:"LIVE"},
 {href:"/start",name:"Как се купува",mobile:"Как се купува"},
 {href:"/vehicle-history",name:"История",mobile:"История"},
 {href:"/transport",name:"Транспорт",mobile:"Транспорт"},
 {href:"/support",name:"Поддръжка",mobile:"Поддръжка"}
];
export default function EaInfoShell({kind,eyebrow,title,accent,description,children,footer,dialog}:{kind:PageKind;eyebrow:string;title:string;accent:string;description:string;children:ReactNode;footer?:ReactNode;dialog?:ReactNode}){
 const [appearance,setAppearance]=useState<"dark"|"light">("dark");
 useEffect(()=>{
  try{const saved=localStorage.getItem("ea-vehicles-appearance-v1");if(saved==="light"||saved==="dark")setAppearance(saved);}catch{}
  const prevHtml=document.documentElement.style.overflow,prevBody=document.body.style.overflow;
  document.documentElement.style.overflow="hidden";
  document.body.style.overflow="hidden";
  return()=>{document.documentElement.style.overflow=prevHtml;document.body.style.overflow=prevBody;};
 },[]);
 function toggleTheme(){
  const next=appearance==="dark"?"light":"dark";
  setAppearance(next);
  try{localStorage.setItem("ea-vehicles-appearance-v1",next);}catch{}
 }
 return <main id="main-content" className={"eaInfoViewport eaInfo-"+kind} data-appearance={appearance}>
  <div className="eaInfoShell">
   <header className="eaInfoHeader">
    <a href="/" className="eaInfoBrand" aria-label="E&A Начало"><EaOfficialLogo/></a>
    <nav className="eaInfoDesktopNav" aria-label="Навигация">
     {menus.map(item=><a href={item.href} key={item.href} className={item.href==="/"+(kind==="history"?"vehicle-history":kind)?"active":""}>{item.name}</a>)}
    </nav>
    <div className="eaInfoTools">
     <button className="eaInfoTheme" type="button" onClick={toggleTheme} aria-label={appearance==="dark"?"Включи бял режим":"Включи черен режим"}><InfoIcon name={appearance==="dark"?"sun":"moon"} size={18}/></button>
     <a href="/login" aria-label="Вход в профила"><InfoIcon name="user" size={20}/></a>
    </div>
   </header>
   <nav className="eaInfoMobileNav" aria-label="Мобилна навигация">
    <a href="/vehicles"><InfoIcon name="car" size={15}/> Автомобили</a>
    <a href="/auctions" className="eaInfoLive"><InfoIcon name="live" size={15}/> LIVE</a>
    <a href="/start">Как се купува</a>
    <span className="eaInfoHere">{kind==="history"?"История":kind==="transport"?"Транспорт":"Поддръжка"}</span>
   </nav>
   <section className="eaInfoHero">
    <div className="eaInfoHeroCopy"><span className="eaInfoEyebrow">{eyebrow}</span><h1>{title}<br/><em>{accent}</em></h1><p>{description}</p></div>
    <span className="eaInfoHeroStamp">E&A · EAST AND WEST AUCTIONEERS GROUP</span>
   </section>
   <div className="eaInfoBody">{children}</div>
   <footer className="eaInfoFooter"><span>© E&A EAST AND WEST AUCTIONEERS GROUP · Демо данните са ясно обозначени.</span>{footer}</footer>
  </div>
  {dialog}
 </main>;
}
