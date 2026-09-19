# 21.12 — Country #2 without core rewrite

## Goal

Prove that a second country can be onboarded through data/configuration while the authoritative runtime remains country-neutral.

## Generic onboarding contract

The public `@enchev/config` boundary exports:

`packages/config/src/country-market-bundle.ts`

The canonical validator is:

`validateCountryMarketBundle(input)`

A bundle contains exactly:

- `countryProfile`;
- `kycProfile`;
- `legalProfile`;
- `documentProfile`.

The validator reuses the already verified runtime contracts from 21.01, 21.08, 21.09, and 21.10. KYC, legal, and document profiles must all bind to the same validated country profile.

## Country #2 proof

The 21.12 verifier runs two distinct synthetic country bundles through the **same compiled runtime function**.

The proof requires:

- two different country codes;
- different locale/time-zone configuration;
- different KYC/legal/document data;
- both bundles accepted without a country-specific branch;
- a cross-country profile mix rejected;
- no second-country literal compiled into `packages/config/src`.

The synthetic fixtures exist only inside the verification script. They are not launch markets, not legal assertions, and not production country records.

## No-core-rewrite law

Adding Country #2 must not require:

- `if/switch` logic for a concrete country code;
- a country-specific core implementation;
- edits to the existing KYC/legal/document validators for the second fixture;
- provider credentials, secrets, or environment-variable reads;
- a real market activation record.

Country-specific values arrive as typed input data.

## Activation and compliance boundary

21.12 proves onboarding capability only. It does **not** activate a second real market and does not fabricate KYC, legal, document, customer-data, or provider approval.

Real market activation remains governed by the fail-closed **21.11 Market activation gate** and external approvals.

## Scope exclusions

This task does not add:

- pricing, payment, finance, tax, currency, or accounting rules;
- deployment orchestration or Vercel changes;
- regional CDN/data-residency behavior owned by 21.13–21.14;
- RTL, fallback, or cross-script behavior owned by later 21.x tasks.

## Acceptance

21.12 is GREEN only when the generic bundle contract, two-country runtime proof, cross-country rejection, no-country-hardcoding regression, aggregate CI, TypeScript, production build, health smoke, and browser regression all pass with concrete evidence.
