# ENCHEV AUCTIONS — DP2-01 UX/UI AUDIT

Status: DP2-01 audit baseline
Date: 2026-09-19
Scope: public buyer experience only
Source plan: `docs/DESIGN_PROCESS_2.md`
Frozen predecessor: `docs/DESIGN_PLAN_V1.md` remains unchanged

## Audit objective

Establish a concrete visual and interaction baseline for the five core buyer routes before Design Process 2 changes the product system. This audit identifies hierarchy, navigation, density, responsive and auction-confidence gaps that prevent the current UI from feeling like a premium international auction platform.

This is an audit, not a redesign implementation. The findings below are the input to DP2-02 through DP2-30.

## Verified baseline

Five core buyer routes:

1. `/` — homepage
2. `/inventory` — inventory/search
3. `/lot/EA-10539` — vehicle detail
4. `/live-auctions` — LIVE auction
5. `/profile` — buyer workspace

Evidence used for the audit:

- GitHub cross-browser visual artifact `10574706977` from Verify Enchev Web run `35410882413`.
- Chrome and Microsoft Edge each captured all five routes at desktop `1440x1200` and mobile `390x844`.
- Artifact manifests contain 10 screenshots per browser.
- GitHub compare `a25424f4cb488e2d19737c470db6958493501b44...main` is 136 commits ahead with no changes to the five core buyer page implementations or their route-specific visual CSS. The intervening changes are system/process/DAVID work plus DP2 activation.
- Canonical Vercel production currently returns HTTP 200 for all five audited routes.
- Production is not the exact current-main commit; production lag is treated as deployment evidence only, not as permission to invent visual state.

### Current screenshot hashes — Chrome baseline

| Route | Desktop 1440x1200 | Mobile 390x844 |
| --- | --- | --- |
| `/` | `67656e7b86e5cfa3bf0546badbd35a8e33f8a00fd7034b02f25c8c214f87a840` | `38f1b27786ed0e79a014b13f27db58d0f3c4222e03cd8096cffed21a208c7f7c` |
| `/inventory` | `748e129df3c340af1152aff7b147f56a8e06b65a6dddb0fa87a26ff5e56c04dd` | `496b02874c105d2ceb5e01e9b0b03a42f27cf88e408adbb6f2e6f75ad53cd712` |
| `/lot/EA-10539` | `1876be5ae2d71087eab79168d860b3f468a3bcab7cafaf5b7c920feb789cb904` | `2ac23ea3a1db830aa77f2eec166eb7fcf4dc9aa071c354a403819a9a66b4a64c` |
| `/live-auctions` | `855494cc1edd1b214c1c6c76786941bb75e06ab3dba5ef51d95b5a9d693999ae` | `22ecb2b18d10e956dbad1225f5783bd54e6bfae6f3c13c59dd9e51dd38aca4de` |
| `/profile` | `8db9123c2feddf9ba390c9a25fec19c4a90231448f6304f250856576d2c85dc2` | `dbda0f34e2d67e9dced92c20e27d4dab7294d213f50edb96a016dec08acf683f` |

## Cross-product findings

### G01 — App shell is not yet one coherent product shell
Severity: high  
Maps to: DP2-02, DP2-03, DP2-04

Homepage, inventory, vehicle detail, LIVE and profile use related dark-green branding but visibly different header structures, heights, navigation density and account actions. The user changes context too much when moving between routes. A premium marketplace should feel persistent, not like five independently styled screens.

### G02 — Navigation hierarchy is too small and visually compressed on desktop
Severity: high  
Maps to: DP2-03, DP2-04

Primary navigation labels are visually subordinate to decorative/header information. The high-density uppercase treatment, utility strip and account actions compete for limited header space. Main buyer destinations should scan faster than secondary market/utility text.

### G03 — Mobile navigation is functional but not purpose-built enough
Severity: high  
Maps to: DP2-04, DP2-24, DP2-26

The mobile experience relies on compressed/wrapped navigation patterns across routes. Some screens expose a compact menu while others show route navigation directly. This creates inconsistent expectations for where inventory, LIVE, profile and support are found.

### G04 — Typography uses dramatic scale but lacks a unified density ladder
Severity: medium-high  
Maps to: DP2-03

Large display headings are strong, but supporting labels, metadata and navigation frequently become very small. The result is a wide jump from oversized hero typography to dense microcopy rather than a controlled type hierarchy for auction-critical information.

### G05 — Too many surfaces use the same dark-green visual weight
Severity: medium-high  
Maps to: DP2-02

