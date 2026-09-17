"use client";

import { useEffect } from "react";

export default function LotNavigationBridge(){
  useEffect(()=>{
    const normalize=(value:string)=>value.replace(/\s+/g," ").trim().toLowerCase();
    const syncLinks=()=>{
      document.querySelectorAll<HTMLAnchorElement>("a").forEach(anchor=>{
        const text=normalize(anchor.textContent||"");
        if(text.includes("търгове на живо")||text==="live търгове")anchor.href="/live-auctions";
        if(text==="транспорт")anchor.href="/transport";
        if(text.includes("история на мпс")||text.includes("история на превозното средство"))anchor.href="/vehicle-history";
      });
      document.querySelectorAll<HTMLElement>(".inv2UtilityRight span").forEach(item=>{
        const text=normalize(item.textContent||"");
        if(text==="транспорт"||text.includes("история на мпс")){
          item.style.cursor="pointer";
          item.setAttribute("role","link");
          item.setAttribute("tabindex","0");
        }
      });
    };
    syncLinks();

    const onClick=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const trigger=target?.closest?.(".detailsBtn,.soldDetailsBtn") as HTMLElement|null;
      if(trigger){
        const card=trigger.closest(".inventoryCard");
        const lotText=card?.querySelector(".inventoryLot")?.textContent||"";
        const match=lotText.match(/EA-\d+/i);
        if(match){
          event.preventDefault();
          window.location.href=`/lot/${match[0].toUpperCase()}`;
          return;
        }
      }
      const utility=target?.closest?.(".inv2UtilityRight span") as HTMLElement|null;
      if(utility){
        const text=normalize(utility.textContent||"");
        if(text==="транспорт"){
          event.preventDefault();
          window.location.href="/transport";
          return;
        }
        if(text.includes("история на мпс")){
          event.preventDefault();
          window.location.href="/vehicle-history";
        }
      }
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      const target=event.target as HTMLElement|null;
      if(!target?.matches?.(".inv2UtilityRight span"))return;
      const text=normalize(target.textContent||"");
      if(text==="транспорт"){
        event.preventDefault();
        window.location.href="/transport";
      }else if(text.includes("история на мпс")){
        event.preventDefault();
        window.location.href="/vehicle-history";
      }
    };
    document.addEventListener("click",onClick);
    document.addEventListener("keydown",onKey);
    return()=>{
      document.removeEventListener("click",onClick);
      document.removeEventListener("keydown",onKey);
    };
  },[]);
  return null;
}
