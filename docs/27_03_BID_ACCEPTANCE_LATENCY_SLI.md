# SYSTEM 27.03 — Bid acceptance latency SLI

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define a stable latency indicator for **authoritative accepted bids** without inventing an SLO or latency target. SLO target ownership remains SYSTEM 27.07; latency/timeout budgets remain SYSTEM 27.09.

## Current architecture boundary

SYSTEM 27.01 identifies the critical bid-submission journey as `POST /api/bids`, but that authoritative route is not yet present in the current OpenAPI/runtime inventory.

The existing `POST /api/live-auction-clock` route is explicitly a non-authoritative browser-session demo. It is excluded from 27.03 and must never be used as evidence of real bid acceptance latency.

## Indicator

`bid_acceptance_latency_ms` is a server-side distribution over bids that are **durably accepted by the authoritative transaction**.

Start event:

- the authoritative bid request has passed boundary validation;
- the idempotency key has been validated;
- the request is admitted for authoritative processing.

End event:

- the accepted-bid commit is durable in PostgreSQL;
- the authoritative acceptance result is available to the API response path.

Rejected bids do not belong in this acceptance-latency distribution. Unknown or ambiguous acceptance outcomes are excluded from the distribution and remain failures in higher-level journey/availability indicators rather than being silently treated as accepted.

## Clock requirements

Latency must use a monotonic server-side clock. Client clocks and wall-clock ordering are forbidden for this SLI, and negative durations are invalid.

## Privacy and cardinality

Required dimensions are environment, operation ID and outcome. PII, credentials, request bodies, user IDs and bid amounts are forbidden as metric dimensions. Correlation IDs may be used to join traces/logs for diagnostics but are forbidden as metric dimensions.

## Authority

Telemetry is observational only. PostgreSQL remains authoritative for accepted bids, ordering, auction state, winners and final results.

## GREEN evidence

- Implementation exact-head commit: `0dbecf9da2a93a80ff1a26707e97b96a5530d94a`.
- Implementation PR #242 merged to `main` as `bf870ffbc915babe714ea622b0cde273f450d003`.
- Exact-head Verify Enchev Web run `36017661651`: SUCCESS; aggregate CI test suite (including the 27.03 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36017661582`, Secret Scan `36017661584`, SBOM Generation `36017661731`, Build Provenance `36017661532`, SYSTEM 26.05 `36017661513`, SYSTEM 24.02 `36017661571`.
- Exact-head Vercel Preview `dpl_DD6B4iqB5kpZgSdbbpgB24DCXXKQ` for commit `0dbecf9da2a93a80ff1a26707e97b96a5530d94a`: READY.
- This evidence commit is based directly on merged `main` commit `bf870ffbc915babe714ea622b0cde273f450d003`; its exact-head CI provides the required post-merge descendant verification before the evidence PR is merged.
- No SLO percentage or latency target was invented; ownership remains SYSTEM 27.07 and 27.09 respectively.
- The verifier proves current architecture truth: authoritative `POST /api/bids` is not yet implemented in OpenAPI/runtime, while the demo clock route remains explicitly non-authoritative and excluded.
- PostgreSQL remains authoritative; telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
