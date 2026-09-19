# 21.07 — Translation key architecture

## Goal

Establish one stable, locale-neutral translation-key contract for Enchev Auctions without implementing later locale-selection, fallback, or completeness policy.

## Canonical contract

The public `@enchev/config` boundary exports:

- `TRANSLATION_KEY_MODEL_VERSION`
- `TRANSLATION_KEY_SEPARATOR`
- `TRANSLATION_KEY_PATTERN`
- `TranslationKey`
- `isTranslationKey(value)`
- `assertTranslationKey(value)`
- `translationKeySegments(value)`

A valid key uses the canonical shape:

`namespace.section.name`

Each segment starts with a lowercase ASCII letter and may continue with ASCII letters or digits. Keys are dot-separated, contain at least three segments, are at most 120 characters, and are identifiers rather than user-facing copy.

Examples:

- `common.actions.confirm`
- `auction.actions.placeBid`
- `vehicle.fields.vin`

## Canonical registry

`locales/translation-keys.json` is the canonical 21.07 registry.

The registry is versioned, sorted, unique, locale-neutral, and deliberately stores only identifiers. It does not contain translated message values.

The completed locale registration files `locales/bg.json` and `locales/en.json` remain metadata-only resources. 21.07 does not move messages into those files.

## Stability rules

Translation keys:

- must not use visible English or Bulgarian sentences as identifiers;
- must not be prefixed by a locale code;
- must not encode country, timezone, currency, pricing, payment, legal, KYC, or document policy;
- must be globally unique in the registry;
- must be stored in deterministic lexicographic order;
- are stable identifiers intended to survive copy changes.

## Dependency boundary

21.07 depends on completed 21.01 through 21.06.

This task owns the translation key architecture only. It intentionally does **not** implement:

- runtime locale negotiation;
- locale fallback behavior — owned by **21.16 Locale fallback chain**;
- RTL layout behavior — owned by **21.17 RTL layout capability**;
- translated catalog completeness enforcement — owned by **21.19 Translation completeness checks (test)**;
- cross-script search — owned by **21.20 Cross-script search tests (test)**.

Concrete KYC, legal, and document profiles remain owned by 21.08 through 21.10.

## Acceptance

21.07 is GREEN only when the generic TypeScript contract, canonical registry, verifier, negative self-tests, aggregate CI, typecheck, production build, health smoke, and browser regression all pass with evidence.
