# Enchev Auctions — 32.02 No silent delete / renumber

Status: GREEN — silent delete, renumber and ID reuse are machine-rejected and verified
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

## Verified evidence

Implementation:

- self-test guard commit: `a28c9b5a168d42d211850c16b18b7c391ad61a56`
- CI self-test integration commit: `43e8cd3573f0acd39f6b38aef85c85ed20fea270`
- governance artifact commit: `1cbae4307417031f2f3e6b6830d1ad1124caf8ec`

Verification:

- exact artifact run `35182978435` executed canonical ID lock PASS, delete/renumber/reuse self-test PASS, TypeScript PASS and production build PASS; overall run was later marked cancelled only because a newer `main` descendant superseded it after all verification steps had completed successfully;
- verified descendant commit: `b816f760fffb7b81b8f9f69e823e6892c244c010` (direct child of `1cbae4307417031f2f3e6b6830d1ad1124caf8ec`);
- GitHub Actions descendant run `35183021075`: overall `SUCCESS`;
- `Frozen master task ID lock`: PASS;
- `Frozen delete/renumber rejection tests`: PASS, proving silent delete, silent renumber and ID reuse/duplicate are rejected;
- TypeScript check: PASS;
- production build: PASS;
- Vercel canonical production URL `https://enchev-auctions.vercel.app/`: HTTP `200`;
- Vercel runtime error check for the recent production window: no runtime errors found.

## Acceptance result

All `32.02` acceptance requirements are satisfied. The frozen plan can no longer silently delete, renumber or reuse an existing task identity without CI rejection.

No pricing/payment/finance scope is added by this task.
