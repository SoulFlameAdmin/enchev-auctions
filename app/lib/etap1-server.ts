import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export type GuestRole = "guest1" | "guest2" | "guest3" | "guest4" | "guest5";
export type Etap1Role = "admin" | "mitko" | "borko" | "enchev" | GuestRole;
export const ETAP1_GUEST_ROLES: readonly GuestRole[] = ["guest1", "guest2", "guest3", "guest4", "guest5"];
export const ETAP1_ROLES: readonly Etap1Role[] = ["admin", "mitko", "borko", "enchev", ...ETAP1_GUEST_ROLES];
const SHARED_SOULFLAME_PROJECT = "frhletkiuupgksmgxoxc";
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-enchev-etap1" : "enchev-etap1-dev";
// Admin and bidder must NOT share a browser cookie: opening the monitor
// in another tab must never replace a bidder\'s admission/session.
const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-enchev-etap1-admin" : "enchev-etap1-admin-dev";

type Config = {
  url: string; key: string; secret: string;
  codes: Record<"admin" | "mitko" | "borko" | "enchev", string>;
};

export function etap1Config(): Config | null {
  if (process.env.ENCHEV_ETAP1_ENABLED !== "true") return null;
  const ref = process.env.ENCHEV_ETAP1_PROJECT_REF?.trim();
  const rawUrl = process.env.ENCHEV_ETAP1_SUPABASE_URL?.trim();
  const key = process.env.ENCHEV_ETAP1_SERVICE_ROLE_KEY?.trim();
  const secret = process.env.ENCHEV_ETAP1_SESSION_SECRET?.trim();
  const codes: Config["codes"] = {
    admin: process.env.ENCHEV_ETAP1_ADMIN_CODE?.trim() ?? "",
    mitko: process.env.ENCHEV_ETAP1_MITKO_CODE?.trim() ?? "",
    borko: process.env.ENCHEV_ETAP1_BORKO_CODE?.trim() ?? "",
    enchev: process.env.ENCHEV_ETAP1_ENCHEV_CODE?.trim() ?? "",
  };
  if (!ref || ref === SHARED_SOULFLAME_PROJECT || !rawUrl || !key || !secret || secret.length < 32) return null;
  // Short participant-only codes are permitted exclusively for the closed, fake-money Vercel Preview.
  // Admin always requires a high-entropy 16+ character secret. Production continues to require long codes.
  const shortDemoCodes = process.env.VERCEL_ENV === "preview" &&
    codes.mitko === "mitko" && codes.borko === "borko" && codes.enchev === "enchev";
  const participantsHaveLongCodes = (["mitko", "borko", "enchev"] as const)
    .every(role => codes[role].length >= 16);
  if (codes.admin.length < 16 || (!shortDemoCodes && !participantsHaveLongCodes) ||
    new Set(Object.values(codes)).size !== 4) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.host !== ref + ".supabase.co" ||
      url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return { url: url.origin, key, secret, codes };
  } catch { return null; }
}

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueEtap1Cookie(response: NextResponse, role: Etap1Role, sid: string, config: Config) {
  const payload = Buffer.from(JSON.stringify({
    role, sid, exp: Date.now() + 6 * 60 * 60 * 1000, ver: 2,
  })).toString("base64url");
  response.cookies.set(role==="admin"?ADMIN_COOKIE:COOKIE, payload + "." + sign(payload, config.secret), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: 6 * 60 * 60,
  });
}

export function clearEtap1Cookie(response: NextResponse, scope: "admin" | "bidder" = "bidder") {
  response.cookies.set(scope==="admin"?ADMIN_COOKIE:COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: 0,
  });
}

export type Etap1Session = { role: Etap1Role; sid: string };

export function etap1Session(request: NextRequest, config: Config, scope: "admin" | "bidder" = "bidder"): Etap1Session | null {
  const token = request.cookies.get(scope==="admin"?ADMIN_COOKIE:COOKIE)?.value;
  if (!token || token.length > 1000) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = Buffer.from(sign(parts[0], config.secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string,unknown>;
    if (data.ver !== 2 || typeof data.sid !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.sid) ||
      typeof data.exp !== "number" ||
      data.exp <= Date.now() || data.exp > Date.now() + 6 * 60 * 60 * 1000 + 60000 ||
      !ETAP1_ROLES.includes(data.role as Etap1Role) ||
      (scope==="admin" && data.role!=="admin") ||
      (scope==="bidder" && data.role==="admin")) return null;
    return {role:data.role as Etap1Role,sid:data.sid};
  } catch { return null; }
}

export function sessionRole(request: NextRequest, config: Config): Etap1Role | null {
  return etap1Session(request,config)?.role??null;
}

export function codeValid(role: Etap1Role, code: string, config: Config): boolean {
  if (code.length > 256) return false;
  // Investor demo PIN is intentionally short and ONLY works in the isolated,
  // fake-money preview when the branch's explicit guest switch is enabled.
  // It never grants operator access and cannot authenticate production.
  if (ETAP1_GUEST_ROLES.includes(role as GuestRole)) {
    return process.env.VERCEL_ENV === "preview" &&
      process.env.VERCEL_GIT_COMMIT_REF === "feat/investor-demo-guests-20261016" && code === "0000";
  }
  const left = createHmac("sha256", config.secret).update(code).digest();
  const right = createHmac("sha256", config.secret).update(config.codes[role as keyof Config["codes"]]).digest();
  return timingSafeEqual(left, right);
}

export function etap1Json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function etap1Body(request: NextRequest): Promise<Record<string,unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
    Number(request.headers.get("content-length") || 0) > 4096) return null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string,unknown>;
  } catch { return null; }
}

export async function etap1Rpc(config: Config, name: "etap1_snapshot"|"etap1_start"|"etap1_bid"|"etap1_ready_lobby"|"etap1_ready_lobby_secure"|"etap1_join_lobby_automatic"|"etap1_bid_admitted"|"etap1_bid_offer_secure"|"etap1_wallet_update_secure"|"etap1_admin_code_matches"|"etap1_device_signout",
  params: Record<string,unknown> = {}): Promise<unknown> {
  const response = await fetch(config.url + "/rest/v1/rpc/" + name, {
    method: "POST", cache: "no-store",
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Etap1 provider rejected RPC " + name + " (" + response.status + ")");
  return response.json();
}
