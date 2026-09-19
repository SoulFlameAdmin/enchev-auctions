# 21.08 — Country-specific KYC profile

## Goal

Establish the country-scoped KYC configuration contract used by later identity/compliance integration without hardcoding one country's rules into core runtime code.

## Canonical model

The public `@enchev/config` boundary exports the model from:

`packages/config/src/country-kyc-profile.ts`

The model contains only:

- `countryCode` — two uppercase ASCII letters and required to match the owning `CountryProfile.countryCode`;
- `revision` — positive integer used to version the profile contract;
- `requirements` — a non-empty, deterministic list of provider-neutral KYC requirement identifiers;
- each requirement contains exactly `key` and `required`;
- requirement keys are lowercase dot-separated identifiers, sorted and unique.

The validator is:

`validateCountryKycProfile(input, countryProfile)`

## Why the profile is country-specific

A KYC profile is always validated against a concrete `CountryProfile`. Cross-country attachment is rejected. The runtime contract therefore supports different policies per country without branching on country literals in authoritative core code.

## Compliance boundary

21.08 defines configuration structure, not legal advice and not a claim about any jurisdiction's current KYC requirements.

This task deliberately contains **no concrete country KYC records** and no jurisdiction-specific legal assertions. Real policy content must come from an approved compliance source before activation.

The profile is provider-neutral and must not contain:

- provider credentials or secrets;
- provider API client code;
- legal terms or legal-profile content owned by **21.09 Country-specific legal profile**;
- document-profile configuration owned by **21.10 Country-specific document profile**;
- market activation logic owned by **21.11 Market activation gate**;
- pricing, payment, finance, tax, or currency rules.

## Dependencies

21.08 depends on completed 21.01 through 21.07, especially:

- 21.01 `CountryProfile` for country binding;
- 21.02 for the no-country-hardcoding invariant.

## Acceptance

21.08 is GREEN only when the typed model, runtime validator, country-binding rejection, deterministic requirement invariants, source-boundary checks, aggregate CI, typecheck, production build, health smoke, and browser regression all pass with evidence.