Cards, panels, page backgrounds and utility surfaces often sit close together in luminance and border treatment. This reduces separation between primary action surfaces, data panels and passive context. DP2 needs a more explicit surface/elevation system.

### G06 — Bright green is overused as both brand accent and action/status signal
Severity: high  
Maps to: DP2-02, DP2-07, DP2-11, DP2-15, DP2-18

The same neon-green family communicates brand energy, primary CTA, LIVE state, positive state and active UI. Auction interfaces need clearer semantic distinctions so users can identify live status, bid action, accepted state and navigation emphasis without color ambiguity.

### G07 — Auction confidence information is present but visually fragmented
Severity: high  
Maps to: DP2-07, DP2-11, DP2-14, DP2-15, DP2-17, DP2-20

LOT, status, bid, time, location, condition and verification are implemented, but their ordering differs across cards, detail view and LIVE stage. The user should learn one consistent hierarchy and recognize it everywhere.

### G08 — Product language mixes Bulgarian and English in high-frequency UI
Severity: medium  
Maps to: DP2-27

Examples include LIVE, BUY NOW, UPCOMING, SOLD, VERIFIED, BUYER WORKSPACE, HOT LOT, RUN & DRIVE and Bulgarian labels in the same task context. Internationalization may retain standard auction terms, but the final copy system needs a deliberate language policy instead of ad-hoc mixing.

### G09 — Decorative/system UI can compete with buyer UI
Severity: high  
Maps to: DP2-04, DP2-30

The deployed homepage includes the ENCHEV system command-center trigger/panel and background switcher in the same document as the buyer marketplace. These controls are development/administrative product surfaces and visually undermine the perception of a focused international buyer product if exposed in the production buyer experience.

### G10 — Core responsive proof is strong at 390px but DP2 acceptance requires broader widths
Severity: high  
Maps to: DP2-24, DP2-25, DP2-29

The established visual artifact proves 390px mobile and 1440px desktop in Chrome/Edge. DP2 explicitly requires 360/390/430 mobile plus 1366/1440/1920-class desktop where applicable. Current proof therefore cannot satisfy final DP2 responsive acceptance by itself.

---

## Route audit — Homepage `/`

### Strengths retained as baseline

- Distinct ENCHEV identity and memorable black/green palette.
- Strong direct search by make/model/VIN/LOT.
- LIVE spotlight is visible in the hero on desktop.
- Featured inventory, process, trust/support and CTA sections already exist.
- Auction states are represented instead of generic ecommerce cards.

### H01 — Hero headline dominates more than the marketplace task
Severity: medium-high  
Maps to: DP2-03, DP2-05

“НАМЕРИ. НАДДАВАЙ. СПЕЧЕЛИ.” creates a bold campaign look, but the dominant display scale delays practical marketplace scanning. Search, live state and inventory discovery should carry more product weight relative to slogan weight.

### H02 — Hero desktop composition has large inactive negative space
Severity: medium  
Maps to: DP2-05

The left copy and right live card are visually separated by a wide dark field. The composition feels cinematic but not maximally information-efficient for a high-value auction marketplace.

### H03 — Mobile hero pushes live-market evidence too far below the first viewport
Severity: high  
Maps to: DP2-05, DP2-24

At 390px the headline, lead, search, chips and stats occupy the first viewport. The high-value LIVE spotlight is pushed down, weakening immediate proof that the platform is an active auction product.

### H04 — Search shortcuts are visually light and semantically mixed
Severity: medium  
Maps to: DP2-06

Brand shortcuts, region and damage category share the same pill pattern. Categories need clearer grouping or labeling so the user understands whether a chip is a make, geography or damage preset.

### H05 — Trust evidence is mostly copy, not operational proof
Severity: medium  
Maps to: DP2-08

The trust/support sections explain the platform, but visual proof such as transparent process markers, inspection/document cues, logistics coverage and support expectations can be structured more concretely.

---

## Route audit — Inventory `/inventory`

### Strengths retained as baseline

- Search, desktop filters and mobile filter entry are implemented.
- URL-backed state, active filters, sorting, pagination and grid/list switching exist.
- Auction card states are distinct.
- The layout already behaves as a serious search surface rather than a simple gallery.

### I01 — Desktop header/search/navigation stack is too dense
Severity: high  
Maps to: DP2-04, DP2-09

The inventory screen carries brand, route search, account actions, a second navigation row, market labels and category chips before results. The buyer task starts visually lower than necessary.

### I02 — Filter sidebar has weak grouping hierarchy
Severity: high  
Maps to: DP2-09

