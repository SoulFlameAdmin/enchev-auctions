import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2048;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
const attempts = new Map<string,{count:number;resetAt:number}>();

function respond(message:string,status:number,ok=false){
  return NextResponse.json({ok,message},{status,headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin){
    try{if(new URL(origin).host!==request.nextUrl.host)return respond("Невалиден източник.",403)}
    catch{return respond("Невалиден източник.",403)}
  }
  const size=Number(request.headers.get("content-length")||"0");
  if(size>MAX_REQUEST_BYTES)return respond("Невалидни данни.",413);
  if(!request.headers.get("content-type")?.startsWith("application/json")){
    return respond("Изпрати имейл чрез формата.",415);
  }
  let body:unknown;
  try {body=await request.json()} catch {return respond("Невалидни данни.",400)}
  if(!body||typeof body!=="object")return respond("Невалидни данни.",400);
  const data=body as Record<string,unknown>;
  if(typeof data.website==="string" && data.website.trim())return respond("Заявката е приета.",200,true);
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  if(email.length>254||!EMAIL_PATTERN.test(email))return respond("Въведи валиден имейл адрес.",400);

  const ip=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
  const now=Date.now();
  if(attempts.size>500){
    for(const [key,value] of attempts)if(value.resetAt<now)attempts.delete(key);
  }
  const record=attempts.get(ip);
  if(record&&record.resetAt>now&&record.count>=5)return respond("Твърде много опити. Опитай по-късно.",429);
  attempts.set(ip,{count:(record&&record.resetAt>now?record.count:0)+1,resetAt:now+15*60*1000});

  // The address is sent only server-side to the configured SoulFlame mailbox.
  // Never acknowledge success unless the email service confirms acceptance.
  const key=process.env.CARAR_RESEND_API_KEY;
  const from=process.env.CARAR_RESEND_FROM_EMAIL;
  const to=process.env.CARAR_NOTIFY_TO_EMAIL;
  if(!key||!from||!to)return respond("Записването се подготвя. Опитай отново по-късно.",503);

  try{
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        from,
        to:[to],
        subject:"SOULFLAME CarAR — нов интерес за Coming Soon",
        text:`Нов имейл за CarAR известие: ${email}\nДата: ${new Date().toISOString()}\nИсточник: E&A cinematic landing page`,
        reply_to:email,
      }),
      signal:AbortSignal.timeout(9000),
      cache:"no-store"
    });
    if(!response.ok)return respond("В момента не можем да потвърдим записването. Опитай отново.",502);
    const result=await response.json() as {id?:string};
    if(!result.id)return respond("Няма потвърждение за записването. Опитай отново.",502);
    return respond("Записването е прието. Ще ти пишем при старта на CarAR.",200,true);
  }catch{
    return respond("Проблем с връзката. Опитай отново.",502);
  }
}

export async function GET(){
  return NextResponse.json({ok:false,message:"Use POST to join the CarAR waitlist."},{status:405,headers:{"Cache-Control":"no-store"}});
}
