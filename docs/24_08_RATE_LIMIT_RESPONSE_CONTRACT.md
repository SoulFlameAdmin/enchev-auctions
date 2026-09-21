# SYSTEM 24.08 — Rate-limit response contract

Task: **24.08 Rate-limit response contract**

Status: **YELLOW** — implementation is present on the task branch; GREEN requires applicable PASS CI and concrete merge evidence.

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

## Acceptance still required

GREEN requires the verifier/self-test plus aggregate lint/test/typecheck/build and applicable security/supply-chain checks to PASS on the exact implementation head, followed by merge/post-merge evidence recording. No manual Vercel deployment is required for this repository contract task.
