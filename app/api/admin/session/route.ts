import {NextRequest,NextResponse} from "next/server";
import {PRIVATE_HEADERS,adminCookies,clearAdminCookies,refreshAdminTokens,setAdminCookies,verifiedGoogleAdmin} from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const {access,refresh}=adminCookies(request);
  if(access){
    const admin=await verifiedGoogleAdmin(access);
    if(admin)return NextResponse.json({authorized:true,email:admin.email},{headers:PRIVATE_HEADERS});
  }
  if(refresh){
    const tokens=await refreshAdminTokens(refresh);
    if(tokens){
      const admin=await verifiedGoogleAdmin(tokens.access_token);
      if(admin){
        const response=NextResponse.json({authorized:true,email:admin.email},{headers:PRIVATE_HEADERS});
        setAdminCookies(response,tokens);
        return response;
      }
    }
  }
  const response=NextResponse.json({authorized:false},{status:401,headers:PRIVATE_HEADERS});
  clearAdminCookies(response);
  return response;
}
