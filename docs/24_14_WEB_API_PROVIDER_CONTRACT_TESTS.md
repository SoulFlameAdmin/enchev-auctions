# SYSTEM 24.14 — Web/API/provider contract tests

Status: **YELLOW** until exact-head CI and post-merge verification pass.

This task verifies the current implemented contract boundaries without inventing provider credentials or live provider integrations.

## Verified surfaces

- implemented `app/api/**/route.ts` HTTP methods match the canonical endpoint inventory;
- inventory operations exist in OpenAPI with matching operation IDs and response contracts;
- `apps/api` remains a single-source bridge to `app/api`;
- the live-auction browser consumer keeps the documented GET/POST request shape and rejects authoritative auction payloads;
- `packages/providers` remains a credential-free adapter boundary until dedicated provider tasks implement real clients.

## Fail-closed tests

The self-test rejects route removal, OpenAPI removal, operation ID drift, API bridge drift, browser POST drift, unverified concrete provider clients, and accidental provider network/credential behavior.

## Commands

```bash
npm run verify:web-api-provider-contract-tests
npm run verify:web-api-provider-contract-tests:self-test
npm test
```

PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.
