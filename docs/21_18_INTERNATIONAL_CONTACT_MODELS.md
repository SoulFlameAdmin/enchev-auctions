# 21.18 — International names, address and phone models

## Goal

Provide country-neutral, Unicode-safe data contracts for international names, postal addresses and telephone numbers without forcing Western first-name/last-name assumptions, a universal postal-code requirement, or country-specific phone parsing into core logic.

## Name model

`InternationalName` requires only `displayName`. Optional `nativeScriptName` and `sortName` preserve additional representations without assuming that every person has separate given/family names or that a single script is authoritative.

All stored textual fields pass through the existing 21.15 NFC Unicode normalization contract and reject malformed Unicode or blank-only text.

## Address model

`InternationalAddress` requires:

- a two-letter uppercase `countryCode`;
- one to four ordered `addressLines`.

`locality`, `administrativeArea`, `postalCode`, and `organization` are optional because address systems differ by jurisdiction. The core model does not require a postal code, state/province, street number, or Latin-script address.

The model stores address text but does not validate whether a real postal address exists. Country-specific address rules remain configurable outside this generic contract.

## Phone model

`InternationalPhone` requires the user/provider-preserved `rawInput`. Optional `e164` is accepted only in canonical E.164 syntax (`+` followed by 2–15 digits, first digit non-zero). Optional `extension` accepts ASCII digits.

The generic model does not infer a country, dialing prefix, carrier, line type, reachability, or ownership. Provider-backed phone verification belongs to a later operational task.

## Boundaries

21.18 introduces generic data contracts only. It does not:

- activate a country or market;
- create customer PII records in Supabase;
- claim postal or phone deliverability;
- implement identity/KYC verification;
- change pricing, payments, finance, tax, VAT, FX or accounting;
- require Vercel create/update/redeploy.

This task does not require Vercel create/update/redeploy.

21.19 continues to own translation completeness and 21.20 continues to own cross-script search tests.

## Acceptance

21.18 is GREEN only when the public `@enchev/config` boundary exports the three generic models and validators, Unicode/NFC behavior is verified, non-Western name/address fixtures are accepted without country-specific branches, invalid E.164/Unicode/shape fixtures are rejected, and the full existing CI/build/browser regression suite remains PASS.
