# 24.01 — OpenAPI / API specification

## Goal

Maintain one machine-readable OpenAPI contract for the HTTP routes that are actually implemented in the Enchev Auctions repository.

## Canonical artifact

- `packages/contracts/openapi/enchev-api.v1.json`
- OpenAPI version: **3.1.0**
- JSON Schema dialect: **2020-12**

The specification is intentionally descriptive of the current route surface. It does not predeclare future endpoints.

## Current HTTP inventory

The verifier derives the implemented inventory directly from `app/api/**/route.ts` and requires an exact path/method match.

Current documented paths:

- `GET /api/health/api`
- `GET /api/health/realtime`
- `GET /api/health/redis-env`
- `GET /api/health/redis`
- `GET /api/health/vercel-oidc-management`
- `GET /api/health/web`
- `GET /api/health/worker`
- `GET /api/live-auction-clock`
- `POST /api/live-auction-clock`

The live-auction-clock endpoint is explicitly documented as a non-authoritative browser-session demo. Its response schema fixes `auctionAuthority=false`, and the POST operation is not the authoritative bid path.

## Invariants

`scripts/verify-openapi-api-specification.mjs` fails when:

1. the OpenAPI version is not 3.1.0;
2. an implemented route is missing from the specification;
3. the specification invents a route that is not implemented;
4. an implemented HTTP method is missing or an extra method is documented;
5. an operation lacks a unique `operationId`;
6. an operation lacks responses;
7. the demo auction-authority boundary is weakened;
8. secret-like credentials are embedded in the specification.

Negative self-tests exercise each important rejection path.

## Boundaries

24.01 defines the HTTP API specification only.

It does not complete:
- 24.02 API versioning strategy;
- 24.03 request/response runtime schema validation;
- 24.04 standard error envelope;
- authentication/authorization policy for future business endpoints;
- WebSocket contracts;
- provider contracts;
- authoritative auction bidding.

No Vercel deployment or provider mutation is required for this task.

## GREEN gate

24.01 is GREEN only after the dedicated verifier and negative self-tests pass, aggregate CI passes, TypeScript passes, production build passes, built health smoke passes, and existing Chrome/Edge visual regression remains green.
