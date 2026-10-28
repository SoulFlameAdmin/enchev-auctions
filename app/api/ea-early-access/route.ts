import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dedicated public Edge Function on the verified E&A Supabase project.
// The service-role credential stays within Supabase's secret store, never
// on a public page or in the GitHub repository.
const UPSTREAM="https://ejfrnjhlggebzmpmxajl.supabase.co/functions/v1/ea-early-access-public";
const CANONICAL_ORIGIN="https://enchev-auctions.vercel.app";
function respond(data:unknown,status:number){
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
async function forward(method:"GET"|"POST",request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin){
    try{if(new URL(origin).host!==request.nextUrl.host)return respond({ok:false,message:"Невалиден източник."},403);}
    catch{return respond({ok:false,message:"Невалиден източник."},403);}
  }
  const options:RequestInit={
    method,cache:"no-store",
    headers:{"Origin":CANONICAL_ORIGIN, "Content-Type":"application/json"},
    signal:AbortSignal.timeout(10000)
  };
  if(method==="POST"){
    if(!request.headers.get("content-type")?.startsWith("application/json"))return respond({ok:false},415);
    if(Number(request.headers.get("content-length")||0)>2048)return respond({ok:false},413);
    const payload=await request.text().catch(()=>"");
    if(payload.length>2048 || !payload)return respond({ok:false,message:"Невалидни данни."},400);
    options.body=payload;
    // Let the edge service apply its database-backed rate limit.
    (options.headers as Record<string,string>)["X-Forwarded-For"]=request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
  }
  try{
    const response=await fetch(UPSTREAM,options);
    const raw=await response.json() as Record<string,unknown>;
    if(!raw||typeof raw!=="object")throw Error("INVALID_RESPONSE");
    return respond(raw,response.status);
  }catch{
    return respond({ok:false,count:null,message:"Свързването с базата е временно недостъпно."},503);
  }
}
export async function GET(request:NextRequest){return forward("GET",request);}
export async function POST(request:NextRequest){return forward("POST",request);}
