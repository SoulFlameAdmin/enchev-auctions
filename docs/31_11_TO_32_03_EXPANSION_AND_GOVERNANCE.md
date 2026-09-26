# SYSTEM 31.11–32.03 — Expansion completion and master-plan governance

This package completes Phase 31 and then continues, in frozen order, through the first three tasks of Phase 32.

## 31.11 — Third-language dry run

The existing `de-DE` package is exercised as the third distinct presentation language after Bulgarian and English. The verifier requires:

- three distinct locales and languages: `bg-BG`, `en-US`, `de-DE`;
- exact parity between `de-DE` and the canonical translation-key registry;
- non-empty NFC-normalized German messages;
- `Intl.DateTimeFormat` and `Intl.NumberFormat` execution for `de-DE`;
- the normal translation-completeness invariant and its negative self-tests.

This remains a dry run. Germany production activation is still false.

## 31.12 — RTL dry run

A non-production `ar-EG` fixture is passed through the generic RTL direction runtime. It must resolve to `lang="ar-EG"` and `dir="rtl"`.

The verifier also reruns the existing 21.17 RTL capability contract, which proves logical CSS and the `/rtl-capability` browser fixture used by the visual-regression pipeline. No Arabic production locale is registered or activated.

## 32.01 — Master task IDs immutable

The canonical `scripts/verify-master-task-ids.mjs` guard remains the source of truth. It must prove the frozen v1 plan still has exactly **1,054 tasks** with SHA-256:

`b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e`

## 32.02 — No silent delete/renumber

The same canonical ID-lock self-tests must reject:

- silent deletion;
- silent renumbering;
- ID reuse / duplicate IDs.

No parallel task registry is introduced.

## 32.03 — GREEN requires evidence

The canonical `scripts/verify-green-requires-evidence.mjs` guard must pass. Its negative tests must reject empty and whitespace-only evidence, while allowing GREEN only when non-empty evidence exists.

## Boundary

This package does not redefine the frozen master plan, activate a production market, register a production RTL locale, or weaken any GREEN/YELLOW/RED governance rule.
