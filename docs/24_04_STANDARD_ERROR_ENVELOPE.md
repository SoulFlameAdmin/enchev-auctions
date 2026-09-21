# 24.04 — Standard error envelope

Status: **GREEN** — exact-head verification, merge, and post-merge `main` verification all passed.

## GREEN evidence

- Implementation PR: #160, exact head `4bc121e930377d7afc1b0767fe6ceb9551b6b04f`, merged to `main` as `68be77e7cf0b0721e7b3c3139691adb483774129`.
- Exact-head GitHub Actions: Verify Enchev Web `35549616382` SUCCESS; Code Scan `35549616247` SUCCESS; SBOM `35549616239` SUCCESS; Secret Scan `35549616234` SUCCESS; Build Provenance `35549616293` SUCCESS. Verify Enchev Web includes the dedicated 24.04 verifier/self-test, aggregate CI, TypeScript and production build.
- Post-merge `main` verification: Verify Enchev Web `35549846050` SUCCESS; Code Scan `35549846096` SUCCESS; SBOM `35549846077` SUCCESS; Secret Scan `35549846095` SUCCESS; Build Provenance `35549846080` SUCCESS.
- The Vercel preview for PR #160 was externally blocked by the free-tier daily deployment limit. That provider quota is non-gating for this repository contract task; no manual Vercel create/update/redeploy was attempted.

## Contract

Every covered JSON API error uses one closed top-level object:

```json
{
  "error": {
    "code": "machine-readable-code",
    "message": "User-safe explanation."
  }
}
```

Rules:
- `error.code` is a non-empty machine-readable string.
- `error.message` is a non-empty user-safe string.
- Unknown top-level and nested error properties are rejected.
- Runtime creation goes through `createApiErrorEnvelope`; covered responses are fail-closed through `assertContractResponse`.
- Request correlation identifiers intentionally remain outside this task and belong to frozen task **24.05**.
- Error formatting is transport metadata only. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Current runtime coverage

`POST /api/live-auction-clock` emits the standard envelope for:
- invalid JSON;
- unsupported actions.

The canonical OpenAPI `ErrorEnvelope` schema matches the executable runtime validator.

## Verification

`scripts/verify-standard-error-envelope.mjs` checks:
1. the 24.04 contract file and verified GREEN evidence state;
2. the exact OpenAPI nested closed-object shape;
3. runtime factory and validator behavior;
4. live route use of the factory plus fail-closed response assertion;
5. positive and negative compatibility cases, including missing fields, empty values and additional properties;
6. the 24.03 regression validator remains wired to the same canonical `ErrorEnvelope`.

## Acceptance

The dedicated verifier and self-tests, aggregate CI, TypeScript, production build, applicable security/supply-chain checks, merge, post-merge verification and concrete evidence recording are all satisfied by the evidence above.

No Vercel deployment is required by this contract-only task.
