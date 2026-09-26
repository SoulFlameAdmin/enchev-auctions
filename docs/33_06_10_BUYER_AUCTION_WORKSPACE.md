# SYSTEM 33.06–33.10 — Buyer auction workspace

This block implements the next five frozen Phase 33 tasks in order:

- **33.06 My Auctions: Bidding**
- **33.07 My Auctions: Leading**
- **33.08 My Auctions: Ended**
- **33.09 Realtime multi-auction action panel**
- **33.10 Auction schedule / calendar**

## Authority boundary

These features are read-only buyer projections over authoritative auction and accepted-bid state. They do not create a second source of truth.

- PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.
- WebSocket/realtime state is projection-only.
- A sequence gap marks panel state stale and requires authoritative resync.
- No business tables are applied to the connected governance-only Supabase project.

## Buyer auction projections

`packages/domain/src/buyer-auction-workspace.ts` provides deterministic functions for:

- active auctions where the authenticated user has at least one accepted bid;
- live auctions where the user is the current authoritative leader;
- closed auctions where the user participated with an accepted bid;
- a bounded multi-auction panel with per-auction sequence/staleness state;
- a sorted, validated auction calendar with duplicate-auction collapse.

Cross-user rows are ignored by every user-scoped projection.

## Realtime semantics

The panel never treats realtime delivery as authority. It carries sequence and stale flags only. Stale state is not auto-healed by guessing; the caller must resync from authoritative state before trusting further incremental events.

## Calendar semantics

Calendar entries require a valid start timestamp and, when present, an end timestamp that is not earlier than start. Entries are sorted by scheduled start and bounded by a configurable maximum.

## Acceptance

GREEN requires exact frozen task identity, domain verifier/self-tests, aggregate CI integration, exact-head CI/security/build success, a READY exact-head Vercel preview, merge, and post-merge descendant evidence.

No protected DAVID orchestrator file is modified.
