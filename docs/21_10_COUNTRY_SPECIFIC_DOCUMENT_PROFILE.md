# 21.10 — Country-specific document profile

## Goal

Establish a country-scoped document-requirement configuration contract for Enchev Auctions without hardcoding one jurisdiction's document policy into authoritative core code.

## Canonical model

The public `@enchev/config` boundary exports the model from:

`packages/config/src/country-document-profile.ts`

The model contains only:

- `countryCode` — two uppercase ASCII letters and required to match the owning `CountryProfile.countryCode`;
- `revision` — positive integer used to version the document-profile contract;
- `documents` — a non-empty deterministic list of document requirements;
- each document requirement contains exactly `key`, `subject`, and `required`;
- `key` is a lowercase dot-separated document identifier;
- `subject` is a lowercase neutral identifier that describes what entity/process the requirement applies to without hardcoding a closed subject enum;
- each `subject:key` pair is unique and the list is sorted by that identity.

The validator is:

`validateCountryDocumentProfile(input, countryProfile)`

## Why the profile is country-specific

A document profile is always validated against a concrete `CountryProfile`. Cross-country attachment is rejected. Different market document requirements can therefore be supplied as configuration without country-literal branches in authoritative core code.

## Boundary

21.10 defines document requirement structure only. It deliberately contains **no concrete country document records** and makes no claim about which documents a jurisdiction legally requires.

This task does not own:

- KYC policy content owned by **21.08 Country-specific KYC profile**;
- legal policy content or legal sign-off owned by **21.09 Country-specific legal profile**;
- market activation logic owned by **21.11 Market activation gate**;
- upload UI, storage buckets, malware scanning, OCR, media processing, provider clients, or file-retention implementation;
- document binary content, templates, translations, or customer data;
- pricing, payment, finance, tax, currency, or accounting rules.

Concrete country document policies can remain externally blocked on legal/compliance/customer-data sign-off without blocking this generic configuration contract or independent system work.

## Dependencies

21.10 depends on completed 21.01 through 21.09, especially:

- 21.01 `CountryProfile` for country binding;
- 21.02 for the no-country-hardcoding invariant;
- 21.08 and 21.09 for separation between KYC, legal, and document concerns.

## Acceptance

21.10 is GREEN only when the typed model, runtime validator, country-binding rejection, deterministic subject/key invariants, source-boundary checks, aggregate CI, typecheck, production build, health smoke, and browser regression all pass with evidence.
