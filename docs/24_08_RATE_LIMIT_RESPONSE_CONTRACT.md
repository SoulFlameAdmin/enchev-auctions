# SYSTEM 24.08 — Rate-limit response contract

Task: **24.08 Rate-limit response contract**

Status: **GREEN** — implementation, exact-head CI, merge, and post-merge `main` verification passed.

## Contract

Rate-limited HTTP requests use a deterministic response contract:

- HTTP status is `429 Too Many Requests`.
- The body uses the canonical API error envelope with default code `RATE_LIMITED`.
- `Retry-After` is required and uses a non-negative integer number of seconds.
- `X-RateLimit-Limit` is a positive integer budget for the active limiter window.
- `X-RateLimit-Remaining` is a non-negative integer and must never exceed the limit.
- `X-RateLimit-Reset` is a non-negative Unix epoch timestamp in seconds.
- Invalid limiter metadata fails closed before a response contract is produced.
- The contract describes transport/backpressure semantics only. It does not determine auction state, bid ordering, eligibility, price, winner, or finalization.

## Shared implementation

`packages/contracts/src/http-schema.ts` exports the canonical HTTP 429 constants, typed response model, constructor and validator.

`config/enchev-rate-limit-response-contract.json` records the machine-readable contract. `scripts/verify-rate-limit-response-contract.mjs` verifies valid responses and negative fail-closed cases and is wired into the aggregate SYSTEM test pre-gates.

## GREEN evidence

- Implementation PR: #175.
- Exact implementation head: `f3d41ad7ee6be1763e429d3bbf56ab1248757ced`.
- Exact-head GitHub Actions PASS: Verify Enchev Web `35626658053`; Code Scan `35626658021`; Secret Scan `35626657983`; SBOM Generation `35626658996`; Build Provenance `35626657548`; SYSTEM 24.02 `35626657065`; SYSTEM 26.05 `35626657203`.
- Merged to `main` as `b8d1d16f98c7187efc146b64cdf2aee3d0a46620`.
- Post-merge `main` PASS: Verify Enchev Web `35627130038`; Code Scan `35627130140`; Secret Scan `35627130115`; SBOM Generation `35627130049`; Build Provenance `35627130008`.
- The aggregate Verify Enchev Web job completed successfully after lint/test/typecheck/build and browser visual-regression execution.
- No manual Vercel create/update/redeploy was required or performed for this repository contract task.

## Acceptance

The shared 429 response contract, fail-closed limiter metadata validation, aggregate pre-gate wiring, exact-head CI, merge, post-merge verification, and concrete evidence recording satisfy SYSTEM 24.08.
