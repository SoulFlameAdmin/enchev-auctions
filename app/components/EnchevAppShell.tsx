"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { accountNavigation, primaryNavigation } from "../site-navigation";

function activeKey(pathname:string){
  if(pathname.startsWith("/inventory"))return "inventory";
  if(pathname.startsWith("/live-auctions"))return "live";
  if(pathname.startsWith("/transport"))return "transport";
  if(pathname.startsWith("/vehicle-history"))return "history";
  if(pathname.startsWith("/support"))return "support";
  return "";
}

export default function EnchevAppShell(){
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const closeRef=useRef<HTMLButtonElement>(null);
  const active=activeKey(pathname);

  useEffect(()=>{setOpen(false);},[pathname]);

  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const frame=window.requestAnimationFrame(()=>closeRef.current?.focus());
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape")setOpen(false);
    };
    window.addEventListener("keydown",onKey);
    return()=>{
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown",onKey);
      document.body.style.overflow=previous;
    };
  },[open]);

  return <div className="eaAppShell" data-design-task="DP2-04" data-shell-open={open?"true":"false"}>
    <div className="eaAppUtility">
      <div className="eaAppUtilityLive"><i aria-hidden="true"/><strong>ENCHEV LIVE MARKET</strong><span>Международни автомобилни търгове</span></div>
      <div className="eaAppUtilityMeta"><span>BG · EUR</span><a href="/support">Помощ</a><span>Europe · USA · Canada</span></div>
    </div>

    <header className="eaAppHeader">
      <a href="/" className="eaAppBrand" aria-label="ENCHEV Auctions начало">
        <strong>ENCHEV</strong><span>AUCTIONS</span>
      </a>

      <form className="eaAppSearch" action="/inventory" role="search">
        <span aria-hidden="true">⌕</span>
        <input name="q" type="search" placeholder="Марка, модел, VIN, LOT..." aria-label="Търси автомобили"/>
      </form>

      <nav className="eaAppDesktopNav" aria-label="Основна навигация">
        {primaryNavigation.map(item=><a
          key={item.key}
          href={item.href}
          className={item.key==="live"?"is-live":undefined}
          aria-current={active===item.key?"page":undefined}
        >{item.label}</a>)}
      </nav>

      <div className="eaAppAccount">
        <a className="eaAppAccountGhost" href={accountNavigation.profile}>Вход / Профил</a>
        <a className="eaAppAccountPrimary" href={accountNavigation.register}>Регистрация</a>
      </div>

      <button
        className="eaAppMenuButton"
        type="button"
        aria-expanded={open}
        aria-controls="ea-mobile-navigation"
        aria-label={open?"Затвори менюто":"Отвори менюто"}
        onClick={()=>setOpen(value=>!value)}
      >
        <span/><span/><span/>
      </button>
    </header>

    <div className={`eaAppMobileLayer ${open?"is-open":""}`} aria-hidden={!open}>
      <button className="eaAppMobileBackdrop" type="button" tabIndex={open?0:-1} aria-label="Затвори менюто" onClick={()=>setOpen(false)}/>
      <aside id="ea-mobile-navigation" className="eaAppMobileDrawer" role="dialog" aria-modal="true" aria-label="Мобилна навигация">
        <div className="eaAppMobileTop">
          <a href="/" className="eaAppBrand" aria-label="ENCHEV Auctions начало"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
          <button ref={closeRef} className="eaAppMobileClose" type="button" onClick={()=>setOpen(false)} aria-label="Затвори менюто">×</button>
        </div>

        <form className="eaAppMobileSearch" action="/inventory" role="search">
          <span aria-hidden="true">⌕</span>
          <input name="q" type="search" placeholder="Търси автомобил..." aria-label="Търси автомобили"/>
          <button type="submit">Търси</button>
        </form>

        <div className="eaAppMobileLive"><i aria-hidden="true"/><div><strong>LIVE MARKET</strong><span>Следи текущия търг в реално време</span></div></div>

        <nav className="eaAppMobileNav" aria-label="Мобилна основна навигация">
          {primaryNavigation.map((item,index)=><a
            key={item.key}
            href={item.href}
            className={item.key==="live"?"is-live":undefined}
            aria-current={active===item.key?"page":undefined}
          ><span>{String(index+1).padStart(2,"0")}</span><b>{item.label}</b><i aria-hidden="true">→</i></a>)}
        </nav>

        <div className="eaAppMobileAccount">
          <a href={accountNavigation.profile}>Вход / Профил</a>
          <a href={accountNavigation.register}>Регистрация</a>
        </div>

        <div className="eaAppMobileFoot"><span>BG · EUR</span><a href="/support">Помощ и поддръжка</a></div>
      </aside>
    </div>
  </div>;
}
