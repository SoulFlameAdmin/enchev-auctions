# Enchev Auctions — 32.02 No silent delete / renumber

Status: YELLOW — implementation on main; verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.02`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01 Master task IDs immutable`

## Contract

No frozen MASTER SYSTEM PLAN task may disappear, move to another numeric ID, or have an existing ID silently reused for different meaning.

The rule is stricter than displaying stable-looking IDs in the UI. A change is rejected when it would silently alter the frozen `task ID → phase → task label` identity contract.

Allowed future discoveries are not inserted into or renumbered inside frozen task arrays. They are handled through the append-only GAP mechanism owned by later Phase 32 governance tasks.

## Implementation

`32.01` established the canonical lock for all 1054 frozen tasks. `32.02` adds executable negative proofs to the same CI guard:

- `silent delete` simulation removes one frozen record and must be rejected;
- `silent renumber` simulation moves an existing task to a different numeric ID and must be rejected;
- `ID reuse/duplicate` simulation reuses an existing frozen ID for another task and must be rejected.

Implementation files:

- `scripts/verify-master-task-ids.mjs`
  - normal mode verifies the canonical frozen count/hash and duplicate-free IDs;
  - `--self-test` runs the three forbidden mutations above and fails CI if any mutation is accidentally accepted.
- `.github/workflows/verify-enchev-web.yml`
  - runs the canonical ID lock;
  - runs `Frozen delete/renumber rejection tests`;
  - then runs TypeScript and production build verification.

Canonical identity remains:

- frozen task count: `1054`
- SHA-256: `b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e`

## Acceptance evidence required

`32.02` may become GREEN only when a `main` commit or proven descendant demonstrates all of the following in one CI verification path:

1. canonical frozen ID lock PASS;
2. silent delete rejected by self-test;
3. silent renumber rejected by self-test;
4. ID reuse/duplicate rejected by self-test;
5. TypeScript PASS;
6. production build PASS;
7. production HTTP/runtime regression context remains healthy;
8. exact evidence is recorded before Command Center sync marks `32.02` GREEN.

No pricing/payment/finance scope is added by this task.
