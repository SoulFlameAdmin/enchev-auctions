import {
  normalizePlatformLegalRole,
  type PlatformLegalRole,
  type PlatformLegalRoleStatus,
} from "./platform-legal-role";

/**
 * SYSTEM 63.02 — pure lifecycle decisions for the platform legal-role record.
 * The caller MUST independently authorize the actor and verify referenced
 * legal/contract evidence. This code cannot activate markets or payments.
 */
export type PlatformLegalRoleAction =
  | "submit-review"
  | "request-changes"
  | "approve"
  | "suspend"
  | "reopen-review";

export type PlatformLegalRoleCommand = Readonly<{
  action: PlatformLegalRoleAction;
  actorId: string;
  expectedRevision: number;
  occurredAt: string;
  reason: string;
  approvalEvidence?: Readonly<{
    contractReference: string;
    legalReviewReference: string;
  }>;
}>;

export type PlatformLegalRoleAudit = Readonly<{
  eventId: string;
  recordId: string;
  previousRevision: number;
  revision: number;
  previousStatus: PlatformLegalRoleStatus;
  nextStatus: PlatformLegalRoleStatus;
  action: PlatformLegalRoleAction;
  actorId: string;
  occurredAt: string;
  reason: string;
}>;

export type PlatformLegalRoleTransition = Readonly<{
  record: PlatformLegalRole;
  audit: PlatformLegalRoleAudit;
}>;

const allowed: Readonly<Record<PlatformLegalRoleAction, Readonly<{
  from: PlatformLegalRoleStatus;
  to: PlatformLegalRoleStatus;
}>>> = Object.freeze({
  "submit-review": { from: "draft", to: "under-review" },
  "request-changes": { from: "under-review", to: "draft" },
  "approve": { from: "under-review", to: "approved" },
  "suspend": { from: "approved", to: "suspended" },
  "reopen-review": { from: "suspended", to: "under-review" },
});

function checkedString(value: unknown, code: string, max: number): string {
  if (typeof value !== "string") throw new Error(code);
  const s = value.trim();
  if (!s || s.length > max || /[\x00-\x1f\x7f]/.test(s)) throw new Error(code);
  return s;
}

function checkedUtc(value: string): string {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value)
    throw new Error("PLATFORM_ROLE_TRANSITION_TIME_INVALID");
  return value;
}

export function transitionPlatformLegalRole(
  currentInput: PlatformLegalRole,
  command: PlatformLegalRoleCommand,
): PlatformLegalRoleTransition {
  const current = normalizePlatformLegalRole(currentInput);
  if (!command || typeof command !== "object" || !(command.action in allowed))
    throw new Error("PLATFORM_ROLE_TRANSITION_ACTION_INVALID");
  const rule = allowed[command.action];
  const actorId = checkedString(command.actorId, "PLATFORM_ROLE_TRANSITION_ACTOR_REQUIRED", 160);
  const reason = checkedString(command.reason, "PLATFORM_ROLE_TRANSITION_REASON_REQUIRED", 1024);
  const occurredAt = checkedUtc(command.occurredAt);
  if (!Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision !== current.revision)
    throw new Error("PLATFORM_ROLE_TRANSITION_REVISION_CONFLICT");
  if (current.status !== rule.from)
    throw new Error("PLATFORM_ROLE_TRANSITION_NOT_ALLOWED");
  if (command.action !== "approve" && command.approvalEvidence)
    throw new Error("PLATFORM_ROLE_TRANSITION_UNEXPECTED_EVIDENCE");

  let contractReference = current.contractReference;
  let legalReviewReference = current.legalReviewReference;
  if (command.action === "approve") {
    contractReference = checkedString(
      command.approvalEvidence?.contractReference,
      "PLATFORM_ROLE_TRANSITION_CONTRACT_REQUIRED", 160,
    );
    legalReviewReference = checkedString(
      command.approvalEvidence?.legalReviewReference,
      "PLATFORM_ROLE_TRANSITION_LEGAL_REVIEW_REQUIRED", 160,
    );
  }

  const next = normalizePlatformLegalRole({
    ...current,
    revision: current.revision + 1,
    status: rule.to,
    contractReference,
    legalReviewReference,
  });
  const audit: PlatformLegalRoleAudit = Object.freeze({
    eventId: `${current.recordId}:${next.revision}`,
    recordId: current.recordId,
    previousRevision: current.revision,
    revision: next.revision,
    previousStatus: current.status,
    nextStatus: next.status,
    action: command.action,
    actorId,
    occurredAt,
    reason,
  });
  return Object.freeze({ record: next, audit });
}
