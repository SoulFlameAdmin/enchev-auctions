# SYSTEM 24.09 — API endpoint inventory

Task: **24.09 API endpoint inventory**

Status: **GREEN** — implementation, exact-head CI, merge, and post-merge `main` verification passed.

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

## GREEN evidence

- Implementation PR: #181.
- Exact implementation head: `090aa2781b9f22f217221b4ea7671654b0e9e7d6`.
- Exact-head GitHub Actions PASS: Verify Enchev Web `35628600759`; Code Scan `35628600760`; Secret Scan `35628600774`; SBOM Generation `35628600937`; Build Provenance `35628600818`; SYSTEM 24.02 `35628600791`; SYSTEM 26.05 `35628600797`.
- Merged to `main` as `834b4aad4094b8284f7b5ad14e7b1cde2c8be3ae`.
- Post-merge `main` PASS: Verify Enchev Web `35629537679`; Code Scan `35629537631`; Secret Scan `35629537659`; SBOM Generation `35629537730`; Build Provenance `35629537651`.
- The aggregate Verify Enchev Web job completed successfully after lint/test/typecheck/build and Chrome/Edge visual-regression execution.
- Vercel preview was externally blocked by the free-tier deployment quota; no manual Vercel create/update/redeploy was required or performed for this repository contract task.

## Acceptance

The canonical inventory, exact OpenAPI parity, exact implemented-route parity, fail-closed negative cases, aggregate pre-gate wiring, exact-head CI, merge, post-merge verification, and concrete evidence recording satisfy SYSTEM 24.09.
