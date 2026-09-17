# Enchev Auctions — 32.06 RED = not implemented

Status: YELLOW — governance enforcement implemented; verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.06`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`, `32.02`, `32.03`, `32.04`, `32.05`

## Contract

RED means exactly one thing in the Master System Plan: the task is not implemented / missing.

RED must not be used for:

- partial implementation;
- implementation or runtime error after work exists;
- pending or incomplete verification;
- missing GREEN evidence after implementation exists;
- a test that is implemented but has not passed yet.

Those conditions are YELLOW. Implemented and verified work with required evidence is GREEN.

## Runtime/source behavior locked by 32.06

`app/components/MasterSystemPlanV1.tsx` already implements the intended RED behavior:

- frozen tasks with no explicit legacy status default to `red`;
- runtime defaults preserve each task's `defaultStatus`;
- newly created GAP entries start as `red`;
- the RED task explanation is `Още не е построено`;
- the RED KPI is `ЛИПСВА / не е построено`;
- the footer states `RED = липсва`;
- progress is derived only from GREEN count, so RED can never count as completion.

## CI enforcement

Verifier: `scripts/verify-red-semantics.mjs`.

Normal mode locks these invariants:

1. the three-state contract remains `green | yellow | red`;
2. unspecified frozen tasks default to RED;
3. runtime defaults preserve RED rather than silently promoting tasks;
4. new GAP items start RED;
5. RED UI copy continues to mean missing/not built;
6. RED remains excluded from completion progress.

Self-test mode proves the semantic state machine:

- not implemented → RED;
- stray verification metadata without implementation → RED;
- implemented but unverified → YELLOW;
- partial implementation → YELLOW;
- implementation error → YELLOW;
- pending verification → YELLOW;
- implemented + verified → GREEN.

## Implementation commits

- RED semantics verifier: `3ee0bf9705f19726e0d298f94dc049652a4fbe78`
- CI integration: `3c467c8a301661c0862b5d7647b0e63d32deba90`

## GREEN gate

`32.06` becomes GREEN only after a `main` commit or proven descendant has a successful CI path where:

- all prior governance guards PASS;
- RED semantics invariant PASS;
- RED semantics self-tests PASS;
- TypeScript PASS;
- production build PASS;
- production HTTP/runtime regression context is healthy;
- exact evidence is recorded before Command Center sync marks `32.06` GREEN.

No pricing/payment/finance scope is added by this task.
