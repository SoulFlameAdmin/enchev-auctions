# 26.10 — Secret scanning gate

Status: implemented; GREEN only after exact-head CI and post-merge main CI are terminal PASS.

## Purpose

Frozen SYSTEM task 26.10 requires a fail-closed pull-request and main-branch secret scanning gate.

## Implementation

- GitHub Actions uses the official TruffleHog action pinned to upstream commit `f714bf454f350590f4a24c3ddb1aef02c35bf5b6` (release v3.97.5).
- Checkout uses full history so the scanner can compare the relevant commit range reliably.
- The scan includes verified and unknown findings and passes `--fail`, so detected findings make CI non-zero.
- `scripts/verify-secret-scanning-gate.mjs` verifies that the workflow remains pinned, fail-closed, full-history, and wired on both pull requests and pushes to `main`.
- The verifier has structural negative self-tests that mutate an in-memory workflow contract; it does not embed credential-shaped fixtures.
- The verifier and self-tests are wired into the stable SYSTEM pre-gates.

## Acceptance

26.10 becomes GREEN only when:

1. The structural verifier and negative self-tests pass.
2. The actual TruffleHog scan passes on the exact task head.
3. The complete existing `verify-web` job is terminal PASS on the pull request.
4. Post-merge `main` CI is terminal PASS.

This task does not require enabling GitHub Advanced Security or repository-native secret scanning; the CI gate is independently fail-closed and does not bypass repository permissions.
