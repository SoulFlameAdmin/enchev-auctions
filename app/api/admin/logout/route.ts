import {NextRequest,NextResponse} from "next/server";
import {PRIVATE_HEADERS,adminCookies,clearAdminCookies,providerFetch} from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin && origin!==request.nextUrl.origin)return NextResponse.json({ok:false},{status:403,headers:PRIVATE_HEADERS});
  const {access}=adminCookies(request);
  if(access)await providerFetch("logout","POST",access);
  const response=NextResponse.json({ok:true},{headers:PRIVATE_HEADERS});
  clearAdminCookies(response);
  return response;
}
