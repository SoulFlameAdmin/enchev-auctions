import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persistent E&A early access contacts (not CarAR leads) using Resend Segments.
 * Only counts unique server-confirmed contacts. Requires server-side Resend key:
 * EA_RESEND_API_KEY or existing CARAR_RESEND_API_KEY.
 * The segment is discovered by exact name, or configured via EA_RESEND_SEGMENT_ID.
 */
const SEGMENT_NAME = "E&A East West — Early Access 2026";
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
const attempts = new Map<string,{count:number;reset:number}>();
const headers = { "Cache-Control":"no-store, max-age=0" };
type ResendList<T> = {data?:T[]; has_more?:boolean};
type Segment = {id:string; name:string};
type Contact = {id:string; email?:string};

function json(body:Record<string,unknown>, status=200){
  return NextResponse.json(body,{status,headers});
}
function key(){return process.env.EA_RESEND_API_KEY || process.env.CARAR_RESEND_API_KEY;}
async function api(path:string,method="GET",payload?:Record<string,unknown>){
  const secret=key();
  if(!secret)throw new Error("EA_WAITLIST_NOT_CONFIGURED");
  const response=await fetch("https://api.resend.com"+path,{
    method,
    headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},
    body:payload?JSON.stringify(payload):undefined,
    cache:"no-store",
    signal:AbortSignal.timeout(11000),
  });
  let data:Record<string,any>={};
  try{data=await response.json() as Record<string,any>;}catch{/* fail closed */}
  return {status:response.status,ok:response.ok,data};
}
async function resolveSegment(create:boolean){
  const configured=process.env.EA_RESEND_SEGMENT_ID?.trim();
  if(configured)return configured;
  const listing=await api("/segments");
  if(!listing.ok||!Array.isArray(listing.data.data))throw new Error("SEGMENT_LIST_FAILED");
  const existing=(listing.data as ResendList<Segment>).data?.find(s=>s.name===SEGMENT_NAME);
  if(existing?.id)return existing.id;
  if(!create)return null;
  const created=await api("/segments","POST",{name:SEGMENT_NAME});
  if(created.ok && typeof created.data.id==="string")return created.data.id;
  // A concurrent request might have created the same segment.
  const retry=await api("/segments");
  const found=(retry.data as ResendList<Segment>).data?.find(s=>s.name===SEGMENT_NAME);
  if(found?.id)return found.id;
  throw new Error("SEGMENT_CREATE_FAILED");
}
async function count(segmentId:string|null):Promise<number>{
  if(!segmentId)return 0;
  let cursor:string|undefined;
  let total=0;
  // Never emit a partial count if the list has too many pages.
  for(let i=0;i<150;i++){
    const uri="/segments/"+encodeURIComponent(segmentId)+"/contacts?limit=100"+(cursor?"&after="+encodeURIComponent(cursor):"");
    const page=await api(uri);
    if(!page.ok||!Array.isArray(page.data.data))throw new Error("COUNT_FAILED");
    const contacts=(page.data as ResendList<Contact>).data||[];
    total+=contacts.length;
    if(!page.data.has_more)return total;
    cursor=contacts.at(-1)?.id;
    if(!cursor)throw new Error("COUNT_CURSOR_FAILED");
  }
  throw new Error("COUNT_LIMIT_REACHED");
}
async function notify(email:string){
  const from=process.env.EA_RESEND_FROM_EMAIL || process.env.CARAR_RESEND_FROM_EMAIL;
  const to=process.env.EA_NOTIFY_TO_EMAIL || process.env.CARAR_NOTIFY_TO_EMAIL;
  if(!from||!to)return false;
  try{
    const result=await api("/emails","POST",{
      from,to:[to],
      subject:"E&A East West — ново ранно записване",
      text:"Нов имейл за E&A ранен достъп: "+email+"\nДата: "+new Date().toISOString(),
      reply_to:email,
    });
    return result.ok&&typeof result.data.id==="string";
  }catch{return false;}
}
export async function GET(){
  if(!key())return json({ok:false,count:null,configured:false,message:"Броячът не е свързан с услугата за записване."},503);
  try{
    return json({ok:true,count:await count(await resolveSegment(false))});
  }catch{
    return json({ok:false,count:null,message:"Броят записани временно не е наличен."},502);
  }
}
export async function POST(request:NextRequest){
  if(!key())return json({ok:false,count:null,message:"Ранното записване се настройва. Опитай отново по-късно."},503);
  const origin=request.headers.get("origin");
  if(origin){
    try{if(new URL(origin).host!==request.nextUrl.host)return json({ok:false,message:"Невалиден източник."},403);}
    catch{return json({ok:false,message:"Невалиден източник."},403);}
  }
  if(!request.headers.get("content-type")?.startsWith("application/json"))return json({ok:false,message:"Невалиден формат."},415);
  if(Number(request.headers.get("content-length")||0)>2048)return json({ok:false,message:"Твърде голяма заявка."},413);
  let input:unknown;
  try{input=await request.json();}catch{return json({ok:false,message:"Невалидни данни."},400);}
  if(!input||typeof input!=="object")return json({ok:false,message:"Невалидни данни."},400);
  const data=input as Record<string,unknown>;
  if(typeof data.website==="string"&&data.website.trim())return json({ok:true,accepted:false,count:null});
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  if(email.length>254||!EMAIL_PATTERN.test(email))return json({ok:false,message:"Въведи валиден имейл адрес."},400);
  if(data.consent!==true)return json({ok:false,message:"Потвърди, че желаеш известие за ранния достъп."},400);
  const ip=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
  const now=Date.now();
  if(attempts.size>500)for(const [id,value] of attempts)if(value.reset<now)attempts.delete(id);
  const previous=attempts.get(ip);
  if(previous&&previous.reset>now&&previous.count>=5)return json({ok:false,message:"Твърде много опити. Опитай след малко."},429);
  attempts.set(ip,{count:(previous&&previous.reset>now?previous.count:0)+1,reset:now+900_000});
  try{
    const segmentId=await resolveSegment(true);
    if(!segmentId)throw new Error("SEGMENT_MISSING");
    const existing=await api("/contacts/"+encodeURIComponent(email));
    if(existing.status===404){
      const created=await api("/contacts","POST",{email,unsubscribed:false});
      if(!created.ok&&created.status!==409&&created.status!==422)throw new Error("CONTACT_CREATE_FAILED");
    }else if(!existing.ok)throw new Error("CONTACT_LOOKUP_FAILED");

    // Idempotent per-contact membership; duplicates do not increase the count.
    const membership=await api("/contacts/"+encodeURIComponent(email)+"/segments/"+encodeURIComponent(segmentId),"POST");
    if(!membership.ok&&membership.status!==409)throw new Error("SEGMENT_JOIN_FAILED");
    // The early access contact is now durably saved; email notification is optional.
    const [registered,notified]=await Promise.allSettled([count(segmentId),notify(email)]);
    return json({
      ok:true,accepted:true,
      count:registered.status==="fulfilled"?registered.value:null,
      notificationSent:notified.status==="fulfilled"?notified.value:false,
      message:"Успешно записване! Ще ти пишем при старта на E&A.",
    });
  }catch{
    return json({ok:false,message:"В момента не можем да потвърдим записването. Опитай отново."},502);
  }
}
