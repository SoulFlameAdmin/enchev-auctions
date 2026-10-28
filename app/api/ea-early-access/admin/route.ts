import { NextRequest, NextResponse } from "next/server";
import { dbCount, listSignups, supabaseConfig, verifyAdminSession } from "../../../../lib/ea-early-access";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private,no-store"};
 if(!verifyAdminSession(request))return NextResponse.json({ok:false,message:"Неоторизиран достъп."},{status:401,headers});
 if(!supabaseConfig())return NextResponse.json({ok:false,message:"Enchev Supabase не е свързан."},{status:503,headers});
 const pageRaw=Number(request.nextUrl.searchParams.get("page")||"0");
 if(!Number.isSafeInteger(pageRaw)||pageRaw<0||pageRaw>10000)return NextResponse.json({ok:false},{status:400,headers});
 const term=(request.nextUrl.searchParams.get("q")||"").trim().toLowerCase().slice(0,100);
 try{
  const [rows,total]=await Promise.all([listSignups(pageRaw,term),dbCount()]);
  return NextResponse.json({ok:true,rows,total,page:pageRaw,pageSize:50},{headers});
 }catch{
  return NextResponse.json({ok:false,message:"Неуспешно зареждане от базата на Enchev."},{status:503,headers});
 }
}
