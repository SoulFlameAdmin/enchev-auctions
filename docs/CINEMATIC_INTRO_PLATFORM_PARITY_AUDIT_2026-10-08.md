# ENCHEV — Cinematic intro → full platform parity audit (2026-10-08)

## Product contract
- Production root `/` stays the cinematic Forge intro with its original visuals, video, responsive motion and SYSTEM/Design tracker overlay.
- Intro buttons must open the functional platform as **top-level routes**, not render it inside the intro iframe.
- All old capabilities are retained or deliberately migrated; there is no replacement of a working flow with a screenshot, mock card or fake button.
- A visible screen/route is not proof of production functionality. Test persisted, authorized, end-to-end behavior.

## Route inventory (verified against pre-intro commit `6fd2c77` and branch restore)
| Route | Present | Current evidence and limitation |
| --- | --- | --- |
| `/` | Yes | Cinematic Forge iframe + Master System Plan overlay. |\n| `/platform` | Restored in PR #367 | Original September 19 marketplace homepage code is preserved with live spotlight, advanced make/model search entrance, brand links, live/buy-now shortcuts, featured vehicles, buyer journey and footer. |
| `/inventory` | Yes | Filters, sorting and lot links; current catalog is a hardcoded sample array. |
| `/lot/[id]` | Yes | Lot detail UI; current example data is static. |
| `/live-auctions` | Yes | Browser-session demo with 10s lots; API declares `auctionAuthority: false`. |
| `/profile` | Yes | Account-shaped workspace, watchlist and auction listings; sample local UI state. |
| `/vehicle-history` | Yes | VIN page explicitly states no real external VIN check. |
| `/transport` | Yes | Transport interface; provider integrations must be separately proven. |
| `/presentation` | Yes | ENCHEV presentation. |
| `/support` | Yes | Help and navigation UI. |
| `/auction-calendar` | Missing | Old capability cited in preserved route inventory; requires parity implementation or authenticated historical proof of replacement. |
| `/how-it-works` | Missing | Current navigation goes to `/#how`; verify section and preserve original information. |
| `/services` | Missing | Must verify original service pages/flows before declaring parity. |
| Dedicated account/auth routes | Not found in `app` directory | `/profile?view=register` is navigation, not independently proven registration/auth. |

## Navigation correction in this branch
- Keep cinematic intro and existing Forge animation.
- Map old Forge `start your project` CTAs into actual ENCHEV platform routes.
- Use the preserved full classic marketplace (`/platform`) when an intro CTA has no recognized heading.\n- Show a **PLATFORM** nav entry; classic brand/model search and LIVE/Buy Now discovery stay accessible.\n- Preserve the `/#how` buyer-journey destination as `/platform#how` on all existing routes.\n- Structural regression guard `npm run verify:intro-platform-parity` is also run by `npm test` (this does not replace E2E tests).
- Ensure Forge anchors to internal routes navigate `_top`, preserving the enclosing app chrome.
- Support both `<a>` and `<button>` CTA elements.
- Leave underlying auction, identity, payment and database behavior unchanged.

## Parity acceptance checklist
1. Desktop + Android/iOS: open intro, click every navigation item, all CTAs, verify full-screen **top-level** route and browser back to intro.
2. Confirm inventory search, filters, paging and vehicle details; test navigation to each lot.
3. Register + login + password reset; verify actual sessions and isolated roles/permissions.
4. Seller uploads a vehicle; data persists across logout/relogin and receives admin approval.
5. Two independent buyers bid on one auction; authoritative server validates bids and resolves one winner with append-only ledger and restart resilience.
6. Confirm payment sandbox, documents, release gating, handover, audit and completion in the P0 closed-demo plan.
7. Preserve watchlist, searches, vehicle history and transport flows with real storage/provider integrations where required. The original pre-intro commit did not expose a dedicated auction-calendar route.
8. Verify accessibility, mobile behavior, security, 404/error pages and no regressions on existing routes.
9. Publish only after checks and manual functional walkthrough are PASS; never infer feature completeness from Vercel READY.

