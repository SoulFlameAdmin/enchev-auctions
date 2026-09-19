# 24.01 — OpenAPI / API specification

Status: implementation candidate; GREEN is allowed only after fresh CI passes and evidence is synced.

## Goal

Maintain one machine-readable OpenAPI contract for the HTTP routes that actually exist in Enchev Auctions.

Canonical artifact:

`packages/contracts/openapi/enchev-api.v1.json`

## Scope

The specification covers the current Next.js App Router API surface only:

- health endpoints for web, API, realtime, worker, Redis/Valkey, Redis environment discovery and Vercel OIDC management reachability;
- the existing server-issued browser-session live-auction demo clock GET/POST route.

No future auction, identity, payment, seller, buyer, admin or logistics endpoint is invented by this task.

## Authority boundary

OpenAPI is documentation and compatibility metadata. It is never an auction system of record.

The existing master invariant remains unchanged: PostgreSQL is authoritative for auction state, accepted bids, winner selection and final results. The current `/api/live-auction-clock` route remains explicitly non-authoritative demo behavior and is documented with `auctionAuthority=false`.

## Drift prevention

`scripts/verify-openapi-api-specification.mjs`:

1. validates OpenAPI 3.1 and task identity;
2. discovers every `app/api/**/route.ts` file;
3. extracts exported HTTP methods from those route files;
4. requires exact path+method parity with the OpenAPI document;
5. rejects undocumented methods and stale documented operations;
6. requires unique operation IDs and response declarations;
7. rejects a missing authority boundary or an authoritative claim for the demo clock;
8. runs negative self-tests that prove drift is caught.

The verifier is registered in the aggregate CI suite and the main GitHub Actions workflow.

## Versioning boundary

This task creates the initial API specification. API versioning strategy, compatibility policy, error-envelope standardization and schema/contract tests remain separately owned by later 24.xx tasks. This task does not mark them complete.

## Security boundary

The specification describes sanitized health surfaces but does not expose environment values, secrets, provider credentials, cookies or customer data.

No Vercel create/update/redeploy is required for 24.01.
