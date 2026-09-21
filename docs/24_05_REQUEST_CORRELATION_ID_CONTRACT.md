# SYSTEM 24.05 — Request correlation ID contract

Task: **24.05 Request correlation ID contract**

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

GREEN requires:
1. contract and runtime wiring present;
2. positive and negative verifier cases PASS;
3. aggregate CI/typecheck/build PASS at the exact implementation head;
4. post-merge main verification PASS;
5. concrete evidence recorded in the SYSTEM tracker.

No Vercel deployment is required for this contract task.
