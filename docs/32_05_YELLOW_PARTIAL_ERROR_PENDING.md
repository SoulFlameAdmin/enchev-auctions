# Enchev Auctions — 32.05 YELLOW = partial/error/pending verification

Status: YELLOW — governance enforcement implemented; verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.05`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`, `32.02`, `32.03`, `32.04`

## Contract

YELLOW is the only transitional status for a task that is not yet eligible for GREEN but is not simply absent.

A task must be YELLOW when any of these is true:

- implementation is partial;
- an implementation/test/runtime error exists;
- verification is pending or incomplete;
- evidence required for GREEN is missing;
- a `kind=test` task lacks explicit passing-test evidence;
- a blocker exists while some relevant work/evidence already exists.

RED remains reserved for `not implemented`. GREEN remains reserved for implemented and verified work with evidence and, where applicable, passing tests.

YELLOW must never be interpreted as successful completion.

## Existing runtime behavior locked by 32.05

`app/components/MasterSystemPlanV1.tsx` already provides the intended three-state behavior:

- missing GREEN evidence downgrades to YELLOW;
- YELLOW task copy communicates test/error/blocker/missing-evidence state;
- the Command Center footer defines YELLOW as partial/error/missing verification;
- RED remains the explicit missing/not-built state.

`app/components/TestPassGreenGuard.tsx` also downgrades a test task from GREEN to YELLOW when passing-test evidence is absent, failed, pending, cancelled or blocked.

## CI enforcement

New verifier: `scripts/verify-yellow-semantics.mjs`.

Normal mode locks the runtime/source invariants:

1. status contract remains `green | yellow | red`;
2. missing GREEN evidence maps to YELLOW;
3. non-passing test evidence maps to YELLOW;
4. GREEN evidence policy maps unverified GREEN requests to YELLOW;
5. UI explanation still communicates test/error/pending semantics;
6. footer still defines YELLOW as partial/error/missing verification;
7. the YELLOW KPI remains visibly distinct as test/error state.

Self-test mode proves the semantic state machine:

- partial implementation → YELLOW;
- error → YELLOW;
- pending verification → YELLOW;
- implemented but not verified → YELLOW;
- implemented + verified → GREEN;
- not implemented → RED.

CI runs both the invariant and self-test before TypeScript and production build.

## Implementation commits

- YELLOW semantics verifier: `aa6d64dc54b0b5b1fbd6278a673433e86121197e`
- CI integration: `7363c289db2939c80340964f3b1c1f3d89f0b806`

## GREEN gate

`32.05` becomes GREEN only after a `main` commit or proven descendant has a successful CI path where:

- all prior governance guards PASS;
- YELLOW semantics invariant PASS;
- YELLOW semantics self-tests PASS;
- TypeScript PASS;
- production build PASS;
- production HTTP/runtime regression context is healthy;
- exact evidence is recorded before Command Center sync marks `32.05` GREEN.

No pricing/payment/finance scope is added by this task.
