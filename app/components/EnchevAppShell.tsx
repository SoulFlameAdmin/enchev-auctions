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

  if(pathname==="/")return null;

  return <div className="eaAppShell" data-design-task="DP2-04" data-shell-open={open?"true":"false"}>
    <div className="eaAppUtility">
      <div className="eaAppUtilityLive"><i aria-hidden="true"/><strong>LIVE MARKET</strong><span>Europe · USA · Canada</span><a className="eaAppPresentationButton" href="/presentation">PRESENTATION</a></div>
      <div className="eaAppUtilityMeta"><span>BG · EUR</span><a href="/support">Help</a></div>
    </div>

    <header className="eaAppHeader">
      <a href="/" className="eaAppBrand" aria-label="ENCHEV Auctions home">
        <strong>ENCHEV</strong><span>AUCTIONS</span>
      </a>

      <form className="eaAppSearch" action="/inventory" role="search">
        <span aria-hidden="true">⌕</span>
        <input name="q" type="search" placeholder="Make, model, VIN, LOT..." aria-label="Search vehicles"/>
      </form>

      <nav className="eaAppDesktopNav" aria-label="Main navigation">
        {primaryNavigation.map(item=><a
          key={item.key}
          href={item.href}
          className={item.key==="live"?"is-live":undefined}
          aria-current={active===item.key?"page":undefined}
        >{item.label}</a>)}
      </nav>

      <div className="eaAppAccount">
        <a className="eaAppAccountGhost" href={accountNavigation.profile}>Login / Profile</a>
        <a className="eaAppAccountPrimary" href={accountNavigation.register}>Register</a>
      </div>

      <button
        className="eaAppMenuButton"
        type="button"
        aria-expanded={open}
        aria-controls="ea-mobile-navigation"
        aria-label={open?"Close menu":"Open menu"}
        onClick={()=>setOpen(value=>!value)}
      >
        <span/><span/><span/>
      </button>
    </header>

    <div className={`eaAppMobileLayer ${open?"is-open":""}`} aria-hidden={!open}>
      <button className="eaAppMobileBackdrop" type="button" tabIndex={open?0:-1} aria-label="Close menu" onClick={()=>setOpen(false)}/>
      <aside id="ea-mobile-navigation" className="eaAppMobileDrawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <div className="eaAppMobileTop">
          <a href="/" className="eaAppBrand" aria-label="ENCHEV Auctions home"><strong>ENCHEV</strong><span>AUCTIONS</span></a>
          <button ref={closeRef} className="eaAppMobileClose" type="button" onClick={()=>setOpen(false)} aria-label="Close menu">×</button>
        </div>

        <form className="eaAppMobileSearch" action="/inventory" role="search">
          <span aria-hidden="true">⌕</span>
          <input name="q" type="search" placeholder="Search vehicle..." aria-label="Search vehicles"/>
          <button type="submit">Search</button>
        </form>

        <div className="eaAppMobileLive"><i aria-hidden="true"/><div><strong>LIVE MARKET</strong><span>Follow the current auction in real time</span></div></div>

        <nav className="eaAppMobileNav" aria-label="Mobile main navigation">
          {primaryNavigation.map((item,index)=><a
            key={item.key}
            href={item.href}
            className={item.key==="live"?"is-live":undefined}
            aria-current={active===item.key?"page":undefined}
          ><span>{String(index+1).padStart(2,"0")}</span><b>{item.label}</b><i aria-hidden="true">→</i></a>)}
        </nav>

        <div className="eaAppMobileAccount">
          <a href={accountNavigation.profile}>Login / Profile</a>
          <a href={accountNavigation.register}>Register</a>
        </div>

        <div className="eaAppMobileFoot"><span>BG · EUR</span><a href="/support">Help & Support</a></div>
      </aside>
    </div>
  </div>;
}
