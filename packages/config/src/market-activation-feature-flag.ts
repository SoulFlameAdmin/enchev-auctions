import type { CountryProfile } from "./country-profile";
import type { MarketActivationGateResult } from "./market-activation-gate";

export const MARKET_ACTIVATION_FEATURE_FLAG_MODEL_VERSION = 1 as const;

export type MarketActivationFeatureFlag = Readonly<{
  countryCode: string;
  enabled: boolean;
  revision: number;
}>;

export type MarketActivationFeatureFlagResult =
  | Readonly<{ active: true; countryCode: string; blockers: readonly [] }>
  | Readonly<{ active: false; countryCode: string | null; blockers: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const EXPECTED_KEYS = ["countryCode", "enabled", "revision"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...EXPECTED_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function applyMarketActivationFeatureFlag(
  flagInput: unknown,
  countryProfile: CountryProfile,
  gateResult: MarketActivationGateResult
): MarketActivationFeatureFlagResult {
  const blockers: string[] = [];

  if (!isRecord(flagInput)) {
    return { active: false, countryCode: null, blockers: ["country activation feature flag must be an object"] };
  }

  if (!exactKeys(flagInput)) {
    blockers.push("country activation feature flag must contain only countryCode, enabled, and revision");
  }

  const countryCode = flagInput.countryCode;
  const enabled = flagInput.enabled;
  const revision = flagInput.revision;

  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    blockers.push("countryCode must be two uppercase ASCII letters");
  } else if (countryCode !== countryProfile.countryCode) {
    blockers.push("countryCode must match CountryProfile.countryCode");
  }

  if (typeof enabled !== "boolean") blockers.push("enabled must be boolean");
  if (!Number.isInteger(revision) || Number(revision) < 1) blockers.push("revision must be a positive integer");

  if (enabled !== true) blockers.push("country activation feature flag is disabled");

  if (!gateResult.active) {
    blockers.push(...gateResult.blockers.map((blocker) => `market activation gate: ${blocker}`));
  } else if (typeof countryCode === "string" && gateResult.countryCode !== countryCode) {
    blockers.push("market activation gate countryCode must match feature flag countryCode");
  }

  if (blockers.length > 0) {
    return {
      active: false,
      countryCode: typeof countryCode === "string" ? countryCode : null,
      blockers
    };
  }

  return { active: true, countryCode: countryCode as string, blockers: [] };
}
