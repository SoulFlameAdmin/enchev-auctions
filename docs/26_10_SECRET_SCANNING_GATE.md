# 26.10 — Secret scanning gate

Status: implemented; GREEN only after exact-head CI and post-merge main CI are terminal PASS.

## Purpose

Frozen SYSTEM task 26.10 requires a fail-closed CI gate that rejects committed high-confidence credentials before merge.

## Implementation

- `scripts/verify-secret-scanning-gate.mjs` scans every tracked text/config/source file returned by `git ls-files`.
- The scanner rejects high-confidence credential families including private keys, AWS access-key IDs, GitHub tokens, Slack tokens, Stripe live secret keys, Google API keys, npm tokens, and suspicious high-risk secret assignments.
- Values are redacted in diagnostics; the gate never prints a complete detected credential.
- Placeholder/example values are explicitly allowed only when they are recognizable non-secret placeholders.
- Oversized and binary-looking files are excluded from text scanning.
- `--self-test` dynamically constructs canary credentials so the repository itself does not contain raw secret fixtures.
- The verifier and its negative tests are executed by the stable SYSTEM pre-gates and by the GitHub Actions `verify-web` job.

## Acceptance

26.10 is GREEN only when all of the following are true:

1. Repository scan passes with zero findings on the exact task head.
2. Negative self-tests prove the gate rejects representative secret families.
3. Existing CI quality gates still pass.
4. Exact-head pull-request CI is terminal PASS.
5. Post-merge `main` CI is terminal PASS.

This gate does not claim that static scanning can detect every possible credential. Provider-native secret scanning may be enabled as defense in depth when repository/account permissions permit it; it is not required for this task's deterministic fail-closed CI acceptance.
