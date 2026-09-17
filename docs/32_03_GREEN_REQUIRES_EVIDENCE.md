# Enchev Auctions — 32.03 GREEN requires evidence

Status: YELLOW — implementation on main; verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.03`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`, `32.02`

## Contract

No MASTER SYSTEM PLAN task may be treated as GREEN without non-empty evidence tied to that task.

Evidence is part of the state transition, not optional documentation added later. A GREEN transition with missing or whitespace-only evidence must be rejected and represented as YELLOW/pending verification instead.

This applies to:

- manual GREEN transitions in the Command Center;
- default GREEN tasks shipped by the frozen plan;
- verified automatic GREEN synchronization;
- future changes to the governance code enforced by CI.

## Existing runtime behavior verified and locked

`app/components/MasterSystemPlanV1.tsx` already contains the runtime GREEN gate:

- GREEN reads evidence from the task note or the small built-in `VERIFIED_EVIDENCE` registry;
- missing/blank evidence prevents GREEN;
- the attempted status is downgraded to YELLOW;
- a visible blocker explains that evidence is required.

The built-in frozen defaults currently contain four GREEN tasks (`01.01`–`01.04`), and each has a non-empty verified evidence entry.

`app/components/VerifiedPlanEvidenceSync.tsx` writes verified GREEN state together with its evidence note in the same migration path and never overwrites manually touched evidence/blockers.

## CI enforcement added by 32.03

New script:

- `scripts/verify-green-requires-evidence.mjs`

Normal verification mode checks:

1. every frozen default GREEN task has non-empty `VERIFIED_EVIDENCE`;
2. every `VERIFIED_WAVE_0` GREEN mapping has non-empty, non-placeholder evidence;
3. the manual GREEN transition still has the evidence trim/check branch;
4. missing evidence still downgrades the requested GREEN state to YELLOW;
5. the user-visible evidence blocker is still present;
6. verified automatic synchronization still writes GREEN and evidence together.

Self-test mode proves the transition rule with synthetic cases:

- empty evidence + GREEN request → YELLOW;
- whitespace evidence + GREEN request → YELLOW;
- real evidence + GREEN request → GREEN;
- YELLOW/RED are unaffected by the GREEN evidence gate.

CI runs both normal verification and the negative/positive self-test before TypeScript and production build.

## Implementation commits

- GREEN evidence guard script: `49f831a9c1fed32895b9a4e286e7f57d09aa0617`
- CI integration: `f90b9a9da47ac579496c61acfdb1ba8d130052e4`

## GREEN gate

`32.03` becomes GREEN only after a `main` commit or proven descendant has one successful CI path where:

- frozen ID lock PASS;
- delete/renumber rejection tests PASS;
- GREEN evidence invariant PASS;
- GREEN evidence rejection tests PASS;
- TypeScript PASS;
- production build PASS;
- production HTTP/runtime regression context is healthy;
- exact evidence is recorded before Command Center sync marks `32.03` GREEN.

No pricing/payment/finance scope is added by this task.
