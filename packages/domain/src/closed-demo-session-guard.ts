/**
 * MISSION-003 — server-side CLOSED DEMO session verification foundation.
 *
 * Import directly in trusted server code only. This is NOT a login provider,
 * API endpoint, Supabase adapter, or authorization to use real production data.
 * The caller MUST authenticate the actor before issuing a ticket and MUST
 * back readSession/readRoster with trusted server-side authoritative records.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  requireIssuedClosedDemoBoundary,
  type ClosedDemoBoundary
} from "./closed-demo-isolation.js";
import {
  CLOSED_DEMO_ROLES,
  createClosedDemoRoleRoster,
  evaluateClosedDemoRolePolicy,
  type ClosedDemoAction,
  type ClosedDemoIdentityRecord,
  type ClosedDemoPolicyDecision,
  type ClosedDemoRole,
  type ClosedDemoTarget
} from "./closed-demo-roles.js";

const AUDIENCE = "ENCHEV_CLOSED_DEMO_SESSION_V1";
const SIGNING_CONTEXT = "ENCHEV_CLOSED_DEMO_SESSION_V1\n";
const MAX_TICKET_LIFETIME_MS = 15 * 60 * 1000;
const idPattern = /^demo-[a-z0-9][a-z0-9_-]{2,63}$/;
const sessionPattern = /^[A-Za-z0-9_-]{16,128}$/;

type SessionTicketPayload = Readonly<{
  v: 1;
  audience: typeof AUDIENCE;
  namespace: string;
  sessionId: string;
  issuedAtMs: number;
  expiresAtMs: number;
}>;

export type ClosedDemoAuthoritySession = Readonly<{
  sessionId: string;
  subjectId: string;
  role: ClosedDemoRole;
  namespace: string;
  status: "active" | "revoked";
  expiresAtMs: number;
}>;

export type ClosedDemoReadAuthority = Readonly<{
  /** Must read from the isolated authoritative session store, not a browser. */
  readSession: (sessionId: string) => Promise<unknown>;
  /** Must read an authoritative distinct five-role roster in the same scope. */
  readRoster: (namespace: string) => Promise<unknown>;
}>;

export type ClosedDemoAuthDecision = ClosedDemoPolicyDecision | Readonly<{
  permitted: false;
  reason:
    "INVALID_BOUNDARY" | "INVALID_TICKET" | "TICKET_EXPIRED" |
    "AUTHORITY_UNAVAILABLE" | "SESSION_INACTIVE" |
    "ROSTER_MISMATCH";
}>;

function denied(reason: Exclude<ClosedDemoAuthDecision["reason"], "ALLOW">): ClosedDemoAuthDecision {
  return Object.freeze({ permitted: false, reason });
}

function validNow(nowMs: number): boolean {
  return Number.isSafeInteger(nowMs) && nowMs >= 0;
}

function assertSecret(secret: Uint8Array): void {
  if (!(secret instanceof Uint8Array) || secret.byteLength < 32) {
    throw new Error("ENCHEV_MISSION003:SESSION_SECRET_NOT_CONFIGURED");
  }
}

function canonicalSignature(payload: string, secret: Uint8Array): Buffer {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT).update(payload).digest();
}

