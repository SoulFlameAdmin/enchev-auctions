import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "enchev_menu_access";
const TTL_SECONDS = 12 * 60 * 60;
const WINDOW_MS=15*60*1000;
const MAX_FAILURES=6;
const failedAttempts=new Map<string,{count:number;until:number}>();
function clientKey(request:NextRequest){
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ||"unknown";
}
function sameOrigin(request:NextRequest){
  const origin=request.headers.get("origin");
  return !origin||origin===request.nextUrl.origin;
}
function rejected(response:number,error:string){return NextResponse.json({authorized:false,error},{status:response,headers:{"Cache-Control":"no-store"}});}

function secret(){return process.env.ENCHEV_MENU_PASSWORD || "";}
function sign(expiry:string,password:string){
  return createHmac("sha256",password).update("enchev-sidebar-v1:"+expiry).digest("hex");
}
function authenticated(request:NextRequest,password:string){
  const token=request.cookies.get(COOKIE)?.value||"";
  const [expiry,signature,...extra]=token.split(".");
  if(extra.length||!expiry||!signature||!/^[0-9]+$/.test(expiry)||!/^[0-9a-f]{64}$/.test(signature))return false;
  if(Number(expiry)<Date.now()||Number(expiry)>Date.now()+TTL_SECONDS*1000)return false;
  return timingSafeEqual(Buffer.from(sign(expiry,password),"hex"),Buffer.from(signature,"hex"));
}
export async function GET(request:NextRequest){
  const password=secret();
  return NextResponse.json({authorized:password!==""&&authenticated(request,password)},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return rejected(403,"ORIGIN_DENIED");
  if(!request.headers.get("content-type")?.toLowerCase().includes("application/json"))return rejected(415,"CONTENT_TYPE");
  const key=clientKey(request);
  const now=Date.now();
  const current=failedAttempts.get(key);
  if(current&&current.until>now&&current.count>=MAX_FAILURES)return rejected(429,"RATE_LIMITED");
  if(current&&current.until<=now)failedAttempts.delete(key);
  const password=secret();
  if(!password)return NextResponse.json({authorized:false,error:"NOT_CONFIGURED"},{status:503,headers:{"Cache-Control":"no-store"}});
  let input:unknown;
  try{input=await request.json();}catch{return NextResponse.json({authorized:false},{status:400});}
  const provided=(input&&typeof input==="object"&&"password" in input)?(input as {password:unknown}).password:null;
  if(typeof provided!=="string"||provided.length>256)return NextResponse.json({authorized:false},{status:400});
  const expected=createHash("sha256").update(password).digest();
  const actual=createHash("sha256").update(provided).digest();
  if(!timingSafeEqual(expected,actual)){
    const prior=failedAttempts.get(key);
    failedAttempts.set(key,{count:(prior?.until&&prior.until>now?prior.count:0)+1,until:prior?.until&&prior.until>now?prior.until:now+WINDOW_MS});
    return rejected(401,"INVALID_PASSWORD");
  }
  failedAttempts.delete(key);
  const expiry=String(Date.now()+TTL_SECONDS*1000);
  const response=NextResponse.json({authorized:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(COOKIE,expiry+"."+sign(expiry,password),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:TTL_SECONDS});
  return response;
}

export async function DELETE(request:NextRequest){
  if(!sameOrigin(request))return rejected(403,"ORIGIN_DENIED");
  const response=NextResponse.json({authorized:false},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  return response;
}
