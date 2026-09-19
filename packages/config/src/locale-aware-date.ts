import type { CountryProfile } from "./country-profile";

export const LOCALE_AWARE_DATE_MODEL_VERSION = 1 as const;

export type LocaleDateParts = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

export type LocaleDateInput = string | LocaleDateParts;
export type LocaleDateStyle = "numeric" | "long";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_ONLY_TIME_ZONE = "UTC";

function fail(message: string): never {
  throw new RangeError(`locale-aware date: ${message}`);
}

function normalizeLocale(locale: string): string {
  if (typeof locale !== "string" || locale.trim().length === 0) {
    return fail("locale must be a non-empty explicit locale identifier");
  }

  try {
    return new Intl.DateTimeFormat(locale).resolvedOptions().locale;
  } catch {
    return fail("locale must be supported by Intl.DateTimeFormat");
  }
}

function normalizeDateParts(input: LocaleDateInput): LocaleDateParts {
  let year: number;
  let month: number;
  let day: number;

  if (typeof input === "string") {
    const match = ISO_DATE_PATTERN.exec(input);
    if (!match) return fail("date string must use YYYY-MM-DD");
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if (input && typeof input === "object") {
    year = input.year;
    month = input.month;
    day = input.day;
  } else {
    return fail("date must be YYYY-MM-DD or explicit year/month/day parts");
  }

  if (![year, month, day].every(Number.isInteger)) {
    return fail("year, month and day must be integers");
  }
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return fail("date parts are outside supported calendar ranges");
  }

  const probe = new Date(Date.UTC(2000, month - 1, day, 12, 0, 0, 0));
  probe.setUTCFullYear(year);
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return fail("date is not a valid Gregorian calendar date");
  }

  return { year, month, day };
}

function toDateOnlyUtc(parts: LocaleDateParts): Date {
  const value = new Date(Date.UTC(2000, parts.month - 1, parts.day, 12, 0, 0, 0));
  value.setUTCFullYear(parts.year);
  return value;
}

function resolveDateOptions(style: LocaleDateStyle): Intl.DateTimeFormatOptions {
  if (style === "numeric") {
    return { year: "numeric", month: "2-digit", day: "2-digit" };
  }
  if (style === "long") {
    return { year: "numeric", month: "long", day: "numeric" };
  }
  return fail("style must be numeric or long");
}

/**
 * Formats a calendar date with an explicitly supplied locale.
 *
 * This API intentionally accepts date-only values, not timestamp instants.
 * UTC is used only as an internal date-only normalization zone so host timezone
 * cannot shift the calendar day. User/market timezone display belongs to 21.04.
 */
export function formatLocaleDate(
  input: LocaleDateInput,
  locale: string,
  style: LocaleDateStyle = "numeric"
): string {
  const normalizedLocale = normalizeLocale(locale);
  const parts = normalizeDateParts(input);
  const dateOptions = resolveDateOptions(style);

  return new Intl.DateTimeFormat(normalizedLocale, {
    ...dateOptions,
    timeZone: DATE_ONLY_TIME_ZONE
  }).format(toDateOnlyUtc(parts));
}

/**
 * CountryProfile convenience wrapper. Requested locale must be enabled by the
 * supplied profile; otherwise the profile default locale is used.
 */
export function formatCountryProfileDate(
  input: LocaleDateInput,
  profile: CountryProfile,
  requestedLocale?: string,
  style: LocaleDateStyle = "numeric"
): string {
  const locale = requestedLocale ?? profile.defaultLocale;
  if (!profile.supportedLocales.includes(locale)) {
    return fail("requested locale is not enabled by CountryProfile");
  }
  return formatLocaleDate(input, locale, style);
}
