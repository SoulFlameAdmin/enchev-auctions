# DAVID Stage 8 — Controlled Self-Upgrade

Stage 8 is complete at the isolated architecture/code layer.

Flow:

`weakness detection → upgrade proposal → sandbox candidate → automatic test matrix → benchmark gate → promotion plan → post-promotion observation → keep or rollback`

## 8.3 Candidate Builder
Creates candidate-only change packages and blocks protected runtime paths.

## 8.4 Automatic Test Matrix
Requires unit, integration, regression and benchmark checks; adds safety checks for elevated-risk changes.

## 8.5 Promotion Observation / Auto-Rollback
A promoted revision is observed against its baseline. Success-rate, failure-rate, integrity or critical regressions trigger rollback planning.

## Hard constraints
- protected DAVID runtime files are not self-modified;
- no promotion without backup, revisions, artifact hash and PASS benchmark;
- rollback requires a valid backup reference;
- these modules plan/control self-upgrades but do not independently mutate production.

Verification:
- node scripts/verify-david-upgrade-candidate-builder.mjs
- node scripts/verify-david-upgrade-test-matrix.mjs
- node scripts/verify-david-post-promotion-observer.mjs
- node scripts/verify-david-stage-8-integration.mjs
