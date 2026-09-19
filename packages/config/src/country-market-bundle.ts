import {
  validateCountryProfile,
  type CountryProfile
} from "./country-profile";
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

export const COUNTRY_MARKET_BUNDLE_MODEL_VERSION = 1 as const;

export type CountryMarketBundle = Readonly<{
  countryProfile: CountryProfile;
  kycProfile: CountryKycProfile;
  legalProfile: CountryLegalProfile;
  documentProfile: CountryDocumentProfile;
}>;

export type CountryMarketBundleValidationResult =
  | Readonly<{ ok: true; value: CountryMarketBundle }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const BUNDLE_KEYS = [
  "countryProfile",
  "documentProfile",
  "kycProfile",
  "legalProfile"
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

function prefixed(prefix: string, errors: readonly string[]): readonly string[] {
  return errors.map((error) => `${prefix}: ${error}`);
}

export function validateCountryMarketBundle(
  input: unknown
): CountryMarketBundleValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["bundle must be an object"] };
  }

  const errors: string[] = [];
  if (!hasExactKeys(input, BUNDLE_KEYS)) {
    errors.push("bundle must contain only countryProfile, kycProfile, legalProfile, and documentProfile");
  }

  const countryResult = validateCountryProfile(input.countryProfile);
  if (!countryResult.ok) {
    errors.push(...prefixed("countryProfile", countryResult.errors));
    return { ok: false, errors };
  }

  const countryProfile = countryResult.value;
  const kycResult = validateCountryKycProfile(input.kycProfile, countryProfile);
  const legalResult = validateCountryLegalProfile(input.legalProfile, countryProfile);
  const documentResult = validateCountryDocumentProfile(input.documentProfile, countryProfile);

  if (!kycResult.ok) {
    errors.push(...prefixed("kycProfile", kycResult.errors));
  }
  if (!legalResult.ok) {
    errors.push(...prefixed("legalProfile", legalResult.errors));
  }
  if (!documentResult.ok) {
    errors.push(...prefixed("documentProfile", documentResult.errors));
  }

  if (errors.length > 0 || !kycResult.ok || !legalResult.ok || !documentResult.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      countryProfile,
      kycProfile: kycResult.value,
      legalProfile: legalResult.value,
      documentProfile: documentResult.value
    }
  };
}
