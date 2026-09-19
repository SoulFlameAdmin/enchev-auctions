# ENCHEV AUCTIONS — DESIGN PROCESS 2

Status: ACTIVE
Owner: DAVID / ENCHEV DESIGN worker
Machine-readable evidence: `app/design-process-2-evidence.json`
Previous plan: `docs/DESIGN_PLAN_V1.md` remains frozen and complete; Process 2 does not rewrite D01-D36.

## Mission

Rebuild the public ENCHEV buyer experience to a world-class product-design standard on phone and desktop. The result must feel like a serious international auction platform rather than a template or a collection of disconnected screens.

Research may use established vehicle-auction and marketplace products as UX/information-architecture references, but ENCHEV must keep original branding, code, copy, assets and visual identity.

## Execution law

- Execute strictly DP2-01 → DP2-30 unless a dependency requires a tightly related block.
- Work in a dedicated branch/PR. Never make an unverified visual change directly in production.
- Preserve existing auction/system behavior unless the active DP2 task explicitly requires a safe UI integration.
- GREEN requires implementation + relevant test + concrete evidence.
- YELLOW means partial implementation, pending visual proof, failing test or external blocker.
- RED means not implemented.
- Update `app/design-process-2-evidence.json` after each proven task.
- Validate both mobile and desktop. Minimum mobile acceptance: 360px, 390px and 430px widths. Desktop acceptance: 1366px, 1440px and wide 1920px class layouts where applicable.
- Do not add pricing/payment/finance scope.
- Do not modify DAVID orchestration files during normal DP2 design execution.
- Before any Vercel create/update/redeploy, obey the existing global Supabase deployment lease.
- A task is not complete because code compiles. It must be visually and functionally verified.
- Every completed worker response ends with exactly `OK`.
- Use `PROBLEM IN: <exact blocker>` only for a new internal technical defect that blocks all safe DP2 work. External provider/quota/permission blockers are recorded and deferred while independent work continues.

## Design principles

1. Premium but restrained: strong hierarchy, typography, imagery, spacing and state clarity; avoid decorative noise.
2. Mobile-first without degrading desktop: phone UI is purpose-built, not a squeezed desktop.
3. Auction confidence: lot status, timing, current bid, next action and trust signals must be immediately legible.
4. Consistency: homepage → inventory → lot → LIVE → profile/support must feel like one product.
5. Conversion without pressure: primary actions are obvious, but destructive/financial actions retain clear context and confirmation.
6. Accessibility is part of the visual system: keyboard, focus, contrast, zoom, reduced motion and touch targets are acceptance requirements.
7. Performance is design quality: responsive images, stable layout, controlled effects and minimal unnecessary client work.

## Process 2 tasks

### Foundation
- **DP2-01** — Full UX/UI audit of current production and five core buyer routes; document concrete visual/interaction gaps.
- **DP2-02** — Premium ENCHEV design tokens: color, surfaces, borders, elevation, radii, interaction states.
- **DP2-03** — Typography, spacing, density and responsive grid system.
- **DP2-04** — Unified responsive app shell: brand, header, navigation, account actions and mobile navigation.

### Homepage
- **DP2-05** — World-class hero composition and value proposition.
- **DP2-06** — Search, quick discovery and category shortcuts.
- **DP2-07** — Featured vehicle cards and auction-state hierarchy.
- **DP2-08** — Trust, process, logistics, support and final CTA composition.

### Inventory
- **DP2-09** — Search/filter information architecture and desktop filter system.
- **DP2-10** — Mobile filter drawer/sheet and active-filter experience.
- **DP2-11** — Premium inventory cards, grid/list modes and auction-state visibility.
- **DP2-12** — Sorting, pagination, result counts, saved-search/watch actions and empty states.

### Vehicle detail
- **DP2-13** — Vehicle gallery, thumbnails, zoom/viewer and media hierarchy.
- **DP2-14** — Vehicle title, identifiers, specs, damage, documents and condition hierarchy.
- **DP2-15** — Bidding/Buy Now panel, sticky desktop/mobile CTA and clear auction timing.
- **DP2-16** — History, fees/context, transport, related vehicles and trust sections.

### LIVE auction
- **DP2-17** — LIVE auction stage composition and visual priority.
- **DP2-18** — Bid interaction, accepted/leading/outbid/rejected feedback and action safety.
- **DP2-19** — Next lot, queue, sold results and auction continuity.
- **DP2-20** — Timer, connection/reconnect/stale states and realtime confidence.

### Buyer workspace
- **DP2-21** — Profile/dashboard shell and responsive account navigation.
- **DP2-22** — Watchlist, saved vehicles and My Auctions state design.
- **DP2-23** — Support, transport, history and account routes aligned to the same product system.

### Responsive & accessibility
- **DP2-24** — Phone acceptance at 360/390/430px: layout, navigation, safe areas, overflow and touch ergonomics.
- **DP2-25** — Tablet and desktop acceptance from 768px through 1920px+: density and use of space.
- **DP2-26** — Keyboard/focus/contrast/zoom/reduced-motion/touch-target accessibility pass.

### Product polish & certification
- **DP2-27** — Loading, skeleton, empty, error, offline and success-state visual system; final copy consistency.
- **DP2-28** — Performance-oriented design pass: image sizing, layout stability, effects and responsive asset behavior.
- **DP2-29** — Chrome + Edge visual regression on core routes, desktop + phone, with screenshot evidence.
- **DP2-30** — Final ENCHEV consistency/originality and production acceptance pass.

## Completion gate

DESIGN PROCESS 2 is complete only when DP2-01 through DP2-30 are all GREEN with concrete evidence and the production candidate is visually/functionally verified on mobile and desktop. Do not invent DP2-31 automatically. New scope requires an explicit user request or a documented regression.
