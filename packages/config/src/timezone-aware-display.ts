import type { CountryProfile } from "./country-profile";

export const TIMEZONE_AWARE_DISPLAY_MODEL_VERSION = 1 as const;

export type TimeZoneInstantInput = string | Date;
export type TimeZoneDisplayStyle = "numeric" | "long";

const ISO_INSTANT_WITH_ZONE_PATTERN = /T.*(?:Z|[+-]\d{2}:\d{2})$/;

function fail(message: string): never {
  throw new RangeError(`timezone-aware display: ${message}`);
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

function normalizeTimeZone(timeZone: string, locale: string): string {
  if (typeof timeZone !== "string" || timeZone.trim().length === 0) {
    return fail("timeZone must be a non-empty explicit IANA timezone identifier");
  }

  try {
    return new Intl.DateTimeFormat(locale, { timeZone }).resolvedOptions().timeZone;
  } catch {
    return fail("timeZone must be supported by Intl.DateTimeFormat");
  }
}

function normalizeInstant(input: TimeZoneInstantInput): Date {
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime())) return fail("Date input must represent a valid instant");
    return new Date(input.getTime());
  }

  if (typeof input !== "string" || !ISO_INSTANT_WITH_ZONE_PATTERN.test(input)) {
    return fail("string input must be an ISO timestamp with Z or an explicit UTC offset");
  }

  const instant = new Date(input);
  if (!Number.isFinite(instant.getTime())) {
    return fail("string input must represent a valid instant");
  }
  return instant;
}

function resolveDisplayOptions(style: TimeZoneDisplayStyle): Intl.DateTimeFormatOptions {
  if (style === "numeric") {
    return {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    };
  }

  if (style === "long") {
    return {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "long"
    };
  }

  return fail("style must be numeric or long");
}

/**
 * Formats a timestamp instant using an explicit locale and explicit timezone.
 *
 * This API never infers a timezone from the runtime host. String inputs must
 * carry Z or an explicit UTC offset so an ambiguous local wall-clock value
 * cannot silently become an instant.
 */
export function formatTimeZoneDateTime(
  input: TimeZoneInstantInput,
  locale: string,
  timeZone: string,
  style: TimeZoneDisplayStyle = "numeric"
): string {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedTimeZone = normalizeTimeZone(timeZone, normalizedLocale);
  const instant = normalizeInstant(input);
  const displayOptions = resolveDisplayOptions(style);

  return new Intl.DateTimeFormat(normalizedLocale, {
    ...displayOptions,
    timeZone: normalizedTimeZone
  }).format(instant);
}

/**
 * CountryProfile convenience wrapper. The profile supplies the authoritative
 * display timezone and the allowed locale set.
 */
export function formatCountryProfileDateTime(
  input: TimeZoneInstantInput,
  profile: CountryProfile,
  requestedLocale?: string,
  style: TimeZoneDisplayStyle = "numeric"
): string {
  const locale = requestedLocale ?? profile.defaultLocale;
  if (!profile.supportedLocales.includes(locale)) {
    return fail("requested locale is not enabled by CountryProfile");
  }

  return formatTimeZoneDateTime(input, locale, profile.timeZone, style);
}
