"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {usePathname} from "next/navigation";
import EaOfficialLogo from "./EaOfficialLogo";

type IconName="home"|"car"|"live"|"steps"|"history"|"truck"|"support"|"login"|"register"|"admin"|"user";
const icons:Record<IconName,string>={
 home:"M3 10.4 12 3l9 7.4V21h-6v-7H9v7H3z",
 car:"M4 16h16l-1.4-6.3A2 2 0 0 0 16.7 8H7.3a2 2 0 0 0-1.9 1.7z M5 16v3m14-3v3M4 12h16M7 8l1.2-3h7.6L17 8",
 live:"M12 12h.01M8.2 8.2a5.5 5.5 0 0 0 0 7.6m7.6-7.6a5.5 5.5 0 0 1 0 7.6M5.5 5.5a9.2 9.2 0 0 0 0 13m13-13a9.2 9.2 0 0 1 0 13",
 steps:"m4 6 2 2 3-4m3 3h9M4 14l2 2 3-4m3 3h9M4 21h17",
 history:"M4 7V4h5M4 4l3 3M4 12a8 8 0 1 0 3-6M9 12h3l2 2",
 truck:"M3 5h12v11H3zM15 9h4l3 4v3h-7M7.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
 support:"M4 12a8 8 0 0 1 16 0v6a3 3 0 0 1-3 3h-2M3 12v6h4v-6H3Zm14 0v6h4v-6h-4Z",
 login:"M10 4H5v16h5m4-4 4-4-4-4m-9 4h13",
 register:"M13 21H4v-3a6 6 0 0 1 12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 3v8m-4-4h8",
 admin:"M5 11V8a7 7 0 0 1 14 0v3M4 11h16v10H4zM12 15v3",
 user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2"
};
function MenuIcon({name}:{name:IconName}){
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]}/></svg>;
}
const sections:{label:string;href:string;icon:IconName}[]=[
 {label:"Начало",href:"/",icon:"home"},
 {label:"Автомобили",href:"/vehicles",icon:"car"},
 {label:"Търгове на живо",href:"/auctions",icon:"live"},
 {label:"Как се купува",href:"/start",icon:"steps"},
 {label:"История на автомобил",href:"/vehicle-history",icon:"history"},
 {label:"Транспорт",href:"/transport",icon:"truck"},
 {label:"Поддръжка",href:"/support",icon:"support"}
];
export default function EaUnifiedMenu(){
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const [adminForm,setAdminForm]=useState(false);
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const closeRef=useRef<HTMLButtonElement>(null);
 const passwordRef=useRef<HTMLInputElement>(null);
 const hidden=pathname.startsWith("/admin/");

 useEffect(()=>{setOpen(false);setAdminForm(false);setPassword("");setError("");},[pathname]);
 useEffect(()=>{
  if(!open)return;
  const original=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const timer=requestAnimationFrame(()=>closeRef.current?.focus());
  const handle=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();if(adminForm){setAdminForm(false);setPassword("");setError("");}else setOpen(false);}
   if(event.key==="Tab"){
    const dialog=document.getElementById("ea-unified-drawer");
    if(!dialog)return;
    const focusable=Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])')).filter(node=>node.getClientRects().length>0);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  window.addEventListener("keydown",handle);
  return()=>{document.body.style.overflow=original;cancelAnimationFrame(timer);window.removeEventListener("keydown",handle);};
 },[open,adminForm]);
 useEffect(()=>{if(open&&adminForm)passwordRef.current?.focus();},[open,adminForm]);

 async function chooseAdmin(){
  setError("");setPassword("");
  try{
   const response=await fetch("/api/menu-access",{cache:"no-store",credentials:"same-origin"});
   const data=await response.json();
   if(response.ok&&data.authorized===true){window.location.assign("/admin/console");return;}
  }catch{}
  setAdminForm(true);
 }
 async function enterAdmin(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!password||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/menu-access",{
    method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
    body:JSON.stringify({password})
   });
   const data=await response.json();
   if(!response.ok||data.authorized!==true){
    setError(response.status===503?"Администраторската парола не е конфигурирана на сървъра.":response.status===429?"Твърде много опити. Опитай по-късно.":"Неправилна парола.");
    return;
   }
   setPassword("");
   window.location.assign("/admin/console");
  }catch{setError("Няма връзка със сървъра. Опитай отново.");}
  finally{setBusy(false);}
 }
 if(hidden)return null;
 return <>
   <button className="eaUnifiedTrigger" type="button" aria-label="Отвори главното меню" aria-expanded={open} aria-controls="ea-unified-drawer" onClick={()=>setOpen(true)}>
    <span/><span/><span/>
   </button>
   {open&&<>
    <button className="eaUnifiedBackdrop" aria-label="Затвори главното меню" type="button" onClick={()=>setOpen(false)}/>
    <aside id="ea-unified-drawer" className="eaUnifiedDrawer" role="dialog" aria-modal="true" aria-label="Главно меню на ENCHEV AUCTIONS">
     <header className="eaUnifiedHeader">
       <a href="/" className="eaUnifiedBrand" aria-label="E&A — Начало"><EaOfficialLogo /></a>
       <div className="eaUnifiedHeaderActions">
         <a href="/profile" aria-label="Моят профил"><MenuIcon name="user"/></a>
         <button ref={closeRef} type="button" aria-label="Затвори менюто" onClick={()=>setOpen(false)}>×</button>
       </div>
     </header>
     {adminForm?<div className="eaUnifiedAdmin">
       <button type="button" className="eaUnifiedBack" onClick={()=>{setAdminForm(false);setPassword("");setError("");}}>← Назад към менюто</button>
       <MenuIcon name="admin"/>
       <h2>Администраторски достъп</h2>
       <p>Въведи паролата, за да отвориш защитения център за управление.</p>
       <form onSubmit={enterAdmin}>
         <label htmlFor="ea-unified-admin-password">Парола</label>
         <input ref={passwordRef} id="ea-unified-admin-password" type="password" autoComplete="current-password" minLength={1} maxLength={256} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Администраторска парола"/>
         <button type="submit" disabled={busy}>{busy?"Проверка…":"ОТКЛЮЧИ АДМИН"}</button>
         {error&&<p role="alert" className="eaUnifiedError">{error}</p>}
       </form>
       <a className="eaUnifiedGoogle" href="/api/admin/google">Защитен Google вход за администратори</a>
      </div>:<>
       <div className="eaUnifiedLabel">ГЛАВНО МЕНЮ</div>
       <nav className="eaUnifiedLinks" aria-label="Главна навигация">
       {sections.map(item=><a key={item.href} href={item.href} className={item.icon==="live"?"is-live":""} aria-current={pathname===item.href?"page":undefined}>
         <MenuIcon name={item.icon}/><span>{item.label}</span><b aria-hidden="true">›</b>
       </a>)}
       </nav>
       <div className="eaUnifiedFooter">
        <div className="eaUnifiedAccounts">
         <a href="/login"><MenuIcon name="login"/>Вход</a>
         <a href="/register"><MenuIcon name="register"/>Регистрация</a>
        </div>
        <button className="eaUnifiedAdminButton" type="button" onClick={()=>{void chooseAdmin();}}><MenuIcon name="admin"/> <span>АДМИН</span><b aria-hidden="true">›</b></button>
        <p>© E&A EAST AND WEST AUCTIONEERS GROUP · SOULFLAME</p>
       </div>
      </>}
    </aside>
   </>}
 </>;
}
