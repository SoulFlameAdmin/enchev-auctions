import {
  validateCountryProfile,
  type CountryProfile
} from "./country-profile";

export const LOCALE_FALLBACK_CHAIN_MODEL_VERSION = 1 as const;

export type LocaleFallbackChainResult =
  | Readonly<{
      ok: true;
      requestedLocale: string | null;
      resolvedLocale: string;
      chain: readonly string[];
    }>
  | Readonly<{
      ok: false;
      errors: readonly string[];
    }>;

function canonicalLocale(value: string): string | null {
  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length === 1 ? canonical[0] : null;
  } catch {
    return null;
  }
}

function localeLanguage(value: string): string | null {
  try {
    return new Intl.Locale(value).language;
  } catch {
    return null;
  }
}

export function resolveLocaleFallbackChain(
  profileInput: unknown,
  requestedLocale?: unknown
): LocaleFallbackChainResult {
  const profileResult = validateCountryProfile(profileInput);
  if (!profileResult.ok) {
    return {
      ok: false,
      errors: profileResult.errors.map((error) => `countryProfile: ${error}`)
    };
  }

  const profile: CountryProfile = profileResult.value;
  const canonicalSupported = profile.supportedLocales.map(canonicalLocale);
  if (canonicalSupported.some((locale) => locale === null)) {
    return {
      ok: false,
      errors: ["supportedLocales contains an invalid BCP 47 locale"]
    };
  }

  const supported = canonicalSupported as string[];
  if (new Set(supported).size !== supported.length) {
    return {
      ok: false,
      errors: ["supportedLocales must remain unique after locale canonicalization"]
    };
  }

  const defaultLocale = canonicalLocale(profile.defaultLocale);
  if (!defaultLocale || !supported.includes(defaultLocale)) {
    return {
      ok: false,
      errors: ["defaultLocale must canonicalize to a supported locale"]
    };
  }

  if (requestedLocale === undefined || requestedLocale === null) {
    return {
      ok: true,
      requestedLocale: null,
      resolvedLocale: defaultLocale,
      chain: [defaultLocale]
    };
  }

  if (typeof requestedLocale !== "string" || requestedLocale.length === 0) {
    return {
      ok: false,
      errors: ["requestedLocale must be a non-empty locale identifier when provided"]
    };
  }

  const requested = canonicalLocale(requestedLocale);
  if (!requested) {
    return {
      ok: false,
      errors: ["requestedLocale must be a valid BCP 47 locale identifier"]
    };
  }

  const chain: string[] = [];
  const push = (locale: string) => {
    if (!chain.includes(locale)) chain.push(locale);
  };

  if (supported.includes(requested)) {
    push(requested);
    if (requested === defaultLocale) {
      return {
        ok: true,
        requestedLocale: requested,
        resolvedLocale: requested,
        chain
      };
    }
  }

  const requestedLanguage = localeLanguage(requested);
  if (!requestedLanguage) {
    return {
      ok: false,
      errors: ["requestedLocale language could not be resolved"]
    };
  }

  for (const locale of supported) {
    if (locale === defaultLocale || locale === requested) continue;
    if (localeLanguage(locale) === requestedLanguage) {
      push(locale);
    }
  }

  push(defaultLocale);

  return {
    ok: true,
    requestedLocale: requested,
    resolvedLocale: chain[0],
    chain
  };
}
