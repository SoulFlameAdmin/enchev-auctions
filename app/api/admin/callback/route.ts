import {NextRequest,NextResponse} from "next/server";
import {PKCE_COOKIE,SITE_URL,PRIVATE_HEADERS,clearPkceCookie,isApprovedGoogleAdmin,parseAdminTokens,providerFetch,setAdminCookies} from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
function failure(reason:"failed"|"denied"){
  const response=NextResponse.redirect(SITE_URL+"/admin/login?error="+reason,{status:303,headers:PRIVATE_HEADERS});
  clearPkceCookie(response);
  return response;
}
export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get("code");
  const verifier=request.cookies.get(PKCE_COOKIE)?.value;
  if(!code||!verifier||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))return failure("failed");
  const sessionResponse=await providerFetch("token?grant_type=pkce","POST",undefined,{auth_code:code,code_verifier:verifier});
  if(!sessionResponse?.ok)return failure("failed");
  const session=parseAdminTokens(await sessionResponse.json().catch(()=>null));
  if(!session)return failure("failed");
  const userResponse=await providerFetch("user","GET",session.access_token);
  const user=userResponse?.ok?await userResponse.json().catch(()=>null):null;
  if(!isApprovedGoogleAdmin(user))return failure("denied");
  const response=NextResponse.redirect(SITE_URL+"/",{status:303,headers:PRIVATE_HEADERS});
  clearPkceCookie(response);
  setAdminCookies(response,session);
  return response;
}
