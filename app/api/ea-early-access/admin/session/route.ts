import { NextRequest, NextResponse } from "next/server";
import { supabaseConfig } from "../../../../../lib/ea-early-access";
import { clearAdminCookies, resolveAuthorizedGoogleAdmin, setAdminCookies, PRIVATE_HEADERS } from "../../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const admin=await resolveAuthorizedGoogleAdmin(request);
 const response=NextResponse.json({authenticated:Boolean(admin),configured:Boolean(supabaseConfig())},{headers:PRIVATE_HEADERS});
 if(admin?.freshTokens)setAdminCookies(response,admin.freshTokens);
 return response;
}
export async function POST(){
 return NextResponse.json({ok:false,message:"Входът с администраторски код е заменен с Google."},{status:403,headers:PRIVATE_HEADERS});
}
export async function DELETE(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({ok:false},{status:403,headers:PRIVATE_HEADERS});
 const response=NextResponse.json({ok:true},{headers:PRIVATE_HEADERS});
 clearAdminCookies(response);
 return response;
}
