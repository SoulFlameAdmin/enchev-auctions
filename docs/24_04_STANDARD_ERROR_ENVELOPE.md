# 24.04 — Standard error envelope

Status: **YELLOW** — implementation is present; GREEN is forbidden until exact-head CI, merge, and post-merge verification provide concrete evidence.

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
1. the 24.04 contract file and YELLOW-until-evidence state;
2. the exact OpenAPI nested closed-object shape;
3. runtime factory and validator behavior;
4. live route use of the factory plus fail-closed response assertion;
5. positive and negative compatibility cases, including missing fields, empty values and additional properties;
6. the 24.03 regression validator remains wired to the same canonical `ErrorEnvelope`.

## GREEN acceptance

GREEN requires:
- exact-head dedicated 24.04 verifier and self-tests PASS;
- aggregate CI, TypeScript and production build PASS;
- applicable repository security/supply-chain checks PASS;
- merge to `main`;
- post-merge `main` verification PASS;
- evidence recorded without inventing deployment proof.

No Vercel deployment is required by this contract-only task.
