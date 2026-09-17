# Enchev Auctions — 32.01 Master task IDs immutable

Status: YELLOW — implementation on main; final main verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.01`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: Phase 00 governance baseline

## Contract

The semantic identity of every frozen master task is immutable. A frozen task ID may not silently change meaning because another task was inserted, deleted, reordered or reused.

The tracker currently derives task IDs from phase ID plus ordinal position. That means position alone is not a sufficient immutability guarantee. This task adds a machine-enforced identity lock over the complete canonical mapping:

`task ID → phase title → task label`

The lock covers all 1054 frozen master tasks currently present in `MasterSystemPlanV1.tsx`.

New discoveries must not be inserted into the frozen task arrays. They belong in the append-only GAP namespace governed by later Phase 32 tasks.

## Implementation

- `scripts/verify-master-task-ids.mjs` extracts the frozen raw plan from `app/components/MasterSystemPlanV1.tsx`.
- It reconstructs every task ID exactly as the tracker currently does.
- It rejects duplicate IDs.
- It canonicalizes `ID|phase|label` for every frozen task.
- It verifies both the frozen task count and SHA-256 fingerprint.
- `.github/workflows/verify-enchev-web.yml` runs this check before TypeScript and production build.
- Any silent insert/delete/reorder/reuse or semantic reassignment changes the fingerprint and fails CI.

Canonical baseline:

- task count: `1054`
- SHA-256: `b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e`

## Verification already performed on isolated PR path

Negative test:

- GitHub Actions run `35182487279`
- placeholder baseline intentionally mismatched
- observed actual count `1054`
- observed actual SHA-256 `b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e`
- `Frozen master task ID lock` failed as designed
- later TypeScript/build steps were skipped after the governance guard rejected the mismatch

Positive test:

- GitHub Actions run `35182541562`
- canonical baseline locked
- `Frozen master task ID lock` PASS
- TypeScript PASS
- production build PASS
- overall workflow conclusion SUCCESS

## Main implementation commits

- ID lock script: `19298b8165922fae0e18f5d971104a474aa7877a`
- CI integration: `d05c2e6a0da4fab2e637eb0632a38fc845d45ea4`

## GREEN gate

`32.01` becomes GREEN only after a main/descendant CI run proves the ID lock + TypeScript + production build PASS, production HTTP/runtime regression context is healthy, and exact evidence is recorded.

No pricing/payment/finance scope is added by this task.
