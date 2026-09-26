# SYSTEM 31.06–31.10 — International expansion validation

This package continues the Germany Country #2 dry run and remains fail-closed for production activation.

## 31.06 — Country #2 timezone/DST tests

The verifier exercises `Europe/Berlin` across both 2026 DST transitions:

- spring forward: UTC offset changes from +60 to +120 minutes;
- fall back: UTC offset changes from +120 to +60 minutes.

The same `CountryProfile` timezone is also used through the shared timezone-aware formatter.

## 31.07 — Country #2 Unicode/search tests

The dry run proves NFC normalization for decomposed German umlauts and search folding for München / Köln, Bulgarian-to-Latin vehicle search, and ASCII VIN/identifier matching.

## 31.08 — Country activation feature flag

`market-activation-feature-flag.ts` is country-neutral and fail-closed. The real DE dry-run flag remains disabled. The flag cannot override a blocked market-activation gate.

## 31.09 — Country activation rollback test

A simulation-only test builds a syntactically approved gate, enables the generic feature flag, confirms active=true in the simulation, then increments the flag revision and disables it again. The rollback must return active=false.

This simulation does not constitute legal approval, provider readiness, residency approval, or production activation for Germany.

## 31.10 — No core-auction rewrite verification

The Phase 31 verifier reruns the existing 21.12 no-core-rewrite invariant and scans protected auction/service roots for Germany-specific tokens. Country-specific values remain in configuration/locale/test evidence rather than auction domain logic.

## Production boundary

`marketActivationApproved` remains false. No real customer-data permission, legal sign-off, residency approval, production provider binding, or country activation is introduced by 31.06–31.10.
