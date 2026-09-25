# SYSTEM 27.12 — Graceful degradation rules

Status: **YELLOW** until fail-closed verification, exact-head CI, merge, and post-merge descendant verification pass.

## Purpose

Define how Enchev Auctions may reduce **non-authoritative** functionality during capacity pressure, dependency impairment, or reliability incidents while preserving correctness of the auction core.

This task defines the rules. It does **not** claim that automatic degradation is already active in production.

## Core rule

When the system cannot safely provide the full experience:

1. preserve authoritative correctness;
2. reduce optional/non-authoritative work first;
3. never approximate or invent accepted bids, auction state, winners, eligibility, or authorization;
4. fail closed if an authoritative invariant cannot be preserved.

PostgreSQL remains authoritative.

## Protected capabilities

Graceful degradation may never weaken or bypass:

- authentication and authorization;
- buyer eligibility enforcement;
- authoritative bid acceptance;
- auction timer/state-transition authority;
- auction finalization and winner selection;
- idempotency and duplicate protection;
- durable audit and critical event history.

A protected path that cannot operate safely must fail closed rather than return an approximate success.

## Capabilities that may degrade

### Optional enrichment
Optional enrichment may be disabled while the base authoritative data remains available. Degradation must never rewrite authoritative fields.

### Noncritical background work
Noncritical jobs may be delayed or paused and resumed after recovery. Critical auction-finalization workers are excluded.

### Realtime presentation
Nonessential event detail may be reduced. A sequence gap or reconnect still requires an authoritative state refetch. Realtime presentation never becomes authoritative and may not invent bid or winner state.

### Optional notifications
Noncritical notifications may be delayed. Security notifications and critical auction-result notifications are excluded from this optional class.

## States

- **normal** — full policy-enabled experience;
- **constrained** — reduce optional work while preserving the core;
- **degraded** — authoritative core remains available with reduced non-authoritative experience;
- **recovery** — restore optional capability progressively after health evidence.

The policy forbids silent degradation. A decision must identify the affected capability and trigger evidence.

## Activation

Signals may come from:

- SYSTEM 27.08 error-budget state;
- SYSTEM 27.09 latency/timeout budgets;
- SYSTEM 27.10 retry behavior;
- SYSTEM 27.11 capacity model.

Capacity thresholds alone do not authorize traffic dropping. Traffic dropping/admission control belongs to SYSTEM 27.13.

Automatic activation requires separately verified runtime implementation. SYSTEM 27.12 itself does not claim that runtime automation exists.

## Recovery

Recovery is evidence-based, not timer-only:

- the trigger condition must clear;
- relevant health evidence must be present;
- optional capabilities return progressively;
- anti-flapping behavior is required in runtime implementations.

Protected capabilities are never intentionally degraded, so there is no “restore protected correctness later” mode.

## Ownership boundary

SYSTEM 27.12 owns graceful reduction of optional capability.

- load shedding/admission control: SYSTEM 27.13;
- scaling operational procedure: SYSTEM 27.14;
- capacity certification: SYSTEM 27.11.

## Acceptance

GREEN requires the fail-closed verifier and negative self-tests, package/pre-gate wiring, exact-head CI/security/build checks, READY exact-head Vercel preview, merge to main, and post-merge descendant verification.
