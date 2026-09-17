# Enchev Auctions — 32.06 RED = not implemented

Status: GREEN — RED semantics are machine-enforced and verified
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

`app/components/MasterSystemPlanV1.tsx` implements the intended RED behavior:

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
- governance artifact: `f698956b8972469f9c2184f8a869728715a19a85`

## Verified evidence

- GitHub Actions run `35213784067`: overall `SUCCESS` on exact artifact commit `f698956b8972469f9c2184f8a869728715a19a85`;
- frozen task ID lock: PASS;
- delete/renumber/reuse rejection tests: PASS;
- GREEN evidence invariant/self-test: PASS;
- GREEN passing-test invariant/self-test: PASS;
- YELLOW semantics invariant/self-test: PASS;
- RED semantics invariant: PASS;
- RED semantics self-tests: PASS for 7 state cases;
- TypeScript check: PASS;
- production build: PASS;
- production regression baseline `20a0e261468c158cb3dabadbf0e283c4e7e3b2e0` is deployed as Vercel `dpl_FDjFFdjtAcmamNEJCDTYuftgJa35` READY;
- that Vercel build compiled successfully, completed TypeScript, and generated static pages `9/9`;
- canonical production URL `https://enchev-auctions.vercel.app/`: HTTP `200`;
- Vercel runtime error check for the recent one-hour window: no runtime errors found.

## Acceptance result

All `32.06` acceptance requirements are satisfied. RED remains machine-checked as not implemented/missing, YELLOW remains partial/error/pending verification, and GREEN remains verified completion.

No pricing/payment/finance scope is added by this task.
