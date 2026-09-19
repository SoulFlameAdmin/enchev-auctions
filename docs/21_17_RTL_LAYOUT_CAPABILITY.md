# 21.17 — RTL layout capability

## Goal

Prove that Enchev Auctions has a deterministic right-to-left layout capability without switching the current Bulgarian production UI to RTL and without hardcoding a specific RTL language or country into core logic.

## Canonical direction contract

The public `@enchev/config` boundary exports `packages/config/src/rtl-layout-capability.ts`.

The contract accepts exactly:

- `locale` — a valid BCP 47 locale identifier;
- `direction` — exactly `ltr` or `rtl`.

The functions are `resolveLayoutDirection(input)` and `layoutDirectionAttributes(input)`. Locale identifiers are canonicalized with `Intl.getCanonicalLocales`. Direction is explicit configuration data; it is not guessed from country or language.

## Acceptance surface

The isolated route `/rtl-capability` renders identical layout markup twice: one probe with `dir="ltr"` and one with `dir="rtl"`.

The fixture uses logical CSS for inline-sensitive geometry, including `padding-inline`, `margin-inline`, `border-inline-start`, `inset-inline-start`, `text-align:start`, and logical inline/block sizes.

This route is not a production locale and does not activate a market.

## Browser proof

The RTL acceptance verifier exercises the built route in the same Chrome/Edge CI environment used by Enchev visual regression. It requires mirrored inline order and start-edge placement, correct computed writing direction, and no horizontal overflow on mobile and desktop widths.

## Existing UI boundary

21.17 establishes capability. It does not claim that every legacy component has already been globally converted from physical left/right CSS.

The current Bulgarian UI remains LTR. A future production RTL locale must opt in through explicit locale-direction configuration and affected production components must use logical properties before activation.

## Relationship to neighboring tasks

- 21.16 selects a locale but does not infer text direction.
- 21.17 provides explicit layout-direction capability.
- 21.18 international names/address/phone models remains independent from visual direction.
- 21.19 and 21.20 continue to own translation completeness and cross-script search tests.

## Deployment boundary

21.17 does not require a Vercel create/update/redeploy operation. CI builds and verifies the capability locally.

## Acceptance

21.17 is GREEN only when the typed direction contract accepts LTR and RTL, rejects invalid values, contains no hardcoded RTL locale, the acceptance surface uses logical inline CSS, browser/runtime verification proves mirroring without overflow, and all existing SYSTEM/build/health/Chrome/Edge gates remain PASS.
