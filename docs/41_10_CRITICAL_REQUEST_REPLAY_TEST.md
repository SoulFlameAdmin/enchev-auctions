# SYSTEM 41.10 — Replay / duplicate critical-request test

This task certifies the repository-side replay/idempotency guard for critical mutations.

## Existing foundation

SYSTEM 24.07 already defines the canonical `Idempotency-Key` behavior: actor + operation + key scope, canonical request fingerprint, deterministic in-progress rejection, completed-response replay and fail-closed conflict when the same key is reused with a different request.

41.10 turns that contract into an executable critical-request lifecycle with an explicit ledger and side-effect reference.

## Critical operations covered

The guard is reusable for representative high-impact mutations currently present in the system plan/domain boundaries:

- `bid.submit`
- `auction.finalize`
- `seller.reserve.update`
- `admin.privilege.change`

The critical property is **one logical request → at most one effect**.

A duplicate while the first request is in progress is rejected. A completed duplicate with the same fingerprint replays the stored response/effect reference and never executes again. The same actor/operation/key with another fingerprint fails closed. The same opaque key may be independently used by another actor or operation because those are separate scopes.

Completion itself is also idempotent only when status, stored response reference and effect reference are identical. Conflicting completion data fails closed, and one effect reference cannot be attached to two different logical requests.

## Abuse certification

The verifier simulates bid and finalization side effects and proves that repeated network delivery increments each effect counter exactly once. It also covers in-flight duplicates, payload/key conflicts, actor/operation scope separation, replay-before-completion, malformed keys/fingerprints and conflicting completion retries.

## Claim boundaries

The repository still does not contain the authoritative production bid/finalization runtime or database transaction adapter. Therefore this task does **not** claim that the ledger is already durably persisted in the same PostgreSQL transaction as those production mutations. That requirement from 24.07 remains mandatory when runtime adapters are implemented.

Payment-capture runtime is also not claimed. Rate-limit bypass remains 41.11.

Implementation: `packages/domain/src/critical-request-replay.ts`

Run: `node scripts/verify-critical-request-replay-41-10.mjs --self-test`
