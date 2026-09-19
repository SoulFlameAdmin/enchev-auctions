import type { CountryProfile } from "./country-profile";
import {
  validateCountryKycProfile,
  type CountryKycProfile
} from "./country-kyc-profile";
import {
  validateCountryLegalProfile,
  type CountryLegalProfile
} from "./country-legal-profile";
import {
  validateCountryDocumentProfile,
  type CountryDocumentProfile
} from "./country-document-profile";

export const MARKET_ACTIVATION_GATE_MODEL_VERSION = 1 as const;

export type MarketActivationApproval = Readonly<{
  countryCode: string;
  kycApproved: boolean;
  legalApproved: boolean;
  documentsApproved: boolean;
}>;

export type MarketActivationGateResult =
  | Readonly<{
      active: true;
      countryCode: string;
      blockers: readonly [];
    }>
  | Readonly<{
      active: false;
      countryCode: string | null;
      blockers: readonly string[];
    }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const APPROVAL_KEYS = [
  "countryCode",
  "documentsApproved",
  "kycApproved",
  "legalApproved"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  const target = [...expected].sort();
  return actual.length === target.length && actual.every((key, index) => key === target[index]);
}

function addValidationBlockers(
  blockers: string[],
  prefix: string,
  result: Readonly<{ ok: true }> | Readonly<{ ok: false; errors: readonly string[] }>
): void {
  if (!result.ok) {
    for (const error of result.errors) {
      blockers.push(`${prefix}: ${error}`);
    }
  }
}

export function evaluateMarketActivationGate(
  approvalInput: unknown,
  countryProfile: CountryProfile,
  kycProfile: CountryKycProfile,
  legalProfile: CountryLegalProfile,
  documentProfile: CountryDocumentProfile
): MarketActivationGateResult {
  const blockers: string[] = [];

  if (!isRecord(approvalInput)) {
    return {
      active: false,
      countryCode: null,
      blockers: ["activation approval must be an object"]
    };
  }

  if (!hasExactKeys(approvalInput, APPROVAL_KEYS)) {
    blockers.push("activation approval must contain only countryCode, kycApproved, legalApproved, and documentsApproved");
  }

  const countryCode = approvalInput.countryCode;
  const kycApproved = approvalInput.kycApproved;
  const legalApproved = approvalInput.legalApproved;
  const documentsApproved = approvalInput.documentsApproved;

  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    blockers.push("countryCode must be two uppercase ASCII letters");
  } else if (countryCode !== countryProfile.countryCode) {
    blockers.push("countryCode must match CountryProfile.countryCode");
  }

  for (const [field, value] of [
    ["kycApproved", kycApproved],
    ["legalApproved", legalApproved],
    ["documentsApproved", documentsApproved]
  ] as const) {
    if (typeof value !== "boolean") {
      blockers.push(`${field} must be boolean`);
    }
  }

  addValidationBlockers(
    blockers,
    "kycProfile",
    validateCountryKycProfile(kycProfile, countryProfile)
  );
  addValidationBlockers(
    blockers,
    "legalProfile",
    validateCountryLegalProfile(legalProfile, countryProfile)
  );
  addValidationBlockers(
    blockers,
    "documentProfile",
    validateCountryDocumentProfile(documentProfile, countryProfile)
  );

  if (kycApproved !== true) {
    blockers.push("KYC approval is required");
  }
  if (legalApproved !== true) {
    blockers.push("legal approval is required");
  }
  if (documentsApproved !== true) {
    blockers.push("document approval is required");
  }

  if (blockers.length > 0) {
    return {
      active: false,
      countryCode: typeof countryCode === "string" ? countryCode : null,
      blockers
    };
  }

  return {
    active: true,
    countryCode: countryCode as string,
    blockers: []
  };
}
