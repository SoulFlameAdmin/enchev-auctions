# SYSTEM 24.05 — Request correlation ID contract

Task: **24.05 Request correlation ID contract**

Status: **GREEN** — exact-head verification, merge, and post-merge `main` verification all passed.

## GREEN evidence

- Implementation PR: #163, exact head `296469b173c48467edfb9e739bba33ebd24d620a`, merged to `main` as `8c22d057e9ed38d8ceb5314ec5c8bfb43656e51a`.
- Exact-head GitHub Actions: Verify Enchev Web `35551204722` SUCCESS; Code Scan `35551204743` SUCCESS; SBOM `35551204725` SUCCESS; Secret Scan `35551204718` SUCCESS; Build Provenance `35551204755` SUCCESS.
- Post-merge `main`: Verify Enchev Web `35551462036` SUCCESS; Code Scan `35551462037` SUCCESS; SBOM `35551462019` SUCCESS; Secret Scan `35551462025` SUCCESS; Build Provenance `35551462021` SUCCESS.
- Post-merge Verify Enchev Web includes aggregate CI, TypeScript, production build, built health smoke, Chrome/Edge visual regression PASS, artifact `10618502793`, Supabase plan-state sync PASS, and secret-binding verification PASS.
- No manual Vercel create/update/redeploy was required or performed for this repository contract task.


## Contract

Every request matched by `/api/:path*` receives one canonical correlation identifier in `X-Request-ID`.

- A valid inbound ID is preserved unchanged.
- Missing or invalid inbound values are replaced with a generated UUID.
- Valid IDs are 1–128 characters and match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.
- The resolved ID is injected into the request passed to the API handler and emitted on the response.
- Invalid client input is never reflected.
- The ID is observability/transport metadata only; it is not an auction authority, idempotency key, identity credential or authorization signal.

## Runtime enforcement

`proxy.ts` applies the contract to every current and future `/api/*` route through one matcher. The shared validator/resolver lives in `packages/contracts/src/http-schema.ts`.

## Specification

The canonical OpenAPI contract declares reusable `X-Request-ID` response metadata and requires it on every documented HTTP response.

## Acceptance

The contract/runtime wiring, positive and negative verifier cases, exact-head aggregate CI/typecheck/build, applicable security/supply-chain checks, merge, post-merge `main` verification, browser matrix, Supabase plan sync, secret-binding verification and concrete evidence recording are satisfied by the evidence above.

No Vercel deployment is required for this contract task.
