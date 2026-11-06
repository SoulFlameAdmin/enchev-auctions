"use client";
import {useState,type FormEvent} from "react";

export default function EaAdminPasswordLogin(){
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!password||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/menu-access",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password})});
   const data=await response.json();
   if(!response.ok||data.authorized!==true){
    setError(response.status===503?"Сървърната администраторска парола още не е конфигурирана.":response.status===429?"Твърде много опити. Опитай по-късно.":"Неправилна парола.");
    return;
   }
   setPassword("");
   window.location.assign("/admin/console");
  }catch{setError("Неуспешна връзка със сървъра.");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} style={{display:"grid",gap:12,marginTop:24}}>
   <label htmlFor="ea-admin-password" style={{color:"#eee",fontSize:14,fontWeight:700}}>Администраторска парола</label>
   <input id="ea-admin-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} style={{minHeight:50,padding:"12px 14px",borderRadius:10,border:"1px solid #50505a",background:"#17171c",color:"#fff",fontSize:16}}/>
   <button type="submit" disabled={busy} style={{minHeight:51,border:0,borderRadius:10,color:"white",background:"#d3272c",fontWeight:850,cursor:"pointer"}}>{busy?"Проверка…":"ВЛЕЗ В АДМИН"}</button>
   {error&&<p role="alert" style={{color:"#ffb0b0",fontSize:14,lineHeight:1.5}}>{error}</p>}
 </form>;
}
