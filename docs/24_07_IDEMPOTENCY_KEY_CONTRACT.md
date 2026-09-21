# SYSTEM 24.07 — Idempotency-key contract

Task: **24.07 Idempotency-key contract**

Status: **GREEN** — implementation, exact-head CI, merge, and post-merge `main` verification passed.

## Contract

Mutation endpoints that opt into retry-safe semantics use the canonical `Idempotency-Key` request header.

- Keys are opaque client-generated identifiers, 1–128 characters, matching `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.
- The server scopes a key to the authenticated actor and operation/route. A key is not globally reusable across identities or operations.
- The first request records a canonical request fingerprint and enters an in-progress state before side effects can be duplicated.
- A completed retry with the same fingerprint replays the stored status/response and does not repeat side effects.
- Reusing the same scoped key with a different request fingerprint fails closed with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- A duplicate while the original request is still in progress fails deterministically with `IDEMPOTENCY_REQUEST_IN_PROGRESS`; it must not execute concurrently.
- Critical authoritative mutations must persist the idempotency record in the same database transaction as the authoritative state change, or behind an equivalently atomic boundary.
- Records require a documented retention window appropriate to the endpoint before production activation. Expiry must never permit replay to corrupt an already-authoritative auction/payment/result state.
- The key is transport/retry metadata only. It is never an identity credential, authorization signal, auction winner selector, bid ordering source, eligibility decision, price authority, or finalization authority.

## Shared implementation

`packages/contracts/src/http-schema.ts` exports the canonical header name, key validator, required-key guard and deterministic decision function for new, replay, in-progress and conflicting requests.

`config/enchev-idempotency-key-contract.json` records the machine-readable contract. `scripts/verify-idempotency-key-contract.mjs` verifies positive behavior and negative fail-closed cases and is wired into the aggregate SYSTEM test pre-gates.

## GREEN evidence

- Implementation PR: #173.
- Exact implementation head: `557691418bacbbdac2659a29d49fbcdd1720891d`.
- Exact-head GitHub Actions PASS: Verify Enchev Web `35625424365`; Code Scan `35625424663`; Secret Scan `35625424353`; SBOM Generation `35625424374`; Build Provenance `35625424522`; SYSTEM 24.02 `35625424564`; SYSTEM 26.05 `35625424559`.
- Merged to `main` as `cd88d73bffc39ec23f326863cef7d3d807dafc5b`.
- Post-merge `main` PASS: Verify Enchev Web `35625995533`; Code Scan `35625995739`; Secret Scan `35625995475`; SBOM Generation `35625995482`; Build Provenance `35625995477`.
- The aggregate Verify Enchev Web job completed successfully after lint/test/typecheck/build and browser visual-regression execution.
- No manual Vercel create/update/redeploy was required or performed for this repository contract task.

## Acceptance

The shared contract, fail-closed negative cases, deterministic replay/conflict behavior, aggregate pre-gate wiring, exact-head CI, merge, post-merge verification, and concrete evidence recording satisfy SYSTEM 24.07.
