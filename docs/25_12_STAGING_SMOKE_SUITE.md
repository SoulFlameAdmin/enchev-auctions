# 25.12 — Staging smoke suite

## Goal

Verify the real Enchev Auctions staging tier with a read-only, fail-closed smoke suite.

## Staging definition

Task 01.07 defines staging as a Vercel Preview from a non-main branch. Production and localhost do not count as staging evidence.

## Coverage

The suite checks the declared health contract for web, API, realtime and worker, plus these critical pages:

- /
- /inventory
- /lot/EA-10539
- /live-auctions
- /profile

Web and API must report healthy. Realtime and worker must match their current declared service-pending contract until their owning tasks change that contract.

## Safety and acceptance

Only GET requests are used. Redirects are rejected. No mutation endpoint is called.

The verifier is:

`node scripts/verify-staging-smoke-suite-ci.mjs`

The live staging run is:

`node scripts/verify-staging-smoke-suite-ci.mjs --live <preview-url>`

GREEN requires exact-head CI PASS plus a real Vercel Preview tied to the implementation commit with every live smoke check passing.

Production smoke coverage remains owned by 25.13.
