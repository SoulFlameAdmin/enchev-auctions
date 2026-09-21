# 24.03 — Request/response schema validation

Status: **GREEN** — exact-head verification, merge, and post-merge main verification all passed.

## GREEN evidence

- Implementation PR: #158, exact head `a4510e9ab08ad8197fe5189a7dc33ace9ed1c8cb`, merged to `main` as `2567e3869f551cf3fe339aca1db180b4aeeff78c`.
- Exact-head GitHub Actions: Verify Enchev Web `35548428586` SUCCESS; Code Scan `35548428573` SUCCESS; SBOM `35548428591` SUCCESS; Secret Scan `35548428558` SUCCESS; Build Provenance `35548428545` SUCCESS. The Verify Enchev Web job includes the dedicated 24.03 invariant and negative self-tests, aggregate CI, TypeScript, production build, built health smoke, and Chrome/Edge visual regression.
- Post-merge `main` verification: Verify Enchev Web `35548665348` SUCCESS; Code Scan `35548665356` SUCCESS; SBOM `35548665357` SUCCESS; Secret Scan `35548665372` SUCCESS; Build Provenance `35548665343` SUCCESS. Main-only secret binding verification and Supabase plan-state sync also completed successfully in run `35548665348`.
- The Chrome/Edge matrix in post-merge run `35548665348` captured 30 Chrome + 30 Edge screenshots, passed desktop/mobile matrix checks, and uploaded artifact `10618011797`.
- Vercel preview remained externally blocked by the free-tier deployment quota. The global Supabase deploy lease records retry-after `2026-09-22 00:40:18+00`; no manual Vercel create/update/redeploy was attempted by this evidence sync.

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

## Acceptance

The dedicated verifier and negative self-tests, aggregate CI, TypeScript, production build, security/supply-chain checks, merge, and post-merge verification are all satisfied by the evidence above.
