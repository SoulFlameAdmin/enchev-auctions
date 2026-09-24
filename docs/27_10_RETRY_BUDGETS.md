# SYSTEM 27.10 — Retry budgets

Status: **GREEN** — bounded retry policy, fail-closed verification, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define bounded retry counts and backoff behavior for the reliability paths already defined by SYSTEM 27.03–27.09.

These values are **initial provisional engineering budgets**, not measured production performance. They must be reviewed after representative production evidence exists.

## Retry budgets

| Logical operation | Automatic retries after initial attempt | Backoff |
| --- | ---: | --- |
| Authoritative bid acceptance | 0 | none |
| Realtime delivery | 2 | 250 ms, 750 ms + full jitter |
| Reconnect recovery | 3 | 500 ms, 1.5 s, 4 s + full jitter |
| Auction finalization | 1 | 1 s + full jitter |

The retry count is **in addition to the initial attempt**. Each attempt still uses the timeout ceiling from SYSTEM 27.09; retry policy may not silently extend a single attempt timeout.

## Ambiguous outcomes

Authoritative bid acceptance is never blindly retried. An unknown/timeout outcome requires an authoritative PostgreSQL-backed read before any explicit retry, and any retried command must preserve the idempotency key.

Auction finalization permits at most one automatic retry, but only through the idempotent finalization command. If the previous outcome is unknown, the worker must read authoritative state before retrying. A durable PostgreSQL commit remains the only success authority.

## Realtime and reconnect

Realtime delivery retries are transport-only and never authoritative. Duplicate delivery cannot create a bid, winner or auction result.

Reconnect recovery is bounded and requires a fresh authoritative baseline before incremental events resume. A sequence gap forces resync; transport reopen alone is not success.

## Permanent failures and provider signals

Validation errors, permission errors and other explicit permanent failures are not retryable.

When an external provider supplies an authoritative Retry-After or equivalent retry time, the caller must honor it. The system must never invent a provider retry time. Provider quota/billing/credential blockers remain external blockers rather than reasons for unbounded retries.

## Error-budget semantics

Retries do not erase failed attempt telemetry. A later successful retry may complete the logical operation, but earlier failed attempts remain observable under their source SLI/error-budget semantics.

## Ownership boundaries

SYSTEM 27.10 owns retry counts/backoff only.

- capacity model: SYSTEM 27.11;
- graceful degradation: SYSTEM 27.12;
- load shedding: SYSTEM 27.13.

## Authority

PostgreSQL remains authoritative for accepted bids, auction state, winner selection and final results. Retry policy and telemetry are not authority and may never manufacture success.

## Review rule

Budgets may be changed only with representative operational evidence and explicit approval. Retry counts must not be increased merely to hide reliability failures or recover an exhausted error budget.

## GREEN evidence

- Implementation exact-head commit: `e61427508ae1f81fd7754b88bfcd88fde6281762`.
- Implementation PR #257 merged to `main` as `f9df9c0d8d451289b1bfc69fb00c977d792615ea`.
- Exact-head Verify Enchev Web run `36046694678`: SUCCESS; aggregate CI test suite (including 27.10 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36046694796`, Secret Scan `36046694688`, SBOM Generation `36046694723`, Build Provenance `36046694721`, SYSTEM 26.05 `36046694711`, SYSTEM 24.02 `36046694550`.
- Exact-head Vercel Preview `dpl_w1i1935HEbJi2PCqWQsTQ8o7nZ7t` for commit `e61427508ae1f81fd7754b88bfcd88fde6281762`: READY.
- This evidence branch is based directly on merged `main` commit `f9df9c0d8d451289b1bfc69fb00c977d792615ea`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Retry counts/backoff values are initial engineering policy values, not measured production results.
- Capacity remains owned by SYSTEM 27.11; graceful degradation by 27.12; load shedding by 27.13.
- PostgreSQL remains authoritative; retry policy and telemetry cannot manufacture accepted bids, winners, or final auction state.
- Protected DAVID orchestrator files were not modified.
