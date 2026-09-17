"use client";

import { useEffect } from "react";

export default function LotNavigationBridge(){
  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const trigger=target?.closest?.(".detailsBtn,.soldDetailsBtn") as HTMLElement|null;
      if(!trigger)return;
      const card=trigger.closest(".inventoryCard");
      const lotText=card?.querySelector(".inventoryLot")?.textContent||"";
      const match=lotText.match(/EA-\d+/i);
      if(!match)return;
      event.preventDefault();
      window.location.href=`/lot/${match[0].toUpperCase()}`;
    };
    document.addEventListener("click",onClick);
    return()=>document.removeEventListener("click",onClick);
  },[]);
  return null;
}