Many controls use similar label/field treatment. High-frequency filters, auction-state filters and secondary attributes need stronger grouping, progressive disclosure and count context.

### I03 — Result cards are narrow and data-heavy at the current desktop density
Severity: high  
Maps to: DP2-11

Three-column cards plus persistent sidebar compress image width and force multiple metadata lines into small visual blocks. The result looks operational but not premium.

### I04 — Auction-state hierarchy changes card-to-card
Severity: high  
Maps to: DP2-11

LIVE, SOLD, BUY NOW, NEXT/UPCOMING and generic badges do not share one consistent state zone. Users must re-scan each card to locate status, time and action.

### I05 — Mobile pre-results area is too tall
Severity: high  
Maps to: DP2-10, DP2-24

At 390px the header, page title, market summary, chips, save/search action, filter toggle and result toolbar consume a large part of the screen before the first full vehicle card.

### I06 — Mobile controls compete horizontally
Severity: medium-high  
Maps to: DP2-10, DP2-12, DP2-24

View mode, sorting, filter entry and result information are all useful but need a clearer priority model. The current arrangement is functional yet visually compressed.

### I07 — Save/watch affordance is not yet a first-class card interaction
Severity: medium  
Maps to: DP2-11, DP2-12

Saved-search/watch behavior exists elsewhere in the product, but inventory should make the “save this vehicle / watch this auction” action obvious and consistent without overwhelming the primary lot action.

---

## Route audit — Vehicle detail `/lot/EA-10539`

### Strengths retained as baseline

- Large media-first gallery.
- LOT and vehicle identity are explicit.
- Bid/price panel is visually separated.
- Key data and condition sections are present.
- Mobile gallery and sticky/action patterns already have a foundation.

### V01 — Desktop gallery overwhelms the information hierarchy
Severity: high  
Maps to: DP2-13, DP2-14

The main image consumes most of the first screen while key identifiers/specs/condition are split below or inside the narrow right panel. A premium auction detail page should balance visual inspection with immediate due-diligence data.

### V02 — Thumbnail rail is visually secondary but consumes a narrow desktop column
Severity: medium  
Maps to: DP2-13

The rail creates a three-column feel—main image, thumbnails, transaction panel—without giving thumbnails enough visual importance to justify the width.

### V03 — Bid panel contains critical information but reads like a compact card
Severity: high  
Maps to: DP2-15

Current price, timing and action are present, but the panel lacks a stronger transaction hierarchy separating current state, next action, timing and confidence/confirmation context.

### V04 — Key data below the gallery is not prioritized by buyer risk
Severity: high  
Maps to: DP2-14

LOT, VIN, mileage, damage, title/documents and condition should be grouped by decision importance rather than treated as equal metadata tiles.

### V05 — Mobile puts transaction context after substantial media
Severity: high  
Maps to: DP2-13, DP2-15, DP2-24

The 390px screenshot gives the gallery strong priority, but the buyer should retain immediate access to auction time/current bid/primary action while inspecting media.

### V06 — Trust/history/transport context feels appended rather than part of due diligence
Severity: medium-high  
Maps to: DP2-16

History, transport and trust information should form a coherent “buying confidence” sequence below the primary specs, not isolated secondary sections.

---

## Route audit — LIVE auction `/live-auctions`

### Strengths retained as baseline

- Dedicated live room exists.
- Current lot, countdown, current bid and next lot are implemented.
- Server-session demo state clearly avoids falsely claiming auction authority.
- Connected/reconnecting/stale states and bid feedback are implemented.

### L01 — Technical demo wording is too prominent for a buyer-facing live room
Severity: high  
Maps to: DP2-17, DP2-20, DP2-27

Phrases such as “server-session demo”, “server state” and “auctionAuthority=false” are correct implementation safeguards but should not dominate buyer-facing copy in the polished product. User-facing status should explain reliability and recency, while technical truth remains inspectable in diagnostics/testing.

### L02 — Desktop live stage does not fully use immersive hierarchy
Severity: medium-high  
Maps to: DP2-17

The stage, timer and transaction panel are strong, but the hero intro above them consumes vertical space before the actual auction interaction. The live room should prioritize the current lot and bidding state sooner.

### L03 — Mobile repeats status/timer before the vehicle stage
Severity: high  
Maps to: DP2-17, DP2-20, DP2-24

At 390px the heading, explanatory copy, connection state and server clock appear before the current lot image. The most urgent auction information should collapse into a compact sticky confidence strip.

