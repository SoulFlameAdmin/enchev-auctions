# 21.06 — EN locale

## Goal

Register the English presentation locale as a concrete, validated locale resource that is schema-compatible with the completed BG locale registration and remains independent from translation-key architecture.

## Resource

`locales/en.json` is the canonical 21.06 English locale registration.

It declares:

- BCP 47 locale: `en-US`
- language: `en`
- script: `Latn`
- region: `US`
- text direction: `ltr`
- native display name: `English`
- English display name: `English`

The verifier requires `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.PluralRules` support for the registered locale and confirms that `Intl.Locale(...).maximize()` resolves to English/Latin/US metadata.

## Dependency boundary

21.06 depends on:

- 21.01 CountryProfile configuration model
- 21.02 no country-specific hardcoding
- 21.03 locale-aware dates
- 21.04 timezone-aware display
- 21.05 BG locale

The EN resource must use the same locale-registration schema as `locales/bg.json`.

## Translation architecture boundary

21.06 is **locale registration only**.

It intentionally does not define translation keys, message catalogs, runtime message lookup, locale negotiation, or fallback behavior. Those remain owned by:

- 21.07 Translation key architecture
- 21.16 Locale fallback chain
- 21.19 Translation completeness checks

The EN locale resource must not contain `messages`, `translations`, `dictionary`, or `keys` fields.

## Business/configuration boundary

The locale resource is not a CountryProfile and must not contain timezone, country-business rules, KYC/legal/document settings, phone prefixes, currency/pricing/payment data, secrets, or environment bindings.
