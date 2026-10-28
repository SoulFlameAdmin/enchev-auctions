import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
const ORIGIN="https://e-auctions-cinematic-demo.lit360.chatgpt.site/";
export async function GET(){
try{
 const response=await fetch(ORIGIN,{redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(11000)});
 const contentType=response.headers.get("content-type")||"";
 const text=contentType.includes("text/html") ? (await response.text()).slice(0,1000000):"";
 const sources=text.split("\n").filter(line=>/video|mp4|webm|source|poster/i.test(line)).slice(0,40).map(x=>x.slice(0,1000));
 return NextResponse.json({ok:true,status:response.status,finalUrl:response.url,type:contentType,frameOptions:response.headers.get("x-frame-options"),csp:response.headers.get("content-security-policy"),htmlLength:text.length,videoRefs:sources,scriptRefs:[...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].slice(0,15).map(m=>m[1]),head:text.slice(0,1000)},{headers:{"Cache-Control":"no-store"}});
}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Failed"},{status:502,headers:{"Cache-Control":"no-store"}})}
}