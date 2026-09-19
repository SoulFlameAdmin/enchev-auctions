# 21.01 CountryProfile configuration model

Task 21.01 establishes the country-neutral configuration contract used by later international-readiness work.

## Canonical model

The model lives in `packages/config/src/country-profile.ts` and contains only:

- `countryCode`: two uppercase ASCII letters.
- `defaultLocale`: locale identifier used as the country's default.
- `supportedLocales`: non-empty, unique locale list containing the default locale.
- `timeZone`: `UTC` or an IANA-style timezone identifier.

The validator is `validateCountryProfile(input)`.

## Boundaries

This task deliberately contains **no concrete country records**. It does not implement BG/EN locale content, locale-aware formatting, KYC/legal/document profiles, market activation logic, or country-specific business rules. Those belong to later frozen tasks.

The model is secret-free and does not read runtime environment variables or provider credentials.

## Verification

Run:

`node scripts/verify-country-profile-model.mjs`

and:

`node scripts/verify-country-profile-model.mjs --self-test`
