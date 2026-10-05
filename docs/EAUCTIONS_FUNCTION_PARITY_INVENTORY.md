# EAuctions by SoulFlame — Functional Parity Inventory

Baseline: GHKk63 / e1617b42e272fa3f40f06d93178f6f48a4211043
Target branch: ea-ui-functional-parity

## Verified current functional surfaces
- /inventory — make/model/VIN/LOT search, cross-script/typo search, filters, sort, pagination/view state, URL-persisted filter state, live/open/upcoming/sold states, buy-now/live-only filters.
- /live-auctions — server-session clock sync, reconnect/stale handling, lot advance, bid POST flow, bid feedback, price delta handling, active-tab guard, live room UI.
- /lot/[id] — vehicle detail route.
- /profile — account surface with My Auctions and Watchlist panels.
- /transport — transport flow.
- /vehicle-history — vehicle history flow.
- /support — support flow.
- /api/live-auction-clock — current browser-session demo authority boundary.
- /api/health/* — API/realtime/redis/web/worker/OIDC health surfaces.

## Brand/UI migration contract
New visual identity: **EAuctions by SoulFlame**.

The migration MUST NOT replace functional routes with static mockups. Existing route behavior, query parameters, API calls, state transitions, accessibility semantics, responsive behavior and backend contracts stay intact unless a separately tested improvement replaces them.

## Gate order
1. Global shell + brand without route regressions.
2. Inventory visual migration preserving all search/filter/state behavior.
3. Lot detail visual migration.
4. Live auctions visual migration preserving server clock and bid flow.
5. Profile/watchlist/my-auctions migration.
6. Transport/history/support migration.
7. Full responsive/accessibility regression pass.
8. API/Supabase/security regression pass.
9. Preview acceptance.
10. Production promotion only after GREEN parity.

## Safety
Current production main remains unchanged while this branch is under construction.
