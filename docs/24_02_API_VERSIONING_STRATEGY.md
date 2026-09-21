# 24.02 — API versioning strategy

Status: **YELLOW** until the repository contract is merged and exact-head CI passes.

## Strategy

- The canonical contract series is **v1**, stored at `packages/contracts/openapi/enchev-api.v1.json`.
- The current API is explicitly **pre-stable** and keeps the existing `/api` transport namespace while the contract matures.
- The current OpenAPI `info.version` remains `0.1.0`; this does not claim a stable public v1 launch.
- When a stable public major is activated, its transport namespace is `/api/v{major}`.
- Compatible additive changes may remain in the same stable major.
- Breaking stable-public changes require a new major contract and namespace.
- Deprecations must be explicit and auditable before a stable-public operation is retired.
- Version metadata never changes the system authority boundary: PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Automated verification

`scripts/verify-api-versioning-strategy.mjs` verifies the frozen 24.02 policy against the canonical OpenAPI file and runs negative self-tests.

## GREEN evidence required

1. 24.02 contract verifier PASS.
2. Negative self-tests PASS.
3. Exact-head GitHub Actions PASS with aggregate CI, TypeScript and production build.
4. Merge to main and post-merge verification.
