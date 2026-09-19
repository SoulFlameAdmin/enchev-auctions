# 21.16 — Locale fallback chain

## Goal

Define one deterministic locale-negotiation and fallback contract for Enchev Auctions without hardcoding a global English fallback or deriving market policy from locale strings.

## Canonical contract

The public `@enchev/config` boundary exports:

`packages/config/src/locale-fallback-chain.ts`

The runtime entry point is:

`resolveLocaleFallbackChain(profile, requestedLocale?)`

It validates the owning `CountryProfile`, canonicalizes locale identifiers with the platform BCP 47 locale implementation, and returns an ordered fallback chain.

## Fallback order

For a valid requested locale:

1. exact supported locale, when present;
2. other supported locales with the same language, in the explicit `CountryProfile.supportedLocales` order;
3. the country profile's `defaultLocale` as the final safety fallback.

The default locale is never duplicated.

If the exact requested locale is already the profile default, the chain is only that default locale.

If no requested locale is supplied, the chain is only the profile default.

## No hardcoded global fallback

21.16 deliberately does **not** hardcode `en`, `en-US`, Bulgarian, or any other locale as a universal fallback.

The only final fallback comes from `CountryProfile.defaultLocale`.

This preserves the data-driven Country #2 architecture established by 21.12.

## Canonicalization rules

Locale identifiers are canonicalized with `Intl.getCanonicalLocales`.

The contract rejects:

- malformed requested locale identifiers;
- malformed supported locale identifiers;
- supported locale values that become duplicates after canonicalization;
- a default locale that does not canonicalize to one of the supported locales.

Locale negotiation does not mutate user-visible text. Unicode text normalization remains owned by **21.15 Unicode normalization**.

## Boundaries

The fallback chain does not:

- infer country from language or locale;
- cross into a different `CountryProfile`;
- choose legal/KYC/document policy;
- activate a market;
- translate content;
- perform translation completeness checks owned by **21.19**;
- perform cross-script search behavior owned by **21.20**.

## Deployment boundary

21.16 is a pure configuration/runtime contract. It does not require Vercel create/update/redeploy, database migration, provider mutation, or secret access.

## Acceptance

21.16 is GREEN only when:

1. exact supported locale selection is deterministic;
2. regional locale fallback uses same-language supported locales;
3. the profile default is the final fallback;
4. no global locale is hardcoded;
5. BCP 47 canonicalization is deterministic;
6. canonical duplicate supported locales are rejected;
7. invalid requested locales are rejected;
8. prior international-readiness invariants, aggregate CI, TypeScript, production build, health smoke, and Chrome/Edge regression all pass with concrete evidence.
