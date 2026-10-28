import { NextRequest, NextResponse } from "next/server";
import { EA_ADMIN_COOKIE, createAdminSession, getAdminSecret, verifyAdminPassword, verifyAdminSession } from "../../../../../lib/ea-early-access";
export const runtime="nodejs";export const dynamic="force-dynamic";
const attempts=new Map<string,{count:number;until:number}>();
function respond(body:Record<string,unknown>,status=200){
 return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request:NextRequest){
 return respond({authenticated:verifyAdminSession(request),configured:Boolean(getAdminSecret())});
}
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin){try{if(new URL(origin).host!==request.nextUrl.host)return respond({ok:false},403);}catch{return respond({ok:false},403);}}
 const ip=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
 const now=Date.now(); const item=attempts.get(ip);
 if(item&&item.until>now&&item.count>=5)return respond({ok:false,message:"Твърде много опити. Опитай по-късно."},429);
 let data:unknown;try{data=await request.json()}catch{return respond({ok:false},400)}
 const password=data&&typeof data==="object"&&(data as Record<string,unknown>).password;
 if(typeof password!=="string"||password.length>512)return respond({ok:false},400);
 if(!verifyAdminPassword(password)){
   attempts.set(ip,{until:now+900000,count:item&&item.until>now?item.count+1:1});
   return respond({ok:false,message:"Невалиден администраторски код."},401);
 }
 attempts.delete(ip);
 const session=createAdminSession();
 if(!session)return respond({ok:false,message:"Админ достъпът не е настроен."},503);
 const response=respond({ok:true});
 response.cookies.set(EA_ADMIN_COOKIE,session,{
   httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",
   maxAge:8*3600,path:"/"
 });
 return response;
}
export async function DELETE(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin){try{if(new URL(origin).host!==request.nextUrl.host)return respond({ok:false},403);}catch{return respond({ok:false},403);}}
 const response=respond({ok:true});
 response.cookies.set(EA_ADMIN_COOKIE,"",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",maxAge:0,path:"/"});
 return response;
}
