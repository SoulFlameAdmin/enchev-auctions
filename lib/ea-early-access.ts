import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "ea_early_access_admin_session";
const PROJECT_REF = "ejfrnjhlggebzmpmxajl";
export const EA_ADMIN_COOKIE = AUTH_COOKIE;

export function supabaseConfig() {
  const url = (process.env.ENCHEV_EARLY_ACCESS_SUPABASE_URL ||
    process.env.ENCHEV_ETAP1_SUPABASE_URL || "").replace(/\/$/,"");
  const key = process.env.ENCHEV_EARLY_ACCESS_SERVICE_ROLE_KEY || "";
  // Fail closed, rather than accidentally using an unrelated DAVID database.
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { /* missing config */ }
  if (hostname !== PROJECT_REF+".supabase.co" || !key) return null;
  return {url,key};
}

export function getAdminSecret() {
  const secret=process.env.ENCHEV_EARLY_ACCESS_ADMIN_SECRET||"";
  return secret.length>=32?secret:null;
}
function equal(a:string,b:string){
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function signature(data:string,secret:string){
  return createHmac("sha256",secret).update(data).digest("hex");
}
export function createAdminSession() {
  const secret=getAdminSecret(); if(!secret)return null;
  const expires=Math.floor(Date.now()/1000)+8*60*60;
  const payload="v1."+expires;
  return payload+"."+signature(payload,secret);
}
export function verifyAdminSession(request:NextRequest){
  const secret=getAdminSecret(); if(!secret)return false;
  const token=request.cookies.get(AUTH_COOKIE)?.value||"";
  const [version,expiry,signatureValue,extra]=token.split(".");
  if(extra || version!=="v1" || !/^\d{10,}$/.test(expiry||"") ||
      !signatureValue || Number(expiry)<Math.floor(Date.now()/1000))return false;
  return equal(signature(version+"."+expiry,secret),signatureValue);
}
export function verifyAdminPassword(value:string){
  const secret=getAdminSecret();
  return !!secret && equal(value,secret);
}
function dataHeaders(key:string,extras?:Record<string,string>){
  return {"apikey":key,"Authorization":"Bearer "+key,
    "Content-Type":"application/json",...extras};
}
export async function dbCount():Promise<number>{
  const c=supabaseConfig();if(!c)throw Error("NOT_CONFIGURED");
  const response=await fetch(c.url+"/rest/v1/ea_early_access_signups?select=id",{
    method:"HEAD",headers:dataHeaders(c.key,{"Prefer":"count=exact"}),
    cache:"no-store",signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw Error("COUNT_UNAVAILABLE");
  const range=response.headers.get("content-range")||"";
  const found=range.match(/\/(\d+)$/);
  if(!found)throw Error("COUNT_MISSING");
  return Number(found[1]);
}
export async function addSignup(email:string):Promise<void>{
  const c=supabaseConfig();if(!c)throw Error("NOT_CONFIGURED");
  const response=await fetch(c.url+"/rest/v1/ea_early_access_signups?on_conflict=email",{
    method:"POST",headers:dataHeaders(c.key,{"Prefer":"resolution=ignore-duplicates,return=minimal"}),
    body:JSON.stringify({email,source:"cinematic_presentation_2",consent_at:new Date().toISOString()}),
    cache:"no-store",signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw Error("SIGNUP_UNAVAILABLE");
}
export type SignupRow = {id:string;email:string;created_at:string;consent_at:string;source:string};
export async function listSignups(page:number,term:string):Promise<SignupRow[]>{
  const c=supabaseConfig();if(!c)throw Error("NOT_CONFIGURED");
  const url=new URL(c.url+"/rest/v1/ea_early_access_signups");
  url.searchParams.set("select","id,email,created_at,consent_at,source");
  url.searchParams.set("order","created_at.desc");
  url.searchParams.set("limit","50");
  url.searchParams.set("offset",String(page*50));
  if(term) url.searchParams.set("email","ilike.*"+term.replace(/[*,()%]/g,"")+"*");
  const response=await fetch(url,{
    headers:dataHeaders(c.key),cache:"no-store",signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw Error("LIST_UNAVAILABLE");
  const data:unknown=await response.json();
  if(!Array.isArray(data))throw Error("LIST_FORMAT");
  return data as SignupRow[];
}
