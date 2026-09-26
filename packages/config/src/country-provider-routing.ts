import type { CountryProfile } from "./country-profile";

export const COUNTRY_PROVIDER_ROUTING_MODEL_VERSION = 1 as const;

export type CountryProviderRoute = Readonly<{
  countryCode: string;
  capability: string;
  providerKey: string;
  mode: "dry-run" | "production";
  enabled: boolean;
}>;

export type CountryProviderRoutingValidationResult =
  | Readonly<{ ok: true; value: readonly CountryProviderRoute[] }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const KEY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export function validateCountryProviderRoutes(
  input: unknown,
  countryProfile: CountryProfile
): CountryProviderRoutingValidationResult {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ["provider routes must be an array"] };
  }

  const errors: string[] = [];
  const normalized: CountryProviderRoute[] = [];
  const capabilities = new Set<string>();

  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`routes[${index}] must be an object`);
      continue;
    }

    const route = raw as Record<string, unknown>;
    const keys = Object.keys(route).sort();
    const expected = ["capability", "countryCode", "enabled", "mode", "providerKey"];
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      errors.push(`routes[${index}] must contain only countryCode, capability, providerKey, mode, enabled`);
    }

    const countryCode = route.countryCode;
    const capability = route.capability;
    const providerKey = route.providerKey;
    const mode = route.mode;
    const enabled = route.enabled;

    if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
      errors.push(`routes[${index}].countryCode must be two uppercase ASCII letters`);
    } else if (countryCode !== countryProfile.countryCode) {
      errors.push(`routes[${index}].countryCode must match CountryProfile.countryCode`);
    }

    if (typeof capability !== "string" || !KEY_PATTERN.test(capability)) {
      errors.push(`routes[${index}].capability must be a stable lowercase key`);
    }
    if (typeof providerKey !== "string" || !KEY_PATTERN.test(providerKey)) {
      errors.push(`routes[${index}].providerKey must be a stable lowercase key`);
    }
    if (mode !== "dry-run" && mode !== "production") {
      errors.push(`routes[${index}].mode must be dry-run or production`);
    }
    if (typeof enabled !== "boolean") {
      errors.push(`routes[${index}].enabled must be boolean`);
    }

    if (
      typeof countryCode === "string" &&
      typeof capability === "string" &&
      typeof providerKey === "string" &&
      (mode === "dry-run" || mode === "production") &&
      typeof enabled === "boolean"
    ) {
      if (capabilities.has(capability)) {
        errors.push(`duplicate provider capability: ${capability}`);
      } else {
        capabilities.add(capability);
        normalized.push({ countryCode, capability, providerKey, mode, enabled });
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: normalized };
}

export function resolveCountryProviderRoute(
  countryProfile: CountryProfile,
  routes: readonly CountryProviderRoute[],
  capability: string
): CountryProviderRoute | null {
  const validation = validateCountryProviderRoutes(routes, countryProfile);
  if (!validation.ok) return null;
  return validation.value.find((route) => route.capability === capability && route.enabled) ?? null;
}
