# SYSTEM 27.14 — Scaling runbook

Status: **YELLOW** until fail-closed verification, exact-head CI, merge, and post-merge descendant verification pass.

## Purpose

Define the operational procedure for scaling Enchev Auctions when reliability or capacity evidence shows a real bottleneck.

The runbook does **not** invent production instance counts, concurrency values, connection-pool sizes, or universal scale percentages. Those values must come from the actual provider/runtime and measured evidence.

## Preconditions

Before changing capacity:

- assign an owner;
- identify the affected SYSTEM 27.11 capacity dimension;
- capture trigger evidence from capacity, SLO/error-budget, latency/timeout, retry, degradation or shedding state;
- capture an authoritative health baseline;
- review whether a downstream dependency is already saturated;
- define the rollback path;
- attach a correlation/change ID.

If the bottleneck is unknown, do not scale blindly.

## Procedure

### 1. Observe and confirm
Identify the affected capacity dimension and capture current SLO, latency, retry and error-budget evidence.

Confirm the signal is not only a stale client/realtime projection.

### 2. Stabilize
If needed, use the already verified SYSTEM 27.12 graceful-degradation rules and SYSTEM 27.13 load-shedding rules to protect the authoritative core.

Scaling never authorizes weakening auction correctness.

### 3. Choose the action
Select a change that targets the observed bottleneck.

Before increasing upstream capacity or concurrency, confirm the downstream dependency can accept the extra pressure.

Define:

- expected signal improvement;
- the exact rollback condition;
- the evidence that will be checked after the change.

### 4. Execute incrementally
Make one bounded, reversible capacity change and record it.

Do not stack unrelated or unverified scaling changes. That would destroy causality and make rollback unsafe.

### 5. Verify after every step
Check:

- the affected capacity signal;
- SLO and error-budget behavior;
- latency/timeouts;
- retry pressure;
- PostgreSQL/authoritative auction invariants;
- accepted-bid and winner correctness.

If risk rises without the expected benefit, rollback.

### 6. Recover optional traffic
Only after health evidence is stable enough for recovery, progressively remove shedding/degradation.

Higher-priority traffic stays protected; optional load returns last.

### 7. Close the record
Record:

- before/after evidence;
- final capacity state;
- rollback or successful result;
- remaining risk;
- follow-up work when the dimension is still uncertified.

## Allowed action classes

The runbook permits horizontal capacity, vertical capacity, worker-concurrency changes, connection-capacity changes and scale-down **only** when their safety preconditions are satisfied.

It does not prescribe provider-specific quantities.

A concurrency increase is forbidden when downstream capacity is unknown or already saturated.

A connection-capacity increase requires a known downstream connection budget.

Scale-down requires health evidence; when capacity remains uncertain, keep a conservative posture.

## Rollback

Rollback is required when:

- an authoritative auction invariant fails;
- downstream saturation worsens;
- material system health regresses;
- the expected signal does not improve and the change increases risk.

Rollback itself must be recorded.

## Authority

PostgreSQL remains authoritative for accepted bids, auction state, finalization and winners.

Scaling operations and telemetry may never manufacture an accepted bid, choose a winner, or rewrite authoritative history.

## Phase 27 completion boundary

SYSTEM 27.14 closes the Phase 27 SLO/capacity/resilience policy chain. It provides the operational response procedure built on:

- 27.08 error-budget policy;
- 27.09 latency/timeout budgets;
- 27.10 retry budgets;
- 27.11 capacity model;
- 27.12 graceful degradation;
- 27.13 load shedding.

GREEN here proves the runbook contract and its verification gates. It does not claim measured production capacity or provider-specific autoscaling is already configured.

## Acceptance

GREEN requires the fail-closed verifier and negative self-tests, package/pre-gate wiring, exact-head CI/security/build checks, READY exact-head Vercel preview, merge to main, and post-merge descendant verification.
