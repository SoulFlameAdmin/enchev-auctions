# SYSTEM 33.16 — Multi-auction realtime consistency test

Status: YELLOW until exact-head CI, READY Vercel preview, implementation merge and descendant GREEN evidence are proven.

## Frozen identity
- 33.16 — Multi-auction realtime consistency test (kind: test)

## Contract
The realtime layer is a non-authoritative projection over PostgreSQL-authoritative auction state. The reducer is authenticated-user scoped and maintains an independent monotonic sequence for every auction.

It proves that:
- interleaved events for different auctions do not contaminate each other;
- duplicate or delayed events are idempotent and never regress state;
- a sequence gap marks only the affected auction stale and requires authoritative resync;
- bid amounts cannot regress;
- closed/cancelled auctions become ended;
- cross-user state or events fail closed;
- bounded auction, event and history limits are enforced.

## Acceptance evidence
The verifier checks the immutable 33.16 identity and executes interleaved two-auction, duplicate, out-of-order, gap, cross-user, regression and bounds cases. GREEN requires exact-head CI and READY Vercel preview evidence.
