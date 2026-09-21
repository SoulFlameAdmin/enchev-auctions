# 26.05 — Production approval gate

Status: **YELLOW** until the repository gate is merged and exact-head CI passes. This task defines the approval boundary; it does not perform a production deployment.

## Contract

- Production release approval is fail-closed.
- The source must be an exact commit SHA.
- Pull-request events cannot themselves count as production approval.
- Explicit human approval metadata is required: approval ID and approver identity.
- Implicit approval, automatic promotion and approval-by-successful-build are forbidden.
- Verify Enchev Web, database migration gate, build provenance, secret scan, code scan and SBOM are mandatory preconditions.
- Any later Vercel production deployment remains forbidden until the global Supabase lease is granted for ENCHEV_SYSTEM / enchev-auctions.

## Automated verification

`scripts/verify-production-approval-gate.mjs` verifies the 26.05 policy and runs negative self-tests against weakened variants.

## GREEN evidence required

1. Dedicated 26.05 verifier PASS.
2. Negative self-tests PASS.
3. Exact-head GitHub Actions PASS with aggregate tests, TypeScript and production build.
4. Merge to main and post-merge verification evidence.

A real production deployment is not required to mark the approval mechanism implemented; any actual deployment remains governed by the separate deployment concurrency and lease rules.
