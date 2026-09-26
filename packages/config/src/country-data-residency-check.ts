import type { CountryProfile } from "./country-profile";

export const COUNTRY_DATA_RESIDENCY_CHECK_MODEL_VERSION = 1 as const;

export type CountryDataResidencyPolicy = Readonly<{
  countryCode: string;
  allowedRegions: readonly string[];
  requireKnownRegionForCustomerData: boolean;
}>;

export type CountryDataPlane = Readonly<{
  id: string;
  region: string | null;
  configured: boolean;
  customerData: boolean;
}>;

export type CountryDataResidencyCheckResult = Readonly<{
  completed: true;
  approved: boolean;
  blockers: readonly string[];
}>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const REGION_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export function evaluateCountryDataResidencyCheck(
  countryProfile: CountryProfile,
  policy: CountryDataResidencyPolicy,
  planes: readonly CountryDataPlane[]
): CountryDataResidencyCheckResult {
  const blockers: string[] = [];

  if (!COUNTRY_CODE_PATTERN.test(policy.countryCode) || policy.countryCode !== countryProfile.countryCode) {
    blockers.push("residency policy countryCode must match CountryProfile.countryCode");
  }

  if (!Array.isArray(policy.allowedRegions) || policy.allowedRegions.length === 0) {
    blockers.push("residency policy must define at least one allowed region");
  } else if (policy.allowedRegions.some((region) => !REGION_PATTERN.test(region))) {
    blockers.push("residency policy contains an invalid region identifier");
  }

  const seen = new Set<string>();
  for (const plane of planes) {
    if (!ID_PATTERN.test(plane.id)) {
      blockers.push("data plane id must be a stable lowercase key");
      continue;
    }
    if (seen.has(plane.id)) blockers.push(`duplicate data plane: ${plane.id}`);
    seen.add(plane.id);

    if (!plane.configured) {
      if (plane.customerData) blockers.push(`${plane.id}: customer-data plane is not configured`);
      continue;
    }

    if (plane.region !== null && !REGION_PATTERN.test(plane.region)) {
      blockers.push(`${plane.id}: invalid configured region`);
      continue;
    }

    if (plane.customerData && policy.requireKnownRegionForCustomerData && plane.region === null) {
      blockers.push(`${plane.id}: customer-data region is unknown`);
      continue;
    }

    if (plane.customerData && plane.region !== null && !policy.allowedRegions.includes(plane.region)) {
      blockers.push(`${plane.id}: region ${plane.region} is outside the allowed residency set`);
    }
  }

  return { completed: true, approved: blockers.length === 0, blockers };
}
