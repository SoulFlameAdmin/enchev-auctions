# 25.12 — Staging smoke suite

## Goal

Define and execute a fail-closed smoke suite against the real Enchev Auctions staging tier without treating production or localhost as staging evidence.

## Authoritative staging environment

Task 01.07 defines staging as a **Vercel Preview** deployment from a non-main branch. The smoke suite therefore accepts only an explicit Preview base URL (or `STAGING_BASE_URL`) and never substitutes the canonical production URL.

A Git-triggered Preview deployment is staging evidence. A production deployment, localhost process, or historical Preview from a different implementation commit is not sufficient evidence for GREEN.

## Smoke coverage

The live suite is read-only and checks:

- health contracts for web, API, realtime and worker;
- the five critical browser routes already owned by the cross/mobile browser matrix:
  - `/`
  - `/inventory`
  - `/lot/EA-10539`
  - `/live-auctions`
  - `/profile`

The current health contract intentionally expects web/API to be ready and realtime/worker to report their existing fail-closed `service-pending` state with HTTP 503. The smoke suite verifies the declared contract; it does not falsely upgrade pending services.

## Safety

- GET only;
- redirects rejected;
- no mutation endpoints;
- no secrets printed or committed;
- canonical production URL is rejected as staging input;
- localhost is rejected as staging input;
- exact implementation-commit Preview evidence is required before GREEN.

## CI and live evidence

CI verifies the machine-readable contract, repository integration and negative self-tests. The live smoke runner is:

`node scripts/verify-staging-smoke-suite.mjs --live <preview-url>`

GREEN requires both:

1. exact-head CI PASS for the implementation;
2. a real Vercel Preview tied to that exact implementation commit with all live smoke checks passing.

## Ownership boundary

25.12 does not claim production smoke coverage (25.13), real mobile-device coverage (25.11 final-production target), or readiness for services still explicitly pending under their owning tasks.
