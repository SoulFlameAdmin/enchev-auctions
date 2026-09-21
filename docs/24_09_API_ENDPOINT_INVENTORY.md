# SYSTEM 24.09 — API endpoint inventory

Task: **24.09 API endpoint inventory**

Status: **YELLOW** — implementation is present on the task branch; GREEN requires applicable PASS CI and concrete merge evidence.

## Inventory contract

The repository now has a deterministic machine-readable endpoint inventory at `config/enchev-api-endpoint-inventory.json`.

Each endpoint records:

- HTTP method;
- canonical `/api/*` path;
- OpenAPI `operationId`;
- human-readable operation summary.

The inventory is descriptive only. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Drift prevention

`scripts/verify-api-endpoint-inventory.mjs` fails closed unless all three views are exactly aligned:

1. the machine-readable inventory;
2. the canonical OpenAPI specification at `packages/contracts/openapi/enchev-api.v1.json`;
3. the HTTP methods actually exported by `app/api/**/route.ts`.

The verifier also rejects duplicate routes, duplicate operation IDs, invalid methods/paths, missing summaries, authority-boundary drift, stale inventory entries and newly implemented routes missing from the inventory.

The self-test is wired into the aggregate SYSTEM pre-gates and package scripts.

## Acceptance still required

GREEN requires the verifier/self-test plus aggregate lint/test/typecheck/build and applicable security/supply-chain checks to PASS on the exact implementation head, followed by merge/post-merge evidence recording. No manual Vercel deployment is required for this repository contract task.
