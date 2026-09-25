# SYSTEM 27.12 — Graceful degradation rules

Status: **GREEN** — graceful-degradation policy, fail-closed verification, exact-head CI, merge, READY preview, and post-merge descendant verification are complete.

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

## GREEN evidence

- Implementation exact-head commit: `72a0b0e6131019347f63b1b4c6271dbd9320d8f3`.
- Implementation PR #262 merged to `main` as `ea05bb9b0f143b4d57bc58b0822e54b433f61fb5`.
- Exact-head Verify Enchev Web run `36109605849`: SUCCESS; SYSTEM pre-gates including the 27.12 fail-closed verifier/self-tests, aggregate CI suite, TypeScript, production build, built health smoke, Chrome/Edge visual regression, and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36109605908`, Secret Scan `36109605893`, SBOM Generation `36109605869`, Build Provenance `36109605836`, SYSTEM 26.05 `36109605844`, SYSTEM 24.02 `36109605871`.
- Exact-head Vercel Preview `dpl_HfW4WCRT8pvC3ALStq6j5pABz5Au` for commit `72a0b0e6131019347f63b1b4c6271dbd9320d8f3`: READY.
- This evidence branch is based directly on merged `main` commit `ea05bb9b0f143b4d57bc58b0822e54b433f61fb5`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Protected auction capabilities remain fail-closed and may not be approximated during degradation.
- Traffic dropping/admission control remains owned by SYSTEM 27.13; scaling operational procedure remains SYSTEM 27.14.
- The task does not claim automatic production activation of degradation states.
- PostgreSQL remains authoritative; degradation policy cannot manufacture accepted bids, winners, or final auction state.
