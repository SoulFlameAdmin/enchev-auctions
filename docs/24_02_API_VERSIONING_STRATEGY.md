# 24.02 — API versioning strategy

Status: **GREEN** — implementation is merged and both exact-head and post-merge verification passed.\n\n## GREEN evidence\n\n- Implementation PR: #157, merged to `main` as `2528f1c74e085064e4fb6bfe5f45b0f6dd277689`.\n- Exact PR head: `94ee24b8209cb1544756f3bddbf743416d0d8ab5`.\n- Exact-head GitHub Actions: Verify Enchev Web `35547303461` SUCCESS; Verify SYSTEM 24.02 `35547303464` SUCCESS; SBOM `35547303398` SUCCESS; Secret Scan `35547303466` SUCCESS; Build Provenance `35547303463` SUCCESS; Code Scan `35547303414` SUCCESS.\n- Post-merge `main` verification at `2528f1c74e085064e4fb6bfe5f45b0f6dd277689`: Verify Enchev Web `35548095449` SUCCESS; SBOM `35548095447` SUCCESS; Secret Scan `35548095331` SUCCESS; Build Provenance `35548095334` SUCCESS; Code Scan `35548095355` SUCCESS.\n- Vercel preview reported free-tier deployment quota exhaustion on PR #157. That external preview quota is non-gating for this repository contract task; no manual Vercel create/update/redeploy is part of this evidence sync.

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