## Explicitly incomplete
Current repository evidence is **not** enough to claim that the old complete platform works in production. Main priority after route bridge: MISSION-001 evidence-based gap analysis → full P0 demo → approved live pilot. Preserve frozen Master Plan IDs and GAP append-only governance.

## Bidding modes and catalog features — do not confuse UI with production engines
| Feature | Observed code/UI | Production proof required |
| --- | --- | --- |
| Make / model / VIN / LOT | `/inventory` implements searchable demo catalog with make/model selectors, cross-script search and URL query state. | Real inventory persistence, authorization, scale and actual inventory feed. |
| Filters | Region, location, damage, title status, year, auction state, live-only, buy-now; sort and pagination. | Dynamic real data + cross-device query consistency. |
| LIVE bidding | `/live-auctions` calls `/api/live-auction-clock`; endpoint uses cookie-backed 10-second demo state, `auctionAuthority:false`. | Database authoritative auction/bid ledger, two-buyer concurrency, immutable closure. |
| Quick bids | `/inventory` UI uses React `bidPrices` local state and increments `+100`. | Signed-in real bid API and accepted/rejected transaction validation. |
| Buy Now | Listed/filterable in inventory; visible sample buy-now prices. | One-time purchase, eligibility, payment, settlement and release gate. |
| Reserve / No Reserve / Seller approval | Listed in frozen Master System Plan auction configuration stage 08. | Must be implemented and end-to-end validated, not only described. |
| Pre-Bid / Max Bid / Proxy Bid | Listed in frozen Master System Plan stage 09. | Secure private max-bid storage, deterministic algorithm, transaction-safe ledger and tests. |
| Winning / Sold / My Auctions / Watchlist | Present as sample UI and React state. | Real persisted buyer identity, replayable transaction truth and correct auction outcome. |

## Historical comparison
- Pre-cinematic ENCHEV commit `6fd2c77fab3bd114f666c02a2d2082cf55a34de9` contained the classic homepage and platform routes.
- The old production-parity baseline `e1617b42e272fa3f40f06d93178f6f48a4211043` still has the same core route family and more app surfaces; 111 commits later the top-level root is cinematic.
- Do not overwrite or replace critical APIs, Supabase state, or production deployments while migrating visual navigation.
- A browser-level click audit and full interactive data-flow audit are necessary before calling this “no functional loss” verified.

## Live Supabase evidence (read-only verified 2026-10-08)
- Repository `config/enchev-supabase-project.json` explicitly names shared project `soulflame-twins`, ref `frhletkiuupgksmgxoxc`, `auction_authority: false`.
- Authenticated Supabase connection confirms project `frhletkiuupgksmgxoxc` is `ACTIVE_HEALTHY`.
- `public.enchev_plan_state`: 312 existing plan-state records; this is governance progress, not a live auction.
- `public.enchev_development_events`: 0 recorded events.
- `public.enchev_cert_auctions`: 0 rows; `public.enchev_cert_bids`: 0 rows. Both have RLS enabled and schemas representing certification/prototype bids, but zero real persisted test transactions in this database.
- There is **no evidence of an operational, production-authoritative ENCHEV bid/auction service** from these tables, API routes or repo state. The current public clock route explicitly advertises `auctionAuthority:false`.
- Do not repurpose shared SoulFlame/Twins tables or alter RLS/policies without an ENCHEV-specific isolation plan, separate role access and tested migrations.
- Next engineering gate: an isolated demo domain schema, explicit role policies, concurrent bid transactions and bid audit journal — then a two-buyer sandbox demonstration. **No real-money bids before proof.**

## Security and browser tests
- Initial CI failure was traced to HIGH advisories in `sharp 0.35.4` and `source-map-js 1.2.1`.
- A read-only GitHub Actions resolver proposed npm lockfile updates; the branch now pins `sharp 0.35.5`, `source-map-js 1.2.2` and compatible platform binaries. The dependency-security check passed on the updated lockfile.
- Original frozen `npm test` script restored after the CI quality guard correctly detected script drift; parity tests now run in independent CI workflows.
- Dedicated static parity guard PASS; desktop+mobile Chromium browser-level parity check added separately and must be PASS before release.
