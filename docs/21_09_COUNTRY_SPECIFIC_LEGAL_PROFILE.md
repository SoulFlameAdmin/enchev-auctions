# 21.09 — Country-specific legal profile

## Goal

Establish a country-scoped legal configuration contract for Enchev Auctions without hardcoding jurisdiction-specific legal conclusions into authoritative core code.

## Canonical model

The public `@enchev/config` boundary exports the model from:

`packages/config/src/country-legal-profile.ts`

The model contains only:

- `countryCode` — two uppercase ASCII letters and required to match the owning `CountryProfile.countryCode`;
- `revision` — positive integer used to version the legal-profile contract;
- `requirements` — a non-empty deterministic list of legal requirement identifiers;
- each requirement contains exactly `key`, `required`, and `authorityRef`;
- `key` values are lowercase dot-separated identifiers, sorted and unique;
- `authorityRef` is a required stable source-reference identifier so future legal policy records remain traceable to an approved source.

The validator is:

`validateCountryLegalProfile(input, countryProfile)`

## Why the profile is country-specific

A legal profile is always validated against a concrete `CountryProfile`. Cross-country attachment is rejected. Different country policies can therefore be supplied as configuration without branching on country literals in authoritative core code.

## Legal/compliance boundary

21.09 defines configuration structure only. It is **not legal advice** and does not state that any legal requirement applies in any jurisdiction.

This task deliberately contains **no concrete country legal records**, statute interpretations, legal conclusions, terms text, or legal sign-off assertions. Real policy content must be supplied from an approved legal/compliance source before market activation.

The profile must not contain:

- provider credentials or secrets;
- KYC-profile content owned by **21.08 Country-specific KYC profile**;
- document-profile configuration owned by **21.10 Country-specific document profile**;
- market activation logic owned by **21.11 Market activation gate**;
- pricing, payment, finance, tax, currency, or accounting rules.

A concrete jurisdiction can remain externally blocked on legal sign-off without blocking this generic contract or independent system work. The later activation gate must not treat an unsigned legal profile as proof of market readiness.

## Dependencies

21.09 depends on completed 21.01 through 21.08, especially:

- 21.01 `CountryProfile` for country binding;
- 21.02 for the no-country-hardcoding invariant;
- 21.08 for the established country-profile pattern and separation of compliance concerns.

## Acceptance

21.09 is GREEN only when the typed model, runtime validator, country-binding rejection, source-reference requirement, deterministic requirement invariants, source-boundary checks, aggregate CI, typecheck, production build, health smoke, and browser regression all pass with evidence.
