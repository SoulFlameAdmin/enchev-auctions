# ENCHEV — Cinematic intro → full platform parity audit (2026-10-08)

## Product contract
- Production root `/` stays the cinematic Forge intro with its original visuals, video, responsive motion and SYSTEM/Design tracker overlay.
- Intro buttons must open the functional platform as **top-level routes**, not render it inside the intro iframe.
- All old capabilities are retained or deliberately migrated; there is no replacement of a working flow with a screenshot, mock card or fake button.
- A visible screen/route is not proof of production functionality. Test persisted, authorized, end-to-end behavior.

## Current route inventory (checked against repository `main`)
| Route | Present | Current evidence and limitation |
| --- | --- | --- |
| `/` | Yes | Cinematic Forge iframe + Master System Plan overlay. |
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
- Use a safe catalog destination when an intro CTA has no recognized heading.
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
7. Preserve watchlist, searches, auction calendar, vehicle history and transport flows with real storage/provider integrations where required.
8. Verify accessibility, mobile behavior, security, 404/error pages and no regressions on existing routes.
9. Publish only after checks and manual functional walkthrough are PASS; never infer feature completeness from Vercel READY.

## Explicitly incomplete
Current repository evidence is **not** enough to claim that the old complete platform works in production. Main priority after route bridge: MISSION-001 evidence-based gap analysis → full P0 demo → approved live pilot. Preserve frozen Master Plan IDs and GAP append-only governance.
