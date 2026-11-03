/**
 * SYSTEM 63.01 — canonical, framework-independent platform legal-role model.
 *
 * Data in this module is not a legal determination or a payment authorization.
 * Market activation additionally requires independently verified contracts,
 * legal sign-off, KYB/KYC, regulatory and provider gates.
 */
export type PlatformLegalRoleStatus =
  | "draft"
  | "under-review"
  | "approved"
  | "suspended";

export type PlatformLegalRole = Readonly<{
  recordId: string;
  operatorEntityId: string;
  marketCountry: string;
  roleCode: string;
  status: PlatformLegalRoleStatus;
  contractReference: string | null;
  legalReviewReference: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  revision: number;
}>;

const STATUSES: readonly PlatformLegalRoleStatus[] = [
  "draft", "under-review", "approved", "suspended",
];

function requiredIdentifier(value: string, code: string): string {
  if (typeof value !== "string") throw new Error(code);
  const result = value.trim();
  if (!result || result.length > 160 || /[\x00-\x1f\x7f]/.test(result))
    throw new Error(code);
  return result;
}

function optionalReference(value: string | null, code: string): string | null {
  if (value === null) return null;
  return requiredIdentifier(value, code);
}

function canonicalUtc(value: string, code: string): string {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
    throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value)
    throw new Error(code);
  return value;
}

/**
 * Validates shape and local invariants; never treats "approved" as proof that
 * the cited contract or legal review actually exists.
 */
export function normalizePlatformLegalRole(input: PlatformLegalRole): PlatformLegalRole {
  if (!input || typeof input !== "object") throw new Error("PLATFORM_ROLE_RECORD_REQUIRED");
  const recordId = requiredIdentifier(input.recordId, "PLATFORM_ROLE_RECORD_ID_INVALID");
  const operatorEntityId = requiredIdentifier(input.operatorEntityId, "PLATFORM_ROLE_ENTITY_INVALID");
  const marketCountry = requiredIdentifier(input.marketCountry, "PLATFORM_ROLE_COUNTRY_INVALID");
  if (!/^[A-Z]{2}$/.test(marketCountry)) throw new Error("PLATFORM_ROLE_COUNTRY_INVALID");
  // The jurisdiction's actual activation/eligibility is a separate country-profile gate.
  const roleCode = requiredIdentifier(input.roleCode, "PLATFORM_ROLE_CODE_INVALID");
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(roleCode)) throw new Error("PLATFORM_ROLE_CODE_INVALID");
  if (!STATUSES.includes(input.status)) throw new Error("PLATFORM_ROLE_STATUS_INVALID");
  if (!Number.isSafeInteger(input.revision) || input.revision < 0)
    throw new Error("PLATFORM_ROLE_REVISION_INVALID");
  const contractReference = optionalReference(input.contractReference, "PLATFORM_ROLE_CONTRACT_INVALID");
  const legalReviewReference = optionalReference(input.legalReviewReference, "PLATFORM_ROLE_REVIEW_INVALID");
  const effectiveFrom = canonicalUtc(input.effectiveFrom, "PLATFORM_ROLE_START_INVALID");
  const effectiveUntil = input.effectiveUntil === null
    ? null
    : canonicalUtc(input.effectiveUntil, "PLATFORM_ROLE_END_INVALID");
  if (effectiveUntil !== null && effectiveUntil <= effectiveFrom)
    throw new Error("PLATFORM_ROLE_DATE_RANGE_INVALID");
  if (input.status === "approved" && (!contractReference || !legalReviewReference))
    throw new Error("PLATFORM_ROLE_APPROVAL_EVIDENCE_REQUIRED");
  return Object.freeze({
    recordId, operatorEntityId, marketCountry, roleCode, status: input.status,
    contractReference, legalReviewReference, effectiveFrom, effectiveUntil,
    revision: input.revision,
  });
}

/**
 * Deterministic read-only lookup for a specified entity, market and role.
 * Missing, overlapping or non-approved evidence fails closed.
 * This is not permission to activate a market, settle payments or accept bids.
 */
export function findApprovedPlatformLegalRole(
  input: readonly PlatformLegalRole[],
  entityId: string,
  country: string,
  roleCode: string,
  at: string,
): PlatformLegalRole | null {
  const entity = requiredIdentifier(entityId, "PLATFORM_ROLE_ENTITY_INVALID");
  const market = requiredIdentifier(country, "PLATFORM_ROLE_COUNTRY_INVALID");
  if (!/^[A-Z]{2}$/.test(market)) throw new Error("PLATFORM_ROLE_COUNTRY_INVALID");
  const role = requiredIdentifier(roleCode, "PLATFORM_ROLE_CODE_INVALID");
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(role)) throw new Error("PLATFORM_ROLE_CODE_INVALID");
  const instant = canonicalUtc(at, "PLATFORM_ROLE_LOOKUP_TIME_INVALID");
  const seenIds = new Set<string>();
  const approved: PlatformLegalRole[] = [];
  for (const item of input) {
    const record = normalizePlatformLegalRole(item);
    if (seenIds.has(record.recordId)) throw new Error("PLATFORM_ROLE_DUPLICATE_ID");
    seenIds.add(record.recordId);
    if (record.operatorEntityId !== entity || record.marketCountry !== market ||
        record.roleCode !== role || record.status !== "approved") continue;
    if (record.effectiveFrom <= instant &&
        (record.effectiveUntil === null || instant < record.effectiveUntil)) {
      approved.push(record);
    }
  }
  if (approved.length > 1) throw new Error("PLATFORM_ROLE_AMBIGUOUS_APPROVAL");
  return approved[0] ?? null;
}
