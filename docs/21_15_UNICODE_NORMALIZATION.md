# 21.15 — Unicode normalization

## Goal

Establish one deterministic Unicode normalization contract for Enchev Auctions before international names, addresses, translation checks, and cross-script search build on top of user-visible text.

## Canonical contract

The public `@enchev/config` boundary exports:

`packages/config/src/unicode-normalization.ts`

The contract is:

- normalization form: **NFC**;
- `normalizeUnicodeText(input)` validates runtime input and returns canonical text;
- `isUnicodeTextNormalized(input)` reports whether the input is already valid NFC;
- malformed UTF-16 containing an unpaired high or low surrogate is rejected;
- normalization is deterministic and idempotent.

## Why NFC

NFC composes canonically equivalent Unicode sequences while preserving text semantics.

21.15 deliberately does **not** use compatibility normalization such as NFKC. Compatibility folding can change presentation or semantic distinctions and must not be silently applied to human names, addresses, vehicle data, legal text, or user content.

## Preservation rules

Unicode normalization must not:

- trim whitespace;
- lowercase or uppercase text;
- strip accents or diacritics;
- transliterate scripts;
- remove punctuation;
- collapse mixed-script text;
- perform confusable-character security decisions.

Those concerns, where applicable, belong to explicit downstream validation/search/security policies.

## Relationship to later international tasks

- **21.16 Locale fallback chain** operates on locale identifiers, not by mutating user text.
- **21.18 International names/address/phone models** can normalize human-entered text to NFC at explicit boundaries.
- **21.19 Translation completeness checks** can compare canonical resource values.
- **21.20 Cross-script search tests** can use normalized text without pretending visually similar characters are identical.

## Security boundary

Unicode normalization is not a spoofing/confusable detector. A string that mixes scripts or contains visually confusable code points may still be valid NFC. Any security-sensitive identifier policy must perform a separate explicit check.

## Deployment boundary

21.15 is a pure runtime/configuration contract. It does not require Vercel create/update/redeploy, database migration, provider mutation, or secret access.

## Scope exclusions

No pricing, payment, finance, tax, VAT, FX, customs, accounting, legal conclusion, or market-activation decision is introduced.

## Acceptance

21.15 is GREEN only when:

1. the public config boundary exports the NFC contract;
2. canonically equivalent decomposed/precomposed text normalizes identically;
3. normalization is idempotent;
4. valid supplementary-plane characters remain intact;
5. malformed lone surrogate sequences are rejected;
6. NFKC-style compatibility folding is not performed;
7. case, whitespace, script, punctuation, and diacritics are not destructively rewritten beyond NFC;
8. prior international-readiness invariants, aggregate CI, TypeScript, production build, health smoke, and Chrome/Edge regression all pass with evidence.
