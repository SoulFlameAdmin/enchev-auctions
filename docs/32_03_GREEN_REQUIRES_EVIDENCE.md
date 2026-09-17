# Enchev Auctions — 32.03 GREEN requires evidence

Status: GREEN — GREEN without evidence is machine-rejected and verified
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

`app/components/MasterSystemPlanV1.tsx` contains the runtime GREEN gate:

- GREEN reads evidence from the task note or the built-in `VERIFIED_EVIDENCE` registry;
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

## Verified evidence

Implementation:

- GREEN evidence guard script commit: `49f831a9c1fed32895b9a4e286e7f57d09aa0617`
- CI integration commit: `f90b9a9da47ac579496c61acfdb1ba8d130052e4`
- governance artifact implementation commit: `ec148a5ada1f393cbc4f6620718bb8c55c79b2fa`

Verification:

- GitHub Actions run `35183337380` on exact artifact commit `ec148a5ada1f393cbc4f6620718bb8c55c79b2fa`: overall `SUCCESS`;
- `Frozen master task ID lock`: PASS;
- `Frozen delete/renumber rejection tests`: PASS;
- `GREEN evidence invariant`: PASS;
- `GREEN evidence rejection tests`: PASS;
- TypeScript check: PASS;
- production build: PASS;
- Vercel canonical production URL `https://enchev-auctions.vercel.app/`: HTTP `200`;
- Vercel runtime error check for the recent production window: no runtime errors found.

## Acceptance result

All `32.03` acceptance requirements are satisfied. A governed GREEN state now has both runtime enforcement and CI regression protection requiring non-empty evidence.

No pricing/payment/finance scope is added by this task.
