# 24.03 — Request/response schema validation

Status: **YELLOW** until exact-head CI and post-merge main verification pass.

## Runtime implementation

The transport-neutral `@enchev/contracts` package now owns executable validators for the schemas already published in the canonical OpenAPI v1 contract.

Validated response boundaries:
- component health responses used by web/API/realtime/worker health routes;
- Redis binding health responses;
- Redis environment-key inventory responses;
- live-auction demo clock success responses;
- live-auction API error envelopes.

Validated request boundary:
- `POST /api/live-auction-clock` accepts only the documented JSON object `{"action":"bid"}`; arrays, missing/unknown actions and additional properties are rejected.

The runtime uses fail-closed `assertContractResponse` checks before sending covered response bodies. Validation failure raises an internal contract error rather than silently serving a shape that diverges from the documented schema.

## Authority boundary

These validators protect API shape only. They do not make the demo live-auction endpoint authoritative and do not alter the frozen invariant that PostgreSQL is authoritative for auction state, accepted bids, winner selection and final results.

## Verification

`scripts/verify-request-response-schema-validation.mjs` checks:
1. runtime validator behavior with positive and negative cases;
2. current OpenAPI schema constraints used by the validators;
3. runtime wiring of health, Redis and live-auction routes;
4. fail-closed response assertions;
5. rejection of unknown request fields and invalid response shapes.

## GREEN evidence required

- dedicated 24.03 verifier and negative self-tests PASS;
- aggregate repository CI, TypeScript and production build PASS;
- exact-head security/supply-chain checks PASS;
- merged main descendant with post-merge verification PASS.
