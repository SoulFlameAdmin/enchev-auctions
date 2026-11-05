import "server-only";
import type { NextRequest } from "next/server";
import {
  authConfig, authCookie, providerRequest, safeUser,
  type BuyerAuthConfig
} from "./enchev-auth-server";

const DEDICATED_REF="ejfrnjhlggebzmpmxajl";
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BuyerIdentity = {
  user: {id:string;email:string};
  token:string;
  config:BuyerAuthConfig;
};

export async function requireBuyer(request:NextRequest):
  Promise<{state:"disabled"|"unauthorized"}|{state:"ready";buyer:BuyerIdentity}> {
  const config=authConfig();
  if(!config || new URL(config.url).hostname!==DEDICATED_REF+".supabase.co")return {state:"disabled"};
  const token=authCookie(request,"access");
  if(!token)return {state:"unauthorized"};
  const auth=await providerRequest(config,"/auth/v1/user","GET",token);
  const user=auth?.status===200?safeUser(auth.data):null;
  if(!user || !UUID.test(user.id))return {state:"unauthorized"};
  return {state:"ready",buyer:{config,user,token}};
}

export async function buyerDataRequest(
  buyer:BuyerIdentity,path:string,method:"GET"|"POST"|"PATCH"|"DELETE"="GET",
  body?:unknown,extraHeaders?:Record<string,string>
):Promise<{status:number;data:unknown}> {
  if(!path.startsWith("/") || path.startsWith("//") || path.includes("://"))throw Error("Invalid data path");
  try{
    const result=await fetch(buyer.config.url+"/rest/v1"+path,{
      method,cache:"no-store",signal:AbortSignal.timeout(10000),
      headers:{
        apikey:buyer.config.anonKey,
        Authorization:"Bearer "+buyer.token,
        "Accept":"application/json",
        ...(body!==undefined?{"Content-Type":"application/json"}:{}),
        ...extraHeaders
      },
      body:body===undefined?undefined:JSON.stringify(body),
    });
    return {status:result.status,data:result.status===204?null:await result.json().catch(()=>null)};
  }catch{
    return {status:503,data:null};
  }
}
export function getBuyerApiStatus(state:"disabled"|"unauthorized"){
  return state==="disabled"?503:401;
}
export function buyerApiStatusMessage(state:"disabled"|"unauthorized"){
  return state==="disabled"?"Identity service not activated.":"Sign in to access your own buyer records.";
}
