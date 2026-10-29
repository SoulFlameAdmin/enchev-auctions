/**
 * MISSION-003 / CLOSED DEMO role-isolation policy.
 *
 * Pure, offline policy only. The calling server MUST authenticate a signed,
 * current session and bind it to an authoritative identity record BEFORE
 * using these checks. This module does not log a user in or grant DB access.
 */
import {
  requireIssuedClosedDemoBoundary,
  type ClosedDemoBoundary
} from "./closed-demo-isolation";

export const CLOSED_DEMO_ROLES = Object.freeze(["seller", "admin", "mitko", "borko", "automation"] as const);
export type ClosedDemoRole = typeof CLOSED_DEMO_ROLES[number];

export const CLOSED_DEMO_ACTIONS = Object.freeze([
  "vehicle:intake", "vehicle:submit", "vehicle:approve",
  "lot:create", "auction:start", "auction:read",
  "terms:accept", "bid:place", "document:preview",
  "audit:read"
] as const);
export type ClosedDemoAction = typeof CLOSED_DEMO_ACTIONS[number];

export type ClosedDemoIdentityRecord = Readonly<{
  role: ClosedDemoRole;
  subjectId: string;
  sessionId: string;
}>;

export type ClosedDemoTarget = Readonly<{
  namespace: string;
  kind: "vehicle" | "lot" | "auction" | "document" | "audit";
  id: string;
  sellerId?: string;
  buyerId?: string;
  demoWatermarked?: boolean;
}>;

export type ClosedDemoRoster = Readonly<{
  scope: "ENCHEV_CLOSED_DEMO_ROLE_ROSTER";
  namespace: string;
  identities: readonly ClosedDemoIdentityRecord[];
}>;

export type ClosedDemoPolicyDecision = Readonly<{
  permitted: boolean;
  reason: "ALLOW" | "INVALID_CONTEXT" | "UNVERIFIED_ROSTER" |
    "UNKNOWN_ACTOR" | "SESSION_MISMATCH" | "UNKNOWN_ACTION" |
    "UNSAFE_TARGET" | "ROLE_DENIED" | "OWNERSHIP_DENIED";
}>;

const issuedRosters = new WeakSet<object>();
const idPattern = /^demo-[a-z0-9][a-z0-9_-]{2,63}$/;
const sessionPattern = /^[a-zA-Z0-9_-]{16,128}$/;

const allowed: Readonly<Record<ClosedDemoRole, readonly ClosedDemoAction[]>> = Object.freeze({
  seller: Object.freeze(["vehicle:intake", "vehicle:submit", "document:preview"] as const),
  admin: Object.freeze(["vehicle:approve", "lot:create", "auction:start", "document:preview", "audit:read"] as const),
  mitko: Object.freeze(["auction:read", "terms:accept", "bid:place", "document:preview"] as const),
  borko: Object.freeze(["auction:read", "terms:accept", "bid:place", "document:preview"] as const),
  automation: Object.freeze(["audit:read"] as const)
});

const expectedTarget: Readonly<Record<ClosedDemoAction, ClosedDemoTarget["kind"]>> = Object.freeze({
  "vehicle:intake": "vehicle",
  "vehicle:submit": "vehicle",
  "vehicle:approve": "vehicle",
  "lot:create": "lot",
  "auction:start": "auction",
  "auction:read": "auction",
  "terms:accept": "auction",
  "bid:place": "auction",
  "document:preview": "document",
  "audit:read": "audit"
});

function invalidContext(): never {
  throw new Error("ENCHEV_MISSION003_ROLE_POLICY:INVALID_CONTEXT");
}

/**
 * A roster is only prepared against a MISSION-002 issued, isolated boundary.
 * The supplied identities are fixtures until server-side session verification
 * and authoritative identity lookup are integrated in MISSION-003.
 */
