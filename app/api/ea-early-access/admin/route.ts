import { NextRequest, NextResponse } from "next/server";
import { dbCount, listSignups, supabaseConfig } from "../../../../lib/ea-early-access";
import { resolveAuthorizedGoogleAdmin, setAdminCookies } from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private,no-store","Vary":"Cookie"};
 const admin=await resolveAuthorizedGoogleAdmin(request);
 if(!admin)return NextResponse.json({ok:false,message:"Вход с одобрен Google профил е задължителен."},{status:401,headers});
 if(!supabaseConfig())return NextResponse.json({ok:false,message:"Enchev Supabase не е свързан."},{status:503,headers});
 const pageRaw=Number(request.nextUrl.searchParams.get("page")||"0");
 if(!Number.isSafeInteger(pageRaw)||pageRaw<0||pageRaw>10000)return NextResponse.json({ok:false},{status:400,headers});
 const term=(request.nextUrl.searchParams.get("q")||"").trim().toLowerCase().slice(0,100);
 try{
  const [rows,total]=await Promise.all([listSignups(pageRaw,term),dbCount()]);
  const response=NextResponse.json({ok:true,rows,total,page:pageRaw,pageSize:50},{headers});
  if(admin.freshTokens)setAdminCookies(response,admin.freshTokens);
  return response;
 }catch{
  return NextResponse.json({ok:false,message:"Неуспешно зареждане от базата на Enchev."},{status:503,headers});
 }
}
