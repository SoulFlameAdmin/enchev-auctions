import "server-only";
import { NextRequest, NextResponse } from "next/server";

/** ENCHEV identity is intentionally isolated from the shared SoulFlame/Twins
 * governance project. Auth stays OFF until dedicated-project settings exist.
 * Never expose the Supabase API key or session tokens to the browser.
 */
const SHARED_GOVERNANCE_REF = "frhletkiuupgksmgxoxc";
const ACCESS_NAME = process.env.NODE_ENV === "production" ? "__Host-enchev-at" : "enchev-dev-at";
const REFRESH_NAME = process.env.NODE_ENV === "production" ? "__Host-enchev-rt" : "enchev-dev-rt";
// Kept separate from buyer login cookies: a recovery link is NOT a buyer login.
const RESET_NAME = process.env.NODE_ENV === "production" ? "__Host-enchev-reset" : "enchev-dev-reset";

export type BuyerAuthConfig = { url: string; anonKey: string };

export function authConfig(): BuyerAuthConfig | null {
  if (process.env.ENCHEV_AUTH_ENABLED !== "true") return null;
  const url = process.env.ENCHEV_AUTH_URL?.trim();
  const anonKey = process.env.ENCHEV_AUTH_ANON_KEY?.trim();
  const expectedRef = process.env.ENCHEV_AUTH_PROJECT_REF?.trim();
  if (!url || !anonKey || !expectedRef || expectedRef === SHARED_GOVERNANCE_REF) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password
      || parsed.pathname !== "/" || parsed.search || parsed.hash
      || parsed.hostname !== `${expectedRef}.supabase.co`) return null;
    return { url: parsed.origin, anonKey };
  } catch {
    return null;
  }
}

export function authUnavailable() {
  return json({ ok: false, available: false, error: "Accounts are not yet enabled for this preview." }, 503);
}

export function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, private",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function bodyFields(request: NextRequest): Promise<{email:string;password:string}|null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length") || 0) > 4096) return null;
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string,unknown>;
    if (typeof record.email !== "string" || typeof record.password !== "string") return null;
    const email = record.email.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    if (record.password.length < 12 || record.password.length > 128) return null;
    return { email, password: record.password };
  } catch { return null; }
}

export function sameOriginPost(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.host.toLowerCase() !== host || parsed.username || parsed.password) return false;
    // Production is HTTPS; only local loopback development/test may use HTTP.
    const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) return false;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    if (forwardedProtocol && parsed.protocol !== forwardedProtocol.toLowerCase() + ":") return false;
    return true;
  } catch { return false; }
}

export function authCookie(request: NextRequest, key: "access"|"refresh") {
  return request.cookies.get(key === "access" ? ACCESS_NAME : REFRESH_NAME)?.value ?? "";
}

export type ProviderSession = { access_token: string; refresh_token: string; expires_in: number };
export function parseProviderSession(data: unknown): ProviderSession | null {
  if (!data || typeof data !== "object") return null;
  const v = data as Record<string,unknown>;
  if (typeof v.access_token !== "string" || !v.access_token || typeof v.refresh_token !== "string" || !v.refresh_token) return null;
  if (typeof v.expires_in !== "number" || !Number.isFinite(v.expires_in)) return null;
  return { access_token:v.access_token, refresh_token:v.refresh_token, expires_in:v.expires_in };
}

export function setAuthCookies(response: NextResponse, session: ProviderSession) {
  const common = { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax" as const, path:"/" };
  response.cookies.set(ACCESS_NAME,session.access_token,{...common,maxAge:Math.max(60,Math.min(3600,Math.floor(session.expires_in)))});
  response.cookies.set(REFRESH_NAME,session.refresh_token,{...common,maxAge:60*60*24*14});
}
export function clearAuthCookies(response: NextResponse) {
  for (const name of [ACCESS_NAME, REFRESH_NAME]) response.cookies.set(name,"",{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0,
  });
}

export async function providerRequest(
  config:BuyerAuthConfig,path:string,method:"GET"|"POST"|"PUT",bearer:string|undefined,body?:Record<string,unknown>
): Promise<{status:number;data:unknown}|null> {
  try {
    const response = await fetch(config.url+path,{
      method,
      headers:{
        apikey: config.anonKey,
        ...(bearer?{Authorization:`Bearer ${bearer}`}:{}),
        ...(body?{"Content-Type":"application/json"}:{}),
      },
      body:body?JSON.stringify(body):undefined,
      cache:"no-store",
      signal:AbortSignal.timeout(10000),
    });
    return {status:response.status,data:await response.json().catch(()=>null)};
  } catch { return null; }
}
export function safeUser(data: unknown): {id:string;email:string}|null {
  if (!data || typeof data !== "object") return null;
  const user=data as Record<string,unknown>;
  return typeof user.id==="string" && typeof user.email==="string"
    ? {id:user.id,email:user.email} : null;
}


/** Strict bounded JSON parser for recovery actions. Never log credential material. */
async function recoveryBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(length) || length > 4096 || length < 0) return null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function recoveryEmail(request: NextRequest): Promise<string | null> {
  const value = await recoveryBody(request);
  if (!value || typeof value.email !== "string") return null;
  const email = value.email.trim().toLowerCase();
  return email.length <= 254 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ? email : null;
}

export async function recoveryAccessToken(request: NextRequest): Promise<string | null> {
  const value = await recoveryBody(request);
  if (!value || value.type !== "recovery" || typeof value.access_token !== "string") return null;
  const token = value.access_token;
  return token.length >= 32 && token.length <= 4096 && /^[A-Za-z0-9._~-]+$/.test(token) ? token : null;
}

export async function recoveryNewPassword(request: NextRequest): Promise<string | null> {
  const value = await recoveryBody(request);
  return value && typeof value.password === "string" && value.password.length >= 12 && value.password.length <= 128
    ? value.password : null;
}

export function recoveryRedirect(): string | null {
  const configured = process.env.ENCHEV_AUTH_SITE_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const origin = new URL(configured);
    if (origin.protocol !== "https:" || origin.origin !== configured ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
    return origin.origin + "/reset-password";
  } catch { return null; }
}

export function readResetCookie(request: NextRequest): string {
  return request.cookies.get(RESET_NAME)?.value ?? "";
}

export function setResetCookie(response: NextResponse, accessToken: string) {
  // Maximum ten minutes; no refresh token and no signed-in buyer session.
  response.cookies.set(RESET_NAME, accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: 600,
  });
}
export function clearResetCookie(response: NextResponse) {
  response.cookies.set(RESET_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: 0,
  });
}
