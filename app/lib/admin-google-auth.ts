import "server-only";
import type { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://ejfrnjhlggebzmpmxajl.supabase.co";
// This is a PUBLIC / publishable browser-safe key, never a service-role key.
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_COnNmCtI51j9CkXwa__gXQ_pLevKA_P";
const KEY = process.env.ENCHEV_ADMIN_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
export const SITE_URL = "https://enchev-auctions.vercel.app";
export const ACCESS_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ea-admin-at" : "ea-admin-at";
export const REFRESH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ea-admin-rt" : "ea-admin-rt";
export const PKCE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ea-admin-pkce" : "ea-admin-pkce";
const ADMINS = new Set(["soulflame.mitko@gmail.com","soulflame.jake@gmail.com"]);

export type AdminTokens = {access_token:string;refresh_token:string;expires_in:number};
type Identity = {id?:unknown;email?:unknown;email_confirmed_at?:unknown;app_metadata?:{provider?:unknown;providers?:unknown}};

export function isApprovedGoogleAdmin(value:unknown):value is Identity & {email:string} {
  if (!value || typeof value !== "object") return false;
  const user=value as Identity;
  if (typeof user.id !== "string" || typeof user.email !== "string" || !ADMINS.has(user.email.trim().toLowerCase())) return false;
  const meta=user.app_metadata;
  const google=meta?.provider==="google"||(Array.isArray(meta?.providers)&&meta.providers.includes("google"));
  return Boolean(google && typeof user.email_confirmed_at==="string" && user.email_confirmed_at);
}

export function parseAdminTokens(data:unknown):AdminTokens|null {
  if(!data || typeof data!=="object")return null;
  const v=data as Record<string,unknown>;
  return typeof v.access_token==="string"&&v.access_token.length>15&&
    typeof v.refresh_token==="string"&&v.refresh_token.length>15&&
    typeof v.expires_in==="number"&&Number.isFinite(v.expires_in)&&v.expires_in>0
    ? {access_token:v.access_token,refresh_token:v.refresh_token,expires_in:v.expires_in}:null;
}
export async function providerFetch(path:string, method:"GET"|"POST", access?:string, payload?:Record<string,string>) {
  try{
    return await fetch(SUPABASE_URL+"/auth/v1/"+path,{
      method,cache:"no-store",
      headers:{"apikey":KEY,...(access?{Authorization:"Bearer "+access}:{}),...(payload?{"Content-Type":"application/json"}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),
      signal:AbortSignal.timeout(9000)
    });
  }catch{return null;}
}
export async function verifiedGoogleAdmin(access:string):Promise<{email:string}|null>{
  if(!access||access.length>8192)return null;
  const r=await providerFetch("user","GET",access);
  if(!r?.ok)return null;
  const data:unknown=await r.json().catch(()=>null);
  return isApprovedGoogleAdmin(data)?{email:data.email.toLowerCase()}:null;
}
export async function refreshAdminTokens(token:string):Promise<AdminTokens|null>{
  if(!token||token.length>8192)return null;
  const r=await providerFetch("token?grant_type=refresh_token","POST",undefined,{refresh_token:token});
  return r?.ok?parseAdminTokens(await r.json().catch(()=>null)):null;
}
export function setAdminCookies(response:NextResponse,tokens:AdminTokens){
  const common={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
  response.cookies.set(ACCESS_COOKIE,tokens.access_token,{...common,maxAge:Math.min(3600,Math.max(60,Math.floor(tokens.expires_in)))});
  response.cookies.set(REFRESH_COOKIE,tokens.refresh_token,{...common,maxAge:60*60*24*30});
}
export function clearAdminCookies(response:NextResponse){
  const common={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:0};
  response.cookies.set(ACCESS_COOKIE,"",common);
  response.cookies.set(REFRESH_COOKIE,"",common);
}
export function clearPkceCookie(response:NextResponse){
  response.cookies.set(PKCE_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}
export function adminCookies(request:NextRequest) {
  return {access:request.cookies.get(ACCESS_COOKIE)?.value||"",refresh:request.cookies.get(REFRESH_COOKIE)?.value||""};
}
export const PRIVATE_HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};

export async function resolveAuthorizedGoogleAdmin(request:NextRequest):Promise<{email:string;freshTokens:AdminTokens|null}|null>{
  const {access,refresh}=adminCookies(request);
  if(access){
    const valid=await verifiedGoogleAdmin(access);
    if(valid)return {email:valid.email,freshTokens:null};
  }
  if(refresh){
    const renewed=await refreshAdminTokens(refresh);
    if(renewed){
      const valid=await verifiedGoogleAdmin(renewed.access_token);
      if(valid)return {email:valid.email,freshTokens:renewed};
    }
  }
  return null;
}