### L04 — Bid feedback and action safety need clearer semantic separation
Severity: high  
Maps to: DP2-18

Accepted, leading, outbid and rejected are implemented, but DP2 should ensure each state changes more than text/color—iconography, concise message, next safe action and disabled/pending behavior should be clear.

### L05 — Next-lot continuity is present but visually secondary on mobile
Severity: medium-high  
Maps to: DP2-19

The buyer should always understand what follows the current lot without scrolling deep into the queue. Mobile needs a compact, persistent continuity cue.

### L06 — Connection health is correct but not yet confidence-optimized
Severity: medium-high  
Maps to: DP2-20

Connected/reconnecting/stale states should communicate “can I safely trust this timer and act now?” rather than expose infrastructure wording.

---

## Route audit — Profile `/profile`

### Strengths retained as baseline

- Buyer workspace concept exists.
- Watchlist and My Auctions are already distinct product areas.
- Desktop account rail and mobile account navigation are implemented.
- Quick handoffs back to inventory/LIVE/support are available.

### P01 — Desktop workspace still feels like a styled landing page
Severity: high  
Maps to: DP2-21

The large gradient introduction consumes prime workspace area. A serious account area should surface operational summaries, active auctions, saved vehicles and next actions before promotional hero-style content.

### P02 — Account navigation competes with global navigation
Severity: high  
Maps to: DP2-21, DP2-24

On desktop the left rail is useful, but on mobile the global header and account tabs create two simultaneous navigation systems. Their roles need stronger separation.

### P03 — Watchlist cards repeat inventory patterns without workspace-specific density
Severity: medium-high  
Maps to: DP2-22

Saved vehicles need quick state scanning—price movement, auction time, LIVE/leading/outbid relevance, remove/watch controls—rather than simply reproducing catalog cards.

### P04 — My Auctions needs stronger state semantics
Severity: high  
Maps to: DP2-22

Watching, bidding, leading and ended are already modeled, but the visual system should make urgency and required action immediately recognizable.

### P05 — Support/transport/history should feel like account tools
Severity: medium  
Maps to: DP2-23

Current quick links are generic cards. DP2 should align these routes to the buyer-workspace system with consistent page titles, status summaries and navigation.

---

## Responsive acceptance gaps

The current verified artifact proves:

- Mobile: 390px
- Desktop: 1440px
- Browsers: Chrome + Edge

DP2 final acceptance still requires explicit proof at:

- Mobile: 360px, 390px, 430px
- Tablet: 768px class and intermediate layouts
- Desktop: 1366px, 1440px, 1920-class where applicable

Specific risks to retest after redesign:

1. Header/nav wrapping and action containment at 360px.
2. Inventory filter/search/sort density at 360px and 430px.
3. Vehicle sticky action and gallery geometry at 360/430px.
4. LIVE timer + connection + bid action safe-area behavior.
5. Profile dual-navigation behavior.
6. 1366px inventory density and filter width.
7. 1920px maximum content width so layouts do not become sparse or over-stretched.

## Accessibility and interaction gaps to carry forward

Existing V1 work provides keyboard/focus/reduced-motion foundations, but DP2 must re-prove them after redesign:

- visible focus against every new surface;
- 44px-class touch targets for primary mobile actions;
- status not conveyed by color alone;
- reduced-motion behavior for LIVE/pulse/timer feedback;
- 200% zoom and narrow viewport containment;
- drawer/sheet focus management and escape behavior;
- sticky CTA not hiding content or browser safe areas.

## DP2 implementation order derived from the audit

1. DP2-02–04: unify tokens, typography/grid and app shell before route redesign.
2. DP2-05–08: rebalance homepage from campaign-heavy to marketplace-first.
3. DP2-09–12: reduce inventory chrome, improve filter IA and premium card scanning.
4. DP2-13–16: rebalance media, due-diligence data and transaction context.
5. DP2-17–20: make LIVE auction stage-first, confidence-first and mobile-safe.
6. DP2-21–23: make profile an operational buyer workspace.
7. DP2-24–30: certify widths, accessibility, states, performance, cross-browser and production consistency.

## DP2-01 completion gate

DP2-01 may be GREEN only when all of the following are true:

- the five required buyer routes are explicitly audited;
- concrete cross-route and route-specific visual/interaction gaps are documented;
- current browser screenshot evidence is identified;
- current production route availability is checked;
- the audit does not modify frozen D01–D36 evidence;
- no pricing/payment/finance scope is introduced;
- a dedicated DP2 branch/PR carries the audit and machine-readable DP2 evidence update;
- applicable CI remains passing.

