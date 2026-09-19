# 21.20 — Cross-script search tests

## Goal

Prove that the current BG/EN marketplace can search human-readable vehicle text across Bulgarian Cyrillic and Latin without changing canonical stored text or weakening VIN/LOT identifier handling.

## Search contract

- Canonical application data remains NFC text under the 21.15 Unicode contract.
- Cross-script matching is a derived, non-authoritative search projection.
- Bulgarian Cyrillic text is transliterated to a deterministic Latin search key.
- Latin text remains Latin and is case-folded for search.
- Combining marks are removed only from the derived search key; canonical data is not rewritten.
- Whitespace is normalized only inside the derived search key.
- Empty queries continue to mean no text restriction.
- The current model is scoped to the registered BG/EN locale pair. Future scripts require an explicit versioned profile instead of silent heuristics.

## Identifier boundary

VIN and LOT values are not passed through cross-script transliteration.

Identifier matching accepts ASCII letters, digits and hyphen only, then performs case-insensitive substring matching. A Cyrillic or mixed-script confusable such as `ЕА-10482` must not match ASCII LOT `EA-10482`.

This boundary prevents a human-language convenience feature from becoming identifier spoofing logic.

## Acceptance fixtures

The verifier proves all of the following:

1. Cyrillic query `Ауди RS3` finds Latin `Audi RS3 Sportback`.
2. Latin query `audi` finds Cyrillic `Ауди`.
3. Latin transliteration `sofiya` finds Cyrillic `София`.
4. Cyrillic `Флорида` finds Latin `Florida`.
5. ASCII VIN/LOT full and partial searches continue to work.
6. Cyrillic/mixed-script identifier confusables are rejected.
7. Case and Latin combining-mark differences are search-insensitive.
8. Unknown text remains a non-match.
9. The real inventory page uses the shared matcher with human text and identifiers passed in separate fields.

## Boundaries

21.20 is a search-equivalence test and runtime matching contract. It is not linguistic translation, synonym search, typo correction, semantic search, country activation, or a confusable-security detector for arbitrary prose.

No pricing, payments, finance, tax/VAT, FX, accounting, KYC, legal, customer-data or provider behavior changes.

This task does not require Vercel create/update/redeploy.

## GREEN gate

21.20 is GREEN only after the dedicated verifier and negative self-tests pass, aggregate CI passes, TypeScript passes, the production build passes, the built health smoke passes, and existing Chrome/Edge visual regression remains green.
