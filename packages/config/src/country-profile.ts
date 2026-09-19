export const COUNTRY_PROFILE_MODEL_VERSION = 1 as const;

export type CountryProfile = Readonly<{
  countryCode: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  timeZone: string;
}>;

export type CountryProfileValidationResult =
  | Readonly<{ ok: true; value: CountryProfile }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const TIME_ZONE_PATTERN = /^(?:UTC|Etc\/UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCountryProfile(input: unknown): CountryProfileValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["profile must be an object"] };
  }

  const errors: string[] = [];
  const countryCode = input.countryCode;
  const defaultLocale = input.defaultLocale;
  const supportedLocales = input.supportedLocales;
  const timeZone = input.timeZone;

  if (typeof countryCode !== "string" || !COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.push("countryCode must be two uppercase ASCII letters");
  }

  if (typeof defaultLocale !== "string" || !LOCALE_PATTERN.test(defaultLocale)) {
    errors.push("defaultLocale must be a locale identifier");
  }

  if (!Array.isArray(supportedLocales) || supportedLocales.length === 0) {
    errors.push("supportedLocales must contain at least one locale");
  } else {
    const locales = supportedLocales.filter((value): value is string => typeof value === "string");
    if (locales.length !== supportedLocales.length || locales.some((value) => !LOCALE_PATTERN.test(value))) {
      errors.push("supportedLocales contains an invalid locale identifier");
    }
    if (new Set(locales).size !== locales.length) {
      errors.push("supportedLocales must not contain duplicates");
    }
    if (typeof defaultLocale === "string" && !locales.includes(defaultLocale)) {
      errors.push("defaultLocale must be present in supportedLocales");
    }
  }

  if (typeof timeZone !== "string" || !TIME_ZONE_PATTERN.test(timeZone)) {
    errors.push("timeZone must be UTC or an IANA-style zone identifier");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      countryCode: countryCode as string,
      defaultLocale: defaultLocale as string,
      supportedLocales: [...(supportedLocales as string[])],
      timeZone: timeZone as string
    }
  };
}
