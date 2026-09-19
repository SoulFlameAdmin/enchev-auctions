# 21.19 — Translation completeness checks

## Goal

Make incomplete translation catalogs a build failure for every locale registered in the canonical `locales` metadata directory.

## Canonical sources

- `locales/translation-keys.json` remains the authoritative locale-neutral key registry from 21.07.
- Locale metadata remains in `locales/<language>.json` (currently BG and EN).
- User-facing messages live in `locales/messages/<locale>.json`.

A message catalog contains `schemaVersion`, its canonical `locale`, and a `messages` object.

## Completeness invariant

For every registered locale:

1. a matching message catalog must exist;
2. catalog keys must match the canonical registry exactly;
3. missing keys are rejected;
4. extra/unknown keys are rejected;
5. every message must be a non-blank string;
6. every message must be well-formed Unicode and NFC-normalized;
7. catalog locale must exactly match the locale metadata record;
8. registry and catalog key order must remain deterministic.

The current registry contains 49 keys. BG and EN therefore prove 98 complete message entries.

## Boundaries

21.16 locale fallback remains separate. Fallback behavior is not accepted as a substitute for a complete registered catalog.

21.19 verifies structural completeness and normalization. It does not claim linguistic quality, legal suitability, market activation, provider readiness, or human translation sign-off. Proper nouns and technical labels may legitimately have identical values across locales.

21.20 continues to own cross-script search tests.

This task does not require Vercel create/update/redeploy and changes no pricing, payments, finance, tax, VAT, FX, accounting, KYC, legal or customer-data behavior.

## Acceptance

21.19 is GREEN only when the canonical BG/EN catalogs exist, exact key parity passes, negative completeness tests pass, aggregate CI passes, TypeScript passes, the production build passes, the built health smoke passes, and Chrome/Edge visual regression remains green.
