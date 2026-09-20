# 26.04 — Staging deployment pipeline

Status: **YELLOW** until a credentialed, lease-authorized staging deployment reaches READY and its health smoke passes.

## Contract

- Staging candidates are built from an exact source SHA only.
- The canonical repository quality gates run before any deployment.
- Vercel deployment is forbidden unless `public.david_claim_vercel_deploy('ENCHEV_SYSTEM','enchev-auctions',source_sha,900)` returns `granted=true`.
- After a grant, the deploy owner must mark the lease as deploying, perform exactly one intended staging deployment, and always call `public.david_release_vercel_deploy` with terminal success/failure detail.
- A Vercel quota/rate-limit response is recorded only when the provider returns a concrete retry time.
- CAPTCHA, MFA, login, billing and missing-provider-credential gates are never bypassed.
- Staging acceptance requires provider state READY and an HTTP-success smoke at `/api/health/web`.

## Current blocker

Trusted main CI evidence shows the environment-scoped `VERCEL_TOKEN` binding is currently empty. This is an external credential blocker, so repository implementation may proceed but GREEN is forbidden until a real lease-authorized staging deployment is observed.

## Automated verification

`scripts/verify-staging-deployment-pipeline.mjs` verifies the policy is fail-closed for exact SHA, lease ownership/project, required lease RPCs, credential gate, READY state and health smoke path. Self-tests prove invalid variants are rejected.

## GREEN evidence required

1. Exact-head GitHub Actions PASS containing the 26.04 verifier and self-tests.
2. Atomic global Vercel lease grant for ENCHEV_SYSTEM / enchev-auctions.
3. Exactly one intended staging deployment reaching READY.
4. `/api/health/web` smoke PASS on the staging URL.
5. Lease release evidence with terminal detail.
