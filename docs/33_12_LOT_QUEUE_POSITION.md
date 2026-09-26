# SYSTEM 33.12 — Lot queue position / lots-away indicator

Status: YELLOW until implementation PR, exact-head CI, Vercel preview and descendant GREEN evidence are all proven.

## Frozen identity
- 33.12 — Lot queue position / lots-away indicator

## Authority boundary
The lot queue and lot state remain authoritative in PostgreSQL. This task adds only a deterministic read-only buyer projection. Realtime transport may refresh the projection but is never authoritative; sequence gaps or stale projections require an authoritative resync.

The projection cannot mutate auction state, accept bids, select a winner, or create duplicate auction business state in governance Supabase.

## Contract
For one auction and one target lot, the projection:
- validates a bounded queue;
- rejects blank identifiers, duplicate lot IDs, duplicate queue orders, invalid queue orders, and multiple live lots;
- orders deterministically by authoritative queue order;
- treats the live lot as current, or the first upcoming lot when no live lot exists;
- exposes the target queue position;
- computes `lotsAway` only across actionable `live|upcoming` lots;
- marks sold, unsold, or cancelled target lots as `passed`;
- never mixes rows from another auction into the calculation.

## Acceptance evidence
The verifier must prove exact frozen task identity, authority boundaries, queue validation, deterministic ordering, current/upcoming/passed behavior, lots-away math, bounds, and negative self-tests. Full GREEN requires exact-head CI and deployment evidence plus descendant evidence sync.
