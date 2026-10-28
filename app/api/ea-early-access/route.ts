import { NextRequest, NextResponse } from "next/server";
import { addSignup, dbCount, supabaseConfig } from "../../../lib/ea-early-access";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const pattern=/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
const attempts=new Map<string,{count:number;reset:number}>();
function json(body:Record<string,unknown>,status=200){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
}
function sameOrigin(request:NextRequest){
  const origin=request.headers.get("origin");
  if(!origin)return true;
  try{return new URL(origin).host===request.nextUrl.host;}catch{return false;}
}
export async function GET(){
  if(!supabaseConfig())return json({
    ok:false,count:null,configured:false,
    message:"Броячът очаква връзка към Enchev Supabase."
  },503);
  try{return json({ok:true,count:await dbCount()});}
  catch{return json({ok:false,count:null,message:"Броят записани не е наличен."},503);}
}
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return json({ok:false,message:"Невалиден източник."},403);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ok:false,message:"Невалидни данни."},415);
  if(Number(request.headers.get("content-length")||0)>2048)
    return json({ok:false,message:"Прекалено голяма заявка."},413);
  let raw:unknown;
  try{raw=await request.json();}catch{return json({ok:false,message:"Невалидни данни."},400);}
  if(!raw||typeof raw!=="object")return json({ok:false,message:"Невалидни данни."},400);
  const data=raw as Record<string,unknown>;
  // Never claim a bot submission is a registered lead.
  if(typeof data.website==="string"&&data.website.trim())return json({ok:true,accepted:false,count:null});
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  if(email.length>254 || !pattern.test(email))return json({ok:false,message:"Въведи валиден имейл."},400);
  if(data.consent!==true)return json({ok:false,message:"Потвърди съгласието за известия."},400);
  if(!supabaseConfig())return json({
    ok:false,count:null,message:"Базата на Enchev още не е свързана за записване. Данните не са запазени."
  },503);
  const ip=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
  const now=Date.now();
  if(attempts.size>500)for(const [key,val] of attempts)if(val.reset<=now)attempts.delete(key);
  const attempt=attempts.get(ip);
  if(attempt&&attempt.reset>now&&attempt.count>=5)return json({ok:false,message:"Твърде много опити. Опитай след 15 минути."},429);
  attempts.set(ip,{count:(attempt&&attempt.reset>now?attempt.count:0)+1,reset:now+900000});
  try{
    await addSignup(email);
    let count:number|null=null;
    try{count=await dbCount();}catch{/* Signup persisted; count unavailable. */}
    return json({ok:true,accepted:true,count,message:"Имейлът е записан успешно в базата на E&A."});
  }catch{
    return json({ok:false,count:null,message:"Записването не е потвърдено. Опитай отново."},503);
  }
}
