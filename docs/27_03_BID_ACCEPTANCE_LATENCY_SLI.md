# SYSTEM 27.03 — Bid acceptance latency SLI

Status: **YELLOW** until exact-head CI and post-merge verification pass.

## Purpose

Define a stable latency indicator for **authoritative accepted bids** without inventing an SLO or latency target. SLO target ownership remains SYSTEM 27.07; latency/timeout budgets remain SYSTEM 27.09.

## Current architecture boundary

SYSTEM 27.01 already identifies the critical bid-submission journey as `POST /api/bids`, but that authoritative route is not yet present in the current OpenAPI/runtime inventory.

The existing `POST /api/live-auction-clock` route is explicitly a non-authoritative browser-session demo. It is therefore excluded from 27.03 and must never be used as evidence of real bid acceptance latency.

## Indicator

`bid_acceptance_latency_ms` is a server-side distribution over bids that are **durably accepted by the authoritative transaction**.

Start event:

- the authoritative bid request has passed boundary validation;
- the idempotency key has been validated;
- the request is admitted for authoritative processing.

End event:

- the accepted-bid commit is durable in PostgreSQL;
- the authoritative acceptance result is available to the API response path.

Rejected bids do not belong in this acceptance-latency distribution. Unknown or ambiguous acceptance outcomes are also excluded from the distribution and must remain failures in higher-level journey/availability indicators rather than being silently treated as accepted.

## Clock requirements

Latency must use a monotonic server-side clock. Client clocks and wall-clock ordering are forbidden for this SLI, and negative durations are invalid.

## Privacy and cardinality

Required dimensions are environment, operation ID and outcome. PII, credentials, request bodies, user IDs and bid amounts are forbidden as metric dimensions. Correlation IDs may be used to join traces/logs for diagnostics but are forbidden as metric dimensions.

## Authority

Telemetry is observational only. PostgreSQL remains authoritative for accepted bids, ordering, auction state, winners and final results.

## Acceptance

GREEN requires the executable verifier and negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge descendant verification. This task defines measurement semantics only; it does not claim the authoritative bid route is already implemented.
