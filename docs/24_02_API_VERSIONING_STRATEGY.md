# 24.02 — API versioning strategy

Status: **GREEN** — implementation is merged and both exact-head and post-merge verification passed.

## GREEN evidence

- Implementation PR: #157, merged to `main` as `2528f1c74e085064e4fb6bfe5f45b0f6dd277689`.
- Exact PR head: `94ee24b8209cb1544756f3bddbf743416d0d8ab5`.
- Exact-head GitHub Actions: Verify Enchev Web `35547303461` SUCCESS; Verify SYSTEM 24.02 `35547303464` SUCCESS; SBOM `35547303398` SUCCESS; Secret Scan `35547303466` SUCCESS; Build Provenance `35547303463` SUCCESS; Code Scan `35547303414` SUCCESS.
- Post-merge `main` verification at `2528f1c74e085064e4fb6bfe5f45b0f6dd277689`: Verify Enchev Web `35548095449` SUCCESS; SBOM `35548095447` SUCCESS; Secret Scan `35548095331` SUCCESS; Build Provenance `35548095334` SUCCESS; Code Scan `35548095355` SUCCESS.
- Vercel preview reported free-tier deployment quota exhaustion on PR #157. That external preview quota is not used as GREEN evidence for this repository contract task, and no manual Vercel create/update/redeploy is performed by this evidence sync.

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

## Acceptance

The required contract verifier, negative self-tests, exact-head CI/build checks, merge, and post-merge verification are all satisfied by the evidence above.
