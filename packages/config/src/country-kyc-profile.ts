import type { CountryProfile } from "./country-profile";

export const COUNTRY_KYC_PROFILE_MODEL_VERSION = 1 as const;

export type CountryKycRequirement = Readonly<{
  key: string;
  required: boolean;
}>;

export type CountryKycProfile = Readonly<{
  countryCode: string;
  revision: number;
  requirements: readonly CountryKycRequirement[];
}>;

export type CountryKycProfileValidationResult =
  | Readonly<{ ok: true; value: CountryKycProfile }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const REQUIREMENT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const PROFILE_KEYS = ["countryCode", "revision", "requirements"] as const;
const REQUIREMENT_KEYS = ["key", "required"] as const;

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

export function validateCountryKycProfile(
  input: unknown,
  countryProfile: CountryProfile
): CountryKycProfileValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["profile must be an object"] };
  }

  const errors: string[] = [];
  if (!hasExactKeys(input, PROFILE_KEYS)) {
    errors.push("profile must contain only countryCode, revision, and requirements");
  }

  const countryCode = input.countryCode;
  const revision = input.revision;
  const requirements = input.requirements;

  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.push("countryCode must be two uppercase ASCII letters");
  } else if (countryCode !== countryProfile.countryCode) {
    errors.push("countryCode must match CountryProfile.countryCode");
  }

  if (!Number.isInteger(revision) || (revision as number) < 1) {
    errors.push("revision must be a positive integer");
  }

  const normalizedRequirements: CountryKycRequirement[] = [];
  if (!Array.isArray(requirements) || requirements.length === 0) {
    errors.push("requirements must contain at least one KYC requirement");
  } else {
    for (const [index, requirement] of requirements.entries()) {
      if (!isRecord(requirement)) {
        errors.push(`requirements[${index}] must be an object`);
        continue;
      }

      if (!hasExactKeys(requirement, REQUIREMENT_KEYS)) {
        errors.push(`requirements[${index}] must contain only key and required`);
      }

      const key = requirement.key;
      const required = requirement.required;

      if (typeof key !== "string" || !REQUIREMENT_KEY_PATTERN.test(key)) {
        errors.push(`requirements[${index}].key must be a lowercase dot-separated identifier`);
      }
      if (typeof required !== "boolean") {
        errors.push(`requirements[${index}].required must be boolean`);
      }

      if (typeof key === "string" && REQUIREMENT_KEY_PATTERN.test(key) && typeof required === "boolean") {
        normalizedRequirements.push({ key, required });
      }
    }

    const keys = normalizedRequirements.map((item) => item.key);
    if (new Set(keys).size !== keys.length) {
      errors.push("requirements must not contain duplicate keys");
    }

    const sortedKeys = [...keys].sort();
    if (JSON.stringify(keys) !== JSON.stringify(sortedKeys)) {
      errors.push("requirements must be sorted by key");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      countryCode: countryCode as string,
      revision: revision as number,
      requirements: normalizedRequirements.map((item) => ({ ...item }))
    }
  };
}
