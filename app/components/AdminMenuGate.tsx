"use client";

import {useCallback,useEffect,useState,type ReactNode} from "react";

type State="checking"|"authorized"|"locked";
export default function AdminMenuGate({children}:{children:ReactNode}){
  const [status,setStatus]=useState<State>("checking");
  const check=useCallback(async()=>{
    try{
      const response=await fetch("/api/admin/session",{cache:"no-store",credentials:"same-origin"});
      const result=await response.json();
      setStatus(response.ok&&result.authorized===true?"authorized":"locked");
    }catch{setStatus("locked");}
  },[]);
  useEffect(()=>{
    void check();
    const onFocus=()=>{void check();};
    const onVisibility=()=>{if(document.visibilityState==="visible")void check();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisibility);};
  },[check]);
  const logout=async()=>{
    try{await fetch("/api/admin/logout",{method:"POST",credentials:"same-origin"});}
    finally{setStatus("locked");window.location.assign("/admin/login");}
  };
  if(status==="checking")return null;
  if(status!=="authorized")return <a href="/admin/login" title="Администраторски вход с Google" aria-label="Администраторски вход" style={{position:"fixed",zIndex:50,top:24,left:24,width:54,height:54,display:"grid",placeItems:"center",borderRadius:16,background:"rgba(9,13,18,.80)",border:"1px solid rgba(255,255,255,.23)",color:"#f4e9d6",textDecoration:"none",fontSize:24}}>🔒</a>;
  return <>{children}<button type="button" title="Изход от администраторския профил" aria-label="Изход от администраторския профил" onClick={()=>{void logout();}} style={{position:"fixed",zIndex:40,top:26,left:93,width:44,height:44,border:"1px solid rgba(255,255,255,.22)",borderRadius:14,background:"#111821",color:"#f5dfb4",fontSize:20,cursor:"pointer"}}>⏻</button></>;
}
