# SYSTEM 27.13 — Load-shedding rules

Status: **YELLOW** until fail-closed verification, exact-head CI, merge, and post-merge descendant verification pass.

## Purpose

Define safe admission-control and load-shedding rules for Enchev Auctions when demand threatens reliability.

This task defines **priority and safety semantics**. It does not claim production auto-shedding is active and it does not invent new capacity limits.

## Priority order

Load is shed from least critical to most critical:

1. optional enrichment, recommendation refresh, noncritical analytics and best-effort notifications;
2. noncritical reads and optional search/catalog enrichment;
3. recovery reads such as authoritative reconnect baseline/state refetch;
4. critical authoritative operations such as bid admission, finalization, authorization and eligibility.

Critical auction traffic is protected as long as safety can be preserved.

## Authoritative commands

A shed authoritative command must be rejected **before** authoritative mutation.

For bid admission:

- a shed bid must return explicit failure;
- it may never be recorded as accepted;
- the system may never return success for a shed bid;
- an unknown outcome requires an authoritative read before any explicit retry;
- retry semantics remain owned by SYSTEM 27.10.

Already committed authoritative state is never rolled back merely because the system entered a shedding mode.

Auction finalization may not be silently dropped.

## Fairness

Load shedding must not create bidder favoritism.

The policy forbids:

- user-specific preferential admission;
- pricing-tier preferential bid admission;
- geographic preferential bid admission;
- opaque random dropping of bids.

Requests in the same traffic class must follow the same deterministic policy, and a decision must be explainable from telemetry and traffic class.

## Activation

Signals may come from:

- SYSTEM 27.08 error-budget state;
- SYSTEM 27.09 latency/timeout behavior;
- SYSTEM 27.11 capacity model;
- SYSTEM 27.12 graceful-degradation state.

The thresholds in SYSTEM 27.11 are planning signals. Automatic shedding requires separately certified capacity plus a verified runtime implementation.

SYSTEM 27.13 does not claim that automatic runtime activation already exists.

## Responses

Where retry is safe, overload rejection must be explicit and retryable.

A `Retry-After` value may only be emitted when an authoritative value is known. It must never be invented.

Validation, permission and permanent failures remain non-retryable.

Telemetry must record the traffic class, decision and reason.

## Recovery

Recovery requires pressure to clear and relevant health evidence.

Higher-priority traffic is restored first; optional traffic returns progressively. Runtime implementations must include anti-flapping behavior.

## Ownership boundary

SYSTEM 27.13 owns admission-control and load-shedding safety rules.

Scaling operational procedure remains owned by SYSTEM 27.14. Capacity certification remains owned by SYSTEM 27.11.

## Authority

PostgreSQL remains authoritative for auction state, accepted bids, finalization and winners.

Load-shedding policy may not manufacture accepted bids, choose winners, mutate historical authoritative state, or make realtime transport authoritative.

## Acceptance

GREEN requires the fail-closed verifier and negative self-tests, package/pre-gate wiring, exact-head CI/security/build checks, READY exact-head Vercel preview, merge to main, and post-merge descendant verification.
