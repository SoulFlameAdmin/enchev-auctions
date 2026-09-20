# 26.14 — Environment-scoped CI secrets

## Goal

Keep credential-bearing CI work outside the pull-request verification job and bind it to a named GitHub Actions environment on trusted main-branch pushes only.

## Contract

- Pull-request-capable `verify-web` must not reference GitHub Actions secret expressions.
- Credential-aware Redis/provider probes run in a separate `verify-secret-bindings` job.
- `verify-secret-bindings` runs only for a push to `refs/heads/main`.
- The credential-aware job is bound to GitHub Actions environment `ci-verification`.
- The job uses read-only repository contents permission and does not request OIDC.
- The existing cloud-plan sync remains secret-free and uses OIDC instead of repository/environment secret material.
- The verifier inspects only workflow/config source. It never reads, prints, exports, enumerates values, or claims knowledge of secret values.
- Missing optional provider bindings remain explicit skips; no credential is invented and no provider is provisioned by this task.

## Acceptance

26.14 is GREEN only after:

1. the exact pull-request head passes the 26.14 contract verifier and its negative self-tests inside the normal CI suite;
2. the pull-request-capable verification job is proven free of secret references;
3. the merged main commit passes `Verify Enchev Web`, including the trusted environment-scoped secret-binding job; and
4. the source/evidence records identify the exact commit and terminal GitHub Actions run.

GitHub environment configuration or provider credentials that require an external account owner remain explicit external gates. Their values are never evidence and must never be copied into source control.
