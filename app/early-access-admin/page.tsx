"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./early-access-admin.css";

type Signup={id:string;email:string;created_at:string;consent_at:string;source:string};
export default function EarlyAccessAdmin(){
 const [authorized,setAuthorized]=useState(false);
 const [authReady,setAuthReady]=useState(false);
 const [configured,setConfigured]=useState(false);
 const [secret,setSecret]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [rows,setRows]=useState<Signup[]>([]);
 const [total,setTotal]=useState<number|null>(null);
 const [page,setPage]=useState(0);
 const [term,setTerm]=useState("");
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(false);

 const refresh=useCallback(async()=>{
  if(!authorized)return;
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/ea-early-access/admin?page="+page+"&q="+encodeURIComponent(query),{cache:"no-store",credentials:"same-origin"});
   const data=await response.json();
   if(response.status===401){setAuthorized(false);setRows([]);throw Error("Сесията изтече. Влез отново.");}
   if(!response.ok||!data.ok)throw Error(data.message||"Неуспешно зареждане.");
   setRows(data.rows||[]);
   setTotal(Number.isSafeInteger(data.total)?data.total:null);
  }catch(e){setError(e instanceof Error?e.message:"Проблем с връзката.");}
  finally{setLoading(false);}
 },[authorized,page,query]);

 useEffect(()=>{
  fetch("/api/ea-early-access/admin/session",{cache:"no-store",credentials:"same-origin"})
    .then(r=>r.json()).then(data=>{setAuthorized(data.authenticated===true);setConfigured(data.configured===true);})
    .catch(()=>setError("Админ услугата не е налична.")).finally(()=>setAuthReady(true));
 },[]);
 useEffect(()=>{if(authorized)refresh();},[authorized,refresh]);
 async function login(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  try{
   const response=await fetch("/api/ea-early-access/admin/session",{
    method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
    body:JSON.stringify({password:secret})
   });
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.message||"Невалиден админ код.");
   setSecret("");setAuthorized(true);
  }catch(e){setError(e instanceof Error?e.message:"Проблем с входа.");}
  finally{setBusy(false);}
 }
 async function logout(){
  await fetch("/api/ea-early-access/admin/session",{method:"DELETE",credentials:"same-origin"});
  setAuthorized(false);setRows([]);setTotal(null);
 }
 const format=(v:string)=>{try{return new Date(v).toLocaleString("bg-BG",{dateStyle:"medium",timeStyle:"short"});}catch{return v;}};
 return <main id="main-content" className="eaLeadsAdmin">
  <header className="eaLeadsHeader">
   <div><span>E&A EAST WEST AUCTIONEERS GROUP</span><h1>Ранни записвания</h1><p>Единен списък с реални имейли от Supabase на Enchev</p></div>
   <Link href="/">КЪМ САЙТА ↗</Link>
  </header>
  {!authReady?<p className="eaLeadsNotice">Проверка на достъпа...</p>:!authorized?
   <section className="eaLeadsLogin">
    <h2>Защитен администраторски достъп</h2>
    <p>Списъкът с имейли е достъпен само след проверка на администраторския код. Личните данни не се показват в публичната част на сайта.</p>
    {!configured&&<p className="eaLeadsWarning">Админ достъпът не е активиран в настройките на Enchev.</p>}
    <form onSubmit={login}>
     <label htmlFor="eaAdminSecret">Администраторски код</label>
     <input id="eaAdminSecret" type="password" autoComplete="current-password" value={secret} onChange={e=>setSecret(e.target.value)} required minLength={32} placeholder="Въведи защитения админ код" disabled={!configured}/>
     <button type="submit" disabled={busy||!configured}>{busy?"ПРОВЕРКА...":"ВЛЕЗ В СПИСЪКА ↗"}</button>
    </form>
    {error&&<p role="alert" className="eaLeadsWarning">{error}</p>}
   </section>:
   <section className="eaLeadsDashboard">
    <div className="eaLeadsSummary"><div><small>РЕАЛНО ЗАПИСАНИ ИМЕЙЛИ</small><strong>{total===null?"—":new Intl.NumberFormat("bg-BG").format(total)}</strong></div><button type="button" onClick={logout}>ИЗХОД ↗</button></div>
    <form className="eaLeadsSearch" onSubmit={e=>{e.preventDefault();setPage(0);setQuery(term);}}>
     <label htmlFor="eaLeadsFilter">Търси имейл</label>
     <input id="eaLeadsFilter" type="search" placeholder="gmail.com или конкретен адрес" value={term} onChange={e=>setTerm(e.target.value)}/>
     <button type="submit">ТЪРСИ</button><button type="button" onClick={refresh} disabled={loading}>ОБНОВИ</button>
    </form>
    {error&&<p role="alert" className="eaLeadsWarning">{error}</p>}
    <div className="eaLeadsTableWrap"><table><thead><tr><th>№</th><th>Имейл</th><th>Дата на записване</th><th>Източник</th></tr></thead><tbody>
      {rows.map((r,i)=><tr key={r.id}><td>{page*50+i+1}</td><td><span>{r.email}</span></td><td>{format(r.created_at)}</td><td>{r.source}</td></tr>)}
      {!rows.length&&<tr><td colSpan={4}>{loading?"Зареждане...":"Няма записи за текущото търсене."}</td></tr>}
    </tbody></table></div>
    <footer className="eaLeadsPagination"><span>Страница {page+1} · до 50 записа</span><div><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>← Назад</button><button disabled={rows.length<50||loading} onClick={()=>setPage(p=>p+1)}>Напред →</button></div></footer>
   </section>}
 </main>;
}
