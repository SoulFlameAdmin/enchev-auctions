"use client";
import {useState} from "react";
export default function EaAdminSignOut(){
 const [busy,setBusy]=useState(false);
 return <button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);
  try{await fetch("/api/menu-access",{method:"DELETE",credentials:"same-origin"});}
  finally{window.location.assign("/");}
 }} style={{padding:"12px 17px",marginTop:18,marginLeft:12,border:"1px solid #95383b",borderRadius:10,color:"#ffd4d4",background:"#2b1012",cursor:"pointer",fontWeight:700}}>
 {busy?"Изход…":"Изход от админ"}
 </button>;
}
