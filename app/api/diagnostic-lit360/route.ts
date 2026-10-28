import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
const origin="https://e-auctions-cinematic-demo.lit360.chatgpt.site";
const accepted=["/","/styles.css","/cinema.css","/signup.css","/cinema.js","/signup.js","/assets/advert-background.mp4"];
export async function GET(request:NextRequest){
 const part=request.nextUrl.searchParams.get("part")||"/";
 const start=Math.min(Math.max(0,Number(request.nextUrl.searchParams.get("start"))||0),500000);
 if(!accepted.includes(part))return NextResponse.json({error:"not allowed"},{status:400});
 try{
 const res=await fetch(origin+part,{cache:"no-store",signal:AbortSignal.timeout(12000),method:part.endsWith(".mp4")?"HEAD":"GET"});
 const text=part.endsWith(".mp4")?"":await res.text();
 return NextResponse.json({ok:res.ok,status:res.status,type:res.headers.get("content-type"),length:text.length,
 xframe:res.headers.get("x-frame-options"),csp:res.headers.get("content-security-policy"),
 contentLength:res.headers.get("content-length"),start,body:text.slice(start,start+20000)}, {headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"failed"},{status:502})}
}