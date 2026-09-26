# SYSTEM 33.13 — Cross-device workspace synchronization

Status: YELLOW until implementation PR, exact-head CI, Vercel preview and descendant GREEN evidence are proven.

## Frozen identity
- 33.13 — Cross-device workspace synchronization

## Authority boundary
Buyer workspace state is PostgreSQL-authoritative. Device-local state and realtime transport are non-authoritative projections. Governance Supabase must not become an auction/workspace business-state store.

The synchronization layer cannot mutate auction state, accept a bid, determine a winner, or bypass the authoritative buyer/auction domain introduced by prior frozen tasks.

## Synchronization contract
A workspace snapshot carries:
- authenticated user ownership;
- monotonically increasing server revision;
- canonical section/item ordering;
- bounded idempotency history.

A device mutation carries:
- authenticated user ID;
- device ID for audit/context only;
- globally stable mutation ID;
- expected server revision;
- occurrence timestamp;
- bounded add/remove operations.

Rules:
- cross-user writes are rejected;
- already-applied mutation IDs are idempotent and do not increment revision;
- stale expected revisions are rejected with an explicit revision conflict;
- conflicts require authoritative server refetch before retry;
- accepted mutations increment the server revision exactly once;
- section/item order is deterministic across devices;
- all section/history/operation sizes are bounded.

## Acceptance evidence
The verifier proves frozen identity, governance boundary, deterministic normalization, idempotent retry, stale-write rejection, cross-user isolation, revision increments, bounds and malformed-input rejection. Full GREEN requires exact-head CI/security/provenance evidence, READY Vercel preview, implementation merge and descendant evidence sync.
