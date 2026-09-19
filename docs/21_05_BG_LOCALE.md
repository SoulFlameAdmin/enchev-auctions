# 21.05 — BG locale

## Goal

Register the Bulgarian presentation locale as a concrete, validated locale resource without introducing country-specific business logic into authoritative core code.

## Resource

`locales/bg.json` is the canonical 21.05 locale registration.

It declares:

- BCP 47 locale: `bg-BG`
- language: `bg`
- script: `Cyrl`
- region: `BG`
- text direction: `ltr`
- native display name: `Български`
- English display name: `Bulgarian`

The verifier requires `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.PluralRules` support for the registered locale and confirms that `Intl.Locale(...).maximize()` resolves to Bulgarian/Cyrillic/BG metadata.

## Dependency boundary

21.05 depends on the completed international-readiness foundations:

- 21.01 CountryProfile configuration model
- 21.02 no country-specific hardcoding
- 21.03 locale-aware dates
- 21.04 timezone-aware display

The concrete BG locale lives under `locales/`, which 21.02 explicitly reserves for later locale work rather than authoritative/core runtime logic.

## Translation architecture boundary

21.05 is **locale registration only**.

It intentionally does not define translation keys, message catalogs, fallback chains, or runtime translation lookup. Those remain owned by:

- 21.06 EN locale
- 21.07 Translation key architecture
- 21.16 Locale fallback chain
- 21.19 Translation completeness checks

The BG locale resource must not contain `messages`, `translations`, `dictionary`, or `keys` fields.

## Business/configuration boundary

The locale resource is not a CountryProfile and must not contain timezone, country-business rules, KYC/legal/document settings, phone prefixes, currency/pricing/payment data, secrets, or environment bindings.
