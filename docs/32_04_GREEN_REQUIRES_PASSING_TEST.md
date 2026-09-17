# Enchev Auctions — 32.04 GREEN requires passing test where applicable

Status: YELLOW — implementation and CI verified; production runtime deployment pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.04`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`, `32.02`, `32.03`

## Contract

A task classified as `kind=test` may be GREEN only when its evidence explicitly proves a passing test result.

Evidence presence alone is not sufficient for test tasks. `FAIL`, `ERROR`, `PENDING`, `CANCELLED` or `BLOCKED` evidence cannot satisfy the GREEN gate even when the evidence field is non-empty.

Accepted passing-result markers are explicit `PASS`, `PASSED`, `SUCCESS` or `SUCCEEDED` tokens. This keeps the rule machine-checkable and prevents a test task from becoming GREEN based only on a commit URL, screenshot, plan text or unverified claim.

## Runtime enforcement

Implementation:

- `scripts/generate-master-test-task-ids.mjs`
  - parses the immutable MASTER SYSTEM PLAN raw registry;
  - derives every frozen `kind=test` task ID from the source of truth;
  - generates `app/generated-master-plan-test-ids.ts` before production build.
- `app/components/TestPassGreenGuard.tsx`
  - monitors Command Center state through the existing localStorage/BroadcastChannel path;
  - if a frozen test task is GREEN without passing evidence, it is changed to YELLOW;
  - a blocker states that PASS/SUCCESS evidence is required;
  - editing previously passing evidence into failing/pending evidence also invalidates GREEN.
- `app/layout.tsx`
  - mounts `TestPassGreenGuard` next to verified evidence synchronization.
- `package.json`
  - `prebuild` regenerates the frozen test-task registry before every production build.

## CI enforcement

`scripts/verify-green-requires-passing-test.mjs` verifies:

1. the generated test-task registry exactly matches the FROZEN plan;
2. any default GREEN test task has explicit passing evidence;
3. any verified automatic GREEN mapping for a test task has passing evidence;
4. the runtime guard is mounted and contains downgrade/blocker behavior;
5. production build regenerates the test registry;
6. CI runs both the invariant and rejection/acceptance self-test.

Self-test cases include:

- empty evidence → YELLOW;
- whitespace evidence → YELLOW;
- PENDING → YELLOW;
- FAILED → YELLOW;
- mixed FAILED then PASS → YELLOW;
- PASS → GREEN;
- SUCCESS → GREEN;
- non-test GREEN is not subject to the test-pass gate;
- existing YELLOW/RED states are not promoted automatically.

## Implementation commits

- generated registry builder: `e1f754eb959d0517b0c9193f51741578ff262d33`
- generated registry seed: `70b865246f557710b04b29d26a159de8cc1b4c2c`
- runtime guard: `fa52e2567bc45afabacf4472f00d4e4747e2fd42`
- root layout integration: `53a6f2bdb57201229fc8b401bca9e7079d29a8e0`
- production prebuild integration: `6a04a7a271d1cea605a67b32684bd2c132e67534`
- CI verifier: `3af7b729f8f12dfa0acf230088a93bdf74a6bdb2`
- CI workflow integration: `512dcc7f198bd26da744f6a850420ab202d07bfc`
- governance artifact: `e33d10a20f17910ff25c85fc8269dc9bbe97d197`

## Verified implementation evidence

- verified descendant commit: `3df71f8d66d27d2eeed0602075951dc2ed640e93`, direct child of the governance artifact commit;
- GitHub Actions descendant run `35183833517`: overall `SUCCESS`;
- generated frozen test registry: `236` test task IDs;
- frozen master task ID lock: PASS, `1054` tasks, SHA-256 `b0fd3479cfef3d88148b906568aa8c1c88eccf5fa98fe676f13a5fec70aa721e`;
- delete/renumber/reuse rejection tests: PASS;
- GREEN evidence invariant/self-test: PASS;
- GREEN passing-test invariant: PASS for all `236` frozen test tasks;
- GREEN passing-test self-test: PASS for `10` policy cases;
- TypeScript check: PASS;
- production build: PASS, Next.js `16.3.5`, compile success, TypeScript success, static generation `9/9`;
- final evidence-sync commit `4a0c3648445cf72c7c219d1c1d92d57c82491a72` has GitHub Actions run `35183951638` overall `SUCCESS` with every governance guard, TypeScript and production build PASS.

## Remaining production verification blocker

The canonical production site is healthy (`HTTP 200`; no recent Vercel runtime errors), but the latest Vercel READY production deployment is still older than the `32.04` runtime guard. GitHub combined status for exact integration commit `4a0c3648445cf72c7c219d1c1d92d57c82491a72` reports Vercel `failure` with target `upgradeToPro=build-rate-limit`.

A direct deployment fallback was attempted through the connected Vercel action, but its exposed connector schema accepts no deployment payload while the backend requires `target`, `name`, and `files`, so that path cannot safely deploy the project.

Therefore production runtime enforcement is not yet proven. `32.04` must remain YELLOW and must not be synchronized as GREEN until a READY Vercel production deployment at `fa52e256...` or any proven descendant is verified with build and runtime evidence.

No pricing/payment/finance scope is added by this task.
