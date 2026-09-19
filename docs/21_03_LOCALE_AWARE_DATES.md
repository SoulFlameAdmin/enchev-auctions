# 21.03 — Locale-aware dates

## Goal

Provide a country-neutral, shared date-only formatting contract that always receives an explicit locale and never depends on the host/browser default locale.

## Implemented contract

`packages/config/src/locale-aware-date.ts` exposes:

- `formatLocaleDate(input, locale, style)` for explicit locale-aware calendar-date formatting.
- `formatCountryProfileDate(input, profile, requestedLocale?, style)` for formatting through the typed `CountryProfile` locale set.
- `YYYY-MM-DD` and explicit `{ year, month, day }` inputs.
- deterministic validation for invalid calendar dates, empty/unsupported locales, unsupported profile locales, and unsupported styles.
- `numeric` and `long` date styles without concrete market/country locale records.

The implementation uses `Intl.DateTimeFormat` with the caller/profile locale. It does not use `navigator.language`, an omitted locale, environment variables, or a launch-country locale literal.

## Dependency boundary

21.03 depends on:

- 21.01 CountryProfile configuration model.
- 21.02 no country-specific hardcoding.

The implementation remains country-neutral and consumes locale configuration instead of defining a concrete launch market.

## Timezone boundary

21.03 is deliberately a **calendar-date** formatter, not a timestamp/instant formatter.

UTC is used only as an internal normalization zone for date-only values so the runtime host timezone cannot shift the requested calendar day. This is not user-facing timezone conversion.

**21.04 owns timezone-aware instant display** and must add the explicit user/market timezone behavior separately.

## Out of scope

This task does not define BG/EN translation resources, translation keys, KYC/legal/document country profiles, market activation logic, or timezone-aware timestamp conversion. Those remain owned by their later frozen-plan tasks.
