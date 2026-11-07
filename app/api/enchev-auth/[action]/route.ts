import { NextRequest } from "next/server";
import {enchevLegalStatus} from "../../../lib/enchev-legal";
import {
  authConfig,authUnavailable,json,bodyFields,sameOriginPost,
  authCookie,providerRequest,parseProviderSession,setAuthCookies,
  clearAuthCookies,safeUser,
} from "../../../lib/enchev-auth-server";

export const dynamic = "force-dynamic";

type Params = { params:Promise<{action:string}> };
const deny = () => json({ok:false,error:"Request not allowed."},400);

function accountAgeDays(raw:unknown):number|null{
  if(!raw||typeof raw!=="object")return null;
  const created=(raw as Record<string,unknown>).created_at;
  if(typeof created!=="string")return null;
  const ms=Date.parse(created);
  if(!Number.isFinite(ms)||ms>Date.now())return null;
  return Math.floor((Date.now()-ms)/(24*60*60*1000));
}
function readRegistration(raw:unknown){
 if(!raw || typeof raw!=="object" || Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 const name=(field:string,max=60)=>typeof v[field]==="string"?v[field].trim().replace(/\s+/g," ").slice(0,max+1):"";
 const firstName=name("firstName"),lastName=name("lastName");
 const buyerType=v.buyerType;
 const country=v.country;
 const phone=typeof v.phone==="string"?v.phone.replace(/[\s().-]/g,""):"";
 const businessName=name("businessName",160),businessNumber=name("businessNumber",40);
 const countryName=name("countryName",80);
 const allowed=["BG","ES","DE","FR","IT","RO","GR","NL","BE","AT","PL","PT","TR","GB","OTHER"];
 if(firstName.length<1||firstName.length>60||lastName.length<1||lastName.length>60)return null;
 if(buyerType!=="individual"&&buyerType!=="business")return null;
 if(typeof country!=="string"||!allowed.includes(country))return null;
 if(country===allowed[allowed.length-1]&&(!countryName||countryName.length>80))return null;
 if(!/^\+[1-9]\d{6,14}$/.test(phone))return null;
 if(buyerType==="business"&&(!businessName||businessName.length>160||!businessNumber||businessNumber.length>40))return null;
 if(v.ageConfirmed!==true||v.termsAccepted!==true||v.privacyAcknowledged!==true)return null;
 if(typeof v.marketingConsent!=="boolean")return null;
 return {firstName,lastName,buyerType,country,countryName,phone,businessName,businessNumber,marketingConsent:v.marketingConsent};
}

async function currentUser(request:NextRequest,config:NonNullable<ReturnType<typeof authConfig>>) {
  const access=authCookie(request,"access");
  if (!access) return null;
  const result=await providerRequest(config,"/auth/v1/user","GET",access);
  if (!result || result.status!==200) return null;
  const user=safeUser(result.data);
  return user?{...user,accountAgeDays:accountAgeDays(result.data)}:null;
}

export async function GET(request:NextRequest,context:Params){
  const {action}=await context.params;
  if (action!=="session") return deny();
  const config=authConfig();
  const legalReady=enchevLegalStatus().approved;
  if (!config) return json({ok:true,available:false,authenticated:false,legalReady:false});
  const user=await currentUser(request,config);
  if (user) return json({ok:true,available:true,authenticated:true,legalReady,user});

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
        const response=json({ok:true,available:true,authenticated:true,legalReady,user:{...refreshedUser,accountAgeDays:accountAgeDays(verified?.data)}});
        setAuthCookies(response,session);
        return response;
      }
    }
  }
  const response=json({ok:true,available:true,authenticated:false,legalReady});
  clearAuthCookies(response);
  return response;
}

export async function POST(request:NextRequest,context:Params){
  if (!sameOriginPost(request)) return json({ok:false,error:"Invalid request origin."},403);
  const {action}=await context.params;
  if (!["sign-up","sign-in","sign-out"].includes(action)) return deny();
  const config=authConfig();
  if (!config) return authUnavailable();

  if (action==="sign-out"){
    const access=authCookie(request,"access");
    // Revoke the current provider session if possible; always clear browser cookies.
    if (access) await providerRequest(config,"/auth/v1/logout","POST",access);
    const response=json({ok:true});
    clearAuthCookies(response);
    return response;
  }

  const credentials=await bodyFields(request);
  if (!credentials) return json({ok:false,error:"Enter a valid email and a password of 12–128 characters."},400);
  const {email,password}=credentials;

  if (action==="sign-up"){
    const legal=enchevLegalStatus();
    if(!legal.approved)return json({ok:false,available:false,error:"Legal documents and operator details require approval before registration."},503);
    const registration=readRegistration(credentials.registration);
    if(!registration)return json({ok:false,error:"Invalid contact details or required acknowledgements."},400);
    const siteOrigin=process.env.ENCHEV_AUTH_SITE_ORIGIN?.trim();
    // Only a fixed configured HTTPS origin may receive verification links.
    if (!siteOrigin || !/^https:\/\/[^/]+$/.test(siteOrigin) || new URL(siteOrigin).username) return authUnavailable();
    const provider=await providerRequest(config,
      "/auth/v1/signup?redirect_to="+encodeURIComponent(siteOrigin+"/login?verified=1"),
      "POST",undefined,{email,password,data:{
        enchev_first_name:registration.firstName,
        enchev_last_name:registration.lastName,
        enchev_country:registration.country,
        enchev_country_name:registration.countryName,
        enchev_phone:registration.phone,
        enchev_buyer_type:registration.buyerType,
        enchev_business_name:registration.businessName,
        enchev_business_number:registration.businessNumber,
        enchev_legal_version:legal.version,
        enchev_terms_accepted_at:new Date().toISOString(),
        enchev_privacy_notice_read:true,
        enchev_marketing_opt_in:registration.marketingConsent,
      }});
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
