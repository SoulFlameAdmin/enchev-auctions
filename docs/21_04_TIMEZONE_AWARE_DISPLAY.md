# 21.04 — Timezone-aware display

## Goal

Provide one country-neutral shared contract for displaying timestamp instants in an explicitly selected timezone.

## Implemented contract

`packages/config/src/timezone-aware-display.ts` exposes:

- `formatTimeZoneDateTime(input, locale, timeZone, style)` for explicit locale + explicit timezone rendering.
- `formatCountryProfileDateTime(input, profile, requestedLocale?, style)` using the validated `CountryProfile.timeZone` and enabled locale set.
- ISO timestamp strings must contain `Z` or an explicit UTC offset; ambiguous local timestamp strings are rejected.
- `Date` inputs must represent a valid instant.
- timezone identifiers are validated through `Intl.DateTimeFormat`.
- `numeric` and `long` display styles include a timezone name.

No timezone is inferred from the server, browser, operating system, environment variables, or a launch-country constant.

## Dependency boundary

21.04 depends on:

- 21.01 CountryProfile configuration model.
- 21.02 no country-specific hardcoding.
- 21.03 locale-aware calendar dates.

21.03 remains the date-only contract. 21.04 owns timestamp/instant conversion into an explicit display timezone.

## Internationalization boundary

21.04 consumes an explicit locale but does not define concrete BG/EN locale resources. Those remain owned by 21.05 and 21.06, while translation-key architecture remains owned by 21.07.

## Out of scope

This task does not create country records, translation catalogs, KYC/legal/document profiles, market activation rules, or regional infrastructure.
