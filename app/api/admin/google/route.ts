import {createHash,randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {PKCE_COOKIE,SITE_URL} from "../../../lib/admin-google-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){
  const verifier=randomBytes(48).toString("base64url");
  const challenge=createHash("sha256").update(verifier).digest("base64url");
  const callback=SITE_URL+"/api/admin/callback";
  const url=new URL("https://ejfrnjhlggebzmpmxajl.supabase.co/auth/v1/authorize");
  url.searchParams.set("provider","google");
  url.searchParams.set("redirect_to",callback);
  url.searchParams.set("code_challenge",challenge);
  url.searchParams.set("code_challenge_method","s256");
  const response=NextResponse.redirect(url.toString(),{status:302,headers:{"Cache-Control":"no-store"}});
  response.cookies.set(PKCE_COOKIE,verifier,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});
  return response;
}
