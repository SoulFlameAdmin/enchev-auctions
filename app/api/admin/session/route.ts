import {NextRequest,NextResponse} from "next/server";
import {PRIVATE_HEADERS,clearAdminCookies,resolveAuthorizedGoogleAdmin,setAdminCookies} from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const admin=await resolveAuthorizedGoogleAdmin(request);
  if(!admin){
    const response=NextResponse.json({authorized:false},{status:401,headers:PRIVATE_HEADERS});
    clearAdminCookies(response);
    return response;
  }
  const response=NextResponse.json({authorized:true,email:admin.email},{headers:PRIVATE_HEADERS});
  if(admin.freshTokens)setAdminCookies(response,admin.freshTokens);
  return response;
}