export function createClosedDemoRoleRoster(
  boundary: ClosedDemoBoundary,
  records: readonly ClosedDemoIdentityRecord[]
): ClosedDemoRoster {
  const issuedBoundary = requireIssuedClosedDemoBoundary(boundary);
  if (!Array.isArray(records) || records.length !== CLOSED_DEMO_ROLES.length) invalidContext();
  const roles = new Set<string>();
  const subjects = new Set<string>();
  const sessions = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object" ||
        !CLOSED_DEMO_ROLES.includes(record.role) ||
        typeof record.subjectId !== "string" || !idPattern.test(record.subjectId) ||
        typeof record.sessionId !== "string" || !sessionPattern.test(record.sessionId)) invalidContext();
    if (roles.has(record.role) || subjects.has(record.subjectId) || sessions.has(record.sessionId)) invalidContext();
    roles.add(record.role);
    subjects.add(record.subjectId);
    sessions.add(record.sessionId);
  }
  const identities = Object.freeze(records.map(record => Object.freeze({
    role: record.role,
    subjectId: record.subjectId,
    sessionId: record.sessionId
  })));
  const roster = Object.freeze({
    scope: "ENCHEV_CLOSED_DEMO_ROLE_ROSTER" as const,
    namespace: issuedBoundary.namespace,
    identities
  });
  issuedRosters.add(roster);
  return roster;
}

function decision(permitted: boolean, reason: ClosedDemoPolicyDecision["reason"]): ClosedDemoPolicyDecision {
  return Object.freeze({permitted, reason});
}

export function evaluateClosedDemoRolePolicy(
  roster: ClosedDemoRoster,
  subjectId: string,
  sessionId: string,
  action: ClosedDemoAction,
  target: ClosedDemoTarget
): ClosedDemoPolicyDecision {
  if (!roster || typeof roster !== "object" || !issuedRosters.has(roster)) {
    return decision(false, "UNVERIFIED_ROSTER");
  }
  if (typeof subjectId !== "string" || typeof sessionId !== "string") {
    return decision(false, "UNKNOWN_ACTOR");
  }
  const principal = roster.identities.find(record => record.subjectId === subjectId);
  if (!principal) return decision(false, "UNKNOWN_ACTOR");
  if (principal.sessionId !== sessionId) return decision(false, "SESSION_MISMATCH");
  if (!CLOSED_DEMO_ACTIONS.includes(action)) return decision(false, "UNKNOWN_ACTION");
  if (!target || typeof target !== "object" ||
      target.namespace !== roster.namespace ||
      !idPattern.test(target.id) ||
      expectedTarget[action] !== target.kind) {
    return decision(false, "UNSAFE_TARGET");
  }
  if (!allowed[principal.role].includes(action)) return decision(false, "ROLE_DENIED");

  const sellerId = roster.identities.find(record => record.role === "seller")?.subjectId;
  if (!sellerId) return decision(false, "INVALID_CONTEXT");
  if (target.sellerId !== undefined && target.sellerId !== sellerId) {
    return decision(false, "OWNERSHIP_DENIED");
  }
  if (principal.role === "seller" && target.sellerId !== subjectId) {
    return decision(false, "OWNERSHIP_DENIED");
  }
  if (action === "bid:place" || action === "terms:accept") {
    if (target.buyerId !== subjectId) return decision(false, "OWNERSHIP_DENIED");
  }
  if (action === "document:preview") {
    if (target.demoWatermarked !== true) return decision(false, "UNSAFE_TARGET");
    if (principal.role === "mitko" || principal.role === "borko") {
      if (target.buyerId !== subjectId) return decision(false, "OWNERSHIP_DENIED");
    }
    if (principal.role === "seller" && target.sellerId !== subjectId) {
      return decision(false, "OWNERSHIP_DENIED");
    }
  }
  if (principal.role === "admin" && (action === "vehicle:approve" || action === "lot:create" || action === "auction:start") &&
      target.sellerId !== sellerId) {
    return decision(false, "OWNERSHIP_DENIED");
  }
  return decision(true, "ALLOW");
}