function verifyTicket(
  boundary: ClosedDemoBoundary,
  token: string,
  secret: Uint8Array,
  nowMs: number
): { payload: SessionTicketPayload } | { error: "INVALID_TICKET" | "TICKET_EXPIRED" } {
  if (typeof token !== "string" || token.length > 1024 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return { error: "INVALID_TICKET" };
  const [encoded, encodedMac] = token.split(".");
  try {
    const provided = Buffer.from(encodedMac, "base64url");
    if (provided.length !== 32 ||
        provided.toString("base64url") !== encodedMac ||
        !timingSafeEqual(provided, canonicalSignature(encoded, secret))) {
      return { error: "INVALID_TICKET" };
    }
    const jsonBytes = Buffer.from(encoded, "base64url");
    if (jsonBytes.toString("base64url") !== encoded) return { error: "INVALID_TICKET" };
    const value: unknown = JSON.parse(jsonBytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "INVALID_TICKET" };
    const p = value as Record<string, unknown>;
    if (Object.keys(p).sort().join(",") !==
        "audience,expiresAtMs,issuedAtMs,namespace,sessionId,v" ||
        p.v !== 1 || p.audience !== AUDIENCE ||
        p.namespace !== boundary.namespace ||
        typeof p.sessionId !== "string" || !sessionPattern.test(p.sessionId) ||
        typeof p.issuedAtMs !== "number" || !validNow(p.issuedAtMs) ||
        typeof p.expiresAtMs !== "number" || !validNow(p.expiresAtMs) ||
        p.expiresAtMs <= p.issuedAtMs ||
        p.expiresAtMs - p.issuedAtMs > MAX_TICKET_LIFETIME_MS ||
        p.issuedAtMs > nowMs) return { error: "INVALID_TICKET" };
    if (nowMs >= p.expiresAtMs) return { error: "TICKET_EXPIRED" };
    return { payload: p as SessionTicketPayload };
  } catch {
    return { error: "INVALID_TICKET" };
  }
}

/**
 * Issue only AFTER a trusted server login and authoritative identity/session
 * admission. No route in this PR exposes this function to browser input.
 */
export function issueClosedDemoSessionTicket(
  boundary: ClosedDemoBoundary,
  sessionId: string,
  nowMs: number,
  secret: Uint8Array
): string {
  requireIssuedClosedDemoBoundary(boundary);
  assertSecret(secret);
  if (typeof sessionId !== "string" || !sessionPattern.test(sessionId) || !validNow(nowMs) ||
      !Number.isSafeInteger(nowMs + MAX_TICKET_LIFETIME_MS)) {
    throw new Error("ENCHEV_MISSION003:INVALID_SESSION_ISSUANCE");
  }
  const payload: SessionTicketPayload = Object.freeze({
    v: 1,
    audience: AUDIENCE,
    namespace: boundary.namespace,
    sessionId,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + MAX_TICKET_LIFETIME_MS
  });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return encoded + "." + canonicalSignature(encoded, secret).toString("base64url");
}

function asAuthoritySession(raw: unknown, expected: SessionTicketPayload): ClosedDemoAuthoritySession | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.sessionId !== "string" || v.sessionId !== expected.sessionId ||
      typeof v.subjectId !== "string" || !idPattern.test(v.subjectId) ||
      !CLOSED_DEMO_ROLES.includes(v.role as ClosedDemoRole) ||
      v.namespace !== expected.namespace || v.status !== "active" ||
      typeof v.expiresAtMs !== "number" || !validNow(v.expiresAtMs)) return null;
  return v as ClosedDemoAuthoritySession;
}

function asAuthorityRoster(raw: unknown): ClosedDemoIdentityRecord[] | null {
  if (!Array.isArray(raw) || raw.length !== CLOSED_DEMO_ROLES.length) return null;
  return raw as ClosedDemoIdentityRecord[];
}

/**
 * Fail closed unless the ticket AND the current session AND the current roster
 * ALL agree. No trust in request-supplied role, email, actor or resource owner.
 */
export async function authorizeClosedDemoTicket(
  boundary: ClosedDemoBoundary,
  ticket: string,
  secret: Uint8Array,
  nowMs: number,
  authority: ClosedDemoReadAuthority,
  action: ClosedDemoAction,
  target: ClosedDemoTarget
): Promise<ClosedDemoAuthDecision> {
  try { requireIssuedClosedDemoBoundary(boundary); }
  catch { return denied("INVALID_BOUNDARY"); }
  try { assertSecret(secret); }
  catch { return denied("AUTHORITY_UNAVAILABLE"); }
  if (!validNow(nowMs)) return denied("INVALID_TICKET");
  const verification = verifyTicket(boundary, ticket, secret, nowMs);
  if ("error" in verification) return denied(verification.error);
  if (!authority || typeof authority.readSession !== "function" ||
      typeof authority.readRoster !== "function") return denied("AUTHORITY_UNAVAILABLE");
  try {
    const session = asAuthoritySession(
      await authority.readSession(verification.payload.sessionId),
      verification.payload
    );
    if (!session || session.expiresAtMs <= nowMs) return denied("SESSION_INACTIVE");
    const identities = asAuthorityRoster(await authority.readRoster(boundary.namespace));
    if (!identities) return denied("ROSTER_MISMATCH");
    const roster = createClosedDemoRoleRoster(boundary, identities);
    const principal = roster.identities.find(x => x.sessionId === session.sessionId);
    if (!principal || principal.subjectId !== session.subjectId ||
        principal.role !== session.role) return denied("ROSTER_MISMATCH");
    return evaluateClosedDemoRolePolicy(roster, session.subjectId, session.sessionId, action, target);
  } catch {
    return denied("AUTHORITY_UNAVAILABLE");
  }
}
