import { NextRequest } from "next/server";
import {
  authConfig,authUnavailable,json,bodyFields,sameOriginPost,
  authCookie,providerRequest,parseProviderSession,setAuthCookies,
  clearAuthCookies,safeUser,recoveryEmail,recoveryAccessToken,
  recoveryNewPassword,recoveryRedirect,readResetCookie,setResetCookie,clearResetCookie,
} from "../../../lib/enchev-auth-server";

export const dynamic = "force-dynamic";

type Params = { params:Promise<{action:string}> };
const deny = () => json({ok:false,error:"Request not allowed."},400);

async function currentUser(request:NextRequest,config:NonNullable<ReturnType<typeof authConfig>>) {
  const access=authCookie(request,"access");
  if (!access) return null;
  const result=await providerRequest(config,"/auth/v1/user","GET",access);
  if (!result || result.status!==200) return null;
  return safeUser(result.data);
}

export async function GET(request:NextRequest,context:Params){
  const {action}=await context.params;
  if (action!=="session") return deny();
  const config=authConfig();
  if (!config) return json({ok:true,available:false,authenticated:false});
  const user=await currentUser(request,config);
  if (user) return json({ok:true,available:true,authenticated:true,user});

  // Access tokens are short lived; refresh only with the server-held HTTP-only
  // refresh token. Never hand tokens to the client or trust cookie claims.
  const refresh=authCookie(request,"refresh");
  if (refresh){
    const next=await providerRequest(config,"/auth/v1/token?grant_type=refresh_token","POST",undefined,{refresh_token:refresh});
    const session=next && next.status===200 ? parseProviderSession(next.data):null;
    if (session){
      const verified=await providerRequest(config,"/auth/v1/user","GET",session.access_token);
      const refreshedUser=verified?.status===200?safeUser(verified.data):null;
      if (refreshedUser){
        const response=json({ok:true,available:true,authenticated:true,user:refreshedUser});
        setAuthCookies(response,session);
        return response;
      }
    }
  }
  const response=json({ok:true,available:true,authenticated:false});
  clearAuthCookies(response);
  return response;
}

export async function POST(request:NextRequest,context:Params){
  if (!sameOriginPost(request)) return json({ok:false,error:"Invalid request origin."},403);
  const {action}=await context.params;
  if (!["sign-up","sign-in","sign-out","request-reset","verify-recovery","set-new-password"].includes(action)) return deny();
  const config=authConfig();
  if (!config) return authUnavailable();

  if (action==="sign-out"){
    const access=authCookie(request,"access");
    // Revoke the current provider session if possible; always clear browser cookies.
    if (access) await providerRequest(config,"/auth/v1/logout","POST",access);
    const response=json({ok:true});
    clearAuthCookies(response);
    clearResetCookie(response);
    return response;
  }

  if (action==="request-reset"){
    const email=await recoveryEmail(request);
    if (!email) return json({ok:false,error:"Enter a valid email address."},400);
    const redirect=recoveryRedirect();
    if (!redirect) return authUnavailable();
    const provider=await providerRequest(config,
      "/auth/v1/recover?redirect_to="+encodeURIComponent(redirect),
      "POST",undefined,{email});
    if (!provider || provider.status>=500) return json({ok:false,error:"Identity service temporarily unavailable."},503);
    if (provider.status===429) return json({ok:false,error:"Too many attempts. Try again later."},429);
    // Do not disclose whether an email address exists.
    return json({ok:true,message:"If an account exists for this email, a password-reset link will arrive shortly."});
  }

  if (action==="verify-recovery"){
    const token=await recoveryAccessToken(request);
    if (!token) return json({ok:false,error:"Invalid or expired recovery link."},400);
    const verified=await providerRequest(config,"/auth/v1/user","GET",token);
    if (!verified || verified.status!==200 || !safeUser(verified.data))
      return json({ok:false,error:"Invalid or expired recovery link."},401);
    const response=json({ok:true,recoveryReady:true});
    // Recovery credential can only be used by the password-change endpoint.
    clearAuthCookies(response);
    setResetCookie(response,token);
    return response;
  }

  if (action==="set-new-password"){
    const password=await recoveryNewPassword(request);
    if (!password) return json({ok:false,error:"Use a new password of 12–128 characters."},400);
    const token=readResetCookie(request);
    if (!token) return json({ok:false,error:"Recovery session expired. Request a new link."},401);
    const verified=await providerRequest(config,"/auth/v1/user","GET",token);
    if (!verified || verified.status!==200 || !safeUser(verified.data))
      return json({ok:false,error:"Recovery session expired. Request a new link."},401);
    const updated=await providerRequest(config,"/auth/v1/user","PUT",token,{password});
    if (!updated || updated.status!==200 || !safeUser(updated.data))
      return json({ok:false,error:"Password was not updated. Try again or request a new link."},400);
    // Invalidate the recovery session, require an explicit sign-in afterward.
    await providerRequest(config,"/auth/v1/logout","POST",token);
    const response=json({ok:true,message:"Password updated. Sign in with your new password."});
    clearResetCookie(response);
    clearAuthCookies(response);
    return response;
  }

  const credentials=await bodyFields(request);
  if (!credentials) return json({ok:false,error:"Enter a valid email and a password of 12–128 characters."},400);
  const {email,password}=credentials;

  if (action==="sign-up"){
    const siteOrigin=process.env.ENCHEV_AUTH_SITE_ORIGIN?.trim();
    // Only a fixed configured HTTPS origin may receive verification links.
    if (!siteOrigin || !/^https:\/\/[^/]+$/.test(siteOrigin) || new URL(siteOrigin).username) return authUnavailable();
    const provider=await providerRequest(config,
      "/auth/v1/signup?redirect_to="+encodeURIComponent(siteOrigin+"/login?verified=1"),
      "POST",undefined,{email,password});
    if (!provider) return json({ok:false,error:"Identity service temporarily unavailable."},503);
    if (provider.status===429) return json({ok:false,error:"Too many attempts. Try again later."},429);
    // User enumeration cannot be inferred from our response.
    if (provider.status>=500) return json({ok:false,error:"Identity service temporarily unavailable."},503);
    return json({ok:true,verificationRequired:true,
      message:"If this email can register, check your inbox for the verification link. Then sign in."});
  }

  const provider=await providerRequest(config,
    "/auth/v1/token?grant_type=password","POST",undefined,{email,password});
  if (!provider) return json({ok:false,error:"Identity service temporarily unavailable."},503);
  if (provider.status===429) return json({ok:false,error:"Too many attempts. Try again later."},429);
  const session=provider.status===200?parseProviderSession(provider.data):null;
  if (!session) return json({ok:false,error:"Incorrect credentials or email not yet confirmed."},401);
  // Validate the issued token with GoTrue before storing it in the user's browser.
  const verified=await providerRequest(config,"/auth/v1/user","GET",session.access_token);
  const user=verified?.status===200?safeUser(verified.data):null;
  if (!user) return json({ok:false,error:"Could not validate the session."},503);
  const response=json({ok:true,authenticated:true,user});
  setAuthCookies(response,session);
  return response;
}
