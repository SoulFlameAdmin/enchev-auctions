# SYSTEM 27.13 — Load-shedding rules

Status: **GREEN** — load-shedding policy, fail-closed verification, exact-head CI, merge, READY preview, and post-merge descendant verification are complete.

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

## GREEN evidence

- Implementation exact-head commit: `36235e8569330ff4babd21acfa9ecf972a268ff3`.
- Implementation PR #264 merged to `main` as `78c0bc6edc909daa96afc5997158a10b28f52535`.
- Exact-head Verify Enchev Web run `36114414224`: SUCCESS; SYSTEM pre-gates including the 27.13 fail-closed verifier/self-tests, aggregate CI suite, TypeScript, production build, built health smoke, Chrome/Edge visual regression, and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36114414243`, Secret Scan `36114414236`, SBOM Generation `36114414252`, Build Provenance `36114414340`, SYSTEM 26.05 `36114414274`, SYSTEM 24.02 `36114414214`.
- Exact-head Vercel Preview `dpl_5CmYQDaSBsHza8T6nL459Kg5T4bJ` for commit `36235e8569330ff4babd21acfa9ecf972a268ff3`: READY.
- This evidence branch is based directly on merged `main` commit `78c0bc6edc909daa96afc5997158a10b28f52535`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Shed authoritative commands are rejected before mutation and can never be reported as successful.
- Bid admission fairness forbids user, pricing-tier, geographic, or opaque-random preferential admission.
- Scaling operational procedure remains owned by SYSTEM 27.14.
- PostgreSQL remains authoritative; load-shedding policy cannot manufacture accepted bids, winners, or final auction state.
