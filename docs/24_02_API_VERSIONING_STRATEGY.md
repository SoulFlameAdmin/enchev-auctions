# 24.02 — API versioning strategy

## Purpose

This task defines how Enchev Auctions evolves the HTTP API without silently breaking clients. It does not create new endpoints and it does not change auction authority.

## Current contract

- The canonical OpenAPI document remains `packages/contracts/openapi/enchev-api.v1.json`.
- Its current contract version is `0.1.0`.
- Implemented routes remain on the existing `/api/...` paths.
- The current routing mode is deliberately **unversioned-current-contract** because the product has not declared a public stable v1 API.

## Compatibility law

Backward-compatible additive changes may stay in the current contract when the OpenAPI verifier proves route/schema parity. Any breaking change must:

1. create a new contract version;
2. include an explicit compatibility/migration plan;
3. include a deprecation window for the replaced contract;
4. fail closed for unsupported explicit versions; and
5. preserve the PostgreSQL auction-authority boundary.

Future breaking major routes use the reserved template `/api/v{major}`. This reservation is a strategy, not an instruction to invent or duplicate endpoints now.

## Boundaries

24.02 does **not**:
- rewrite current routes to `/api/v1`;
- claim a stable public v1 API;
- create provider/payment/finance/tax behavior;
- change bid, winner, timer, or finalization authority;
- perform a Vercel deployment.

## Evidence gate

GREEN requires the dedicated verifier and negative self-tests, aggregate CI, TypeScript check, production build, health smoke, and existing browser regression matrix to pass on the implementation commit.
