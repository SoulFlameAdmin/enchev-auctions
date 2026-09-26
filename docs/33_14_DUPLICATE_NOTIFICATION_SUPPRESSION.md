# SYSTEM 33.14 — Duplicate notification suppression

Status: YELLOW until implementation PR, exact-head CI, Vercel preview and descendant GREEN evidence are proven.

## Frozen identity
- 33.14 — Duplicate notification suppression (kind: test)

## Authority boundary
Durable notification delivery/idempotency history is PostgreSQL business state. Governance Supabase is not notification-delivery authority. Realtime transport is non-authoritative.

This task validates deterministic suppression behavior and cannot mutate auction state, accept bids, or select winners.

## Suppression contract
Notification identity is scoped by:
`userId + notification kind + dedupeKey`.

Therefore:
- the same notification for the same user/kind/key is delivered at most once per batch;
- a matching active delivery-ledger entry suppresses redelivery;
- an expired ledger entry no longer suppresses;
- the same dedupe key for another user is independent;
- the same dedupe key for another notification kind is independent;
- blank identity/payload values and invalid timestamps are rejected;
- candidate and ledger input are bounded;
- output order is deterministic.

Starting-soon reminders from 33.11 already expose a deterministic `reminderKey`; that value is suitable as the notification `dedupeKey`. Saved-search and future notification producers must likewise provide a stable producer-owned key.

## Acceptance evidence
The verifier proves frozen identity, authority boundary, within-batch suppression, persisted-delivery suppression, expired-ledger behavior, user/kind isolation, deterministic ordering, limits and malformed-input rejection. Full GREEN requires exact-head CI/security/provenance evidence, READY Vercel preview, implementation merge and descendant evidence sync.
