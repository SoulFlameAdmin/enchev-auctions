# SYSTEM 27.02 — API availability SLI

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define one stable API-availability indicator over the canonical SYSTEM 24.09 endpoint inventory without inventing an SLO target. Actual SLO percentages remain owned by SYSTEM 27.07.

## Indicator

The API availability ratio is:

- numerator: eligible API requests that receive a contract-classified response without server-side unavailability;
- denominator: all eligible API requests after ingress validation.

Unknown outcomes fail closed as bad availability events.

## Classification

A contract-valid business rejection does not mean that the API was unavailable. Contract-classified 4xx outcomes therefore count as available. A valid SYSTEM 24.08 429 also counts as available transport behavior, while its frequency remains a capacity/backpressure concern.

5xx responses, network failures after admission, server-side timeouts, response timeouts, malformed/unclassifiable responses and unknown outcomes count as bad availability events.

Malformed requests rejected before ingress eligibility and client cancellations before a response are excluded from the denominator. Synthetic traffic remains measurable and is not silently removed.

## Scope and authority

The endpoint scope is derived from `config/enchev-api-endpoint-inventory.json`; 27.02 does not maintain a second endpoint registry.

Telemetry is observational only. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Privacy

Required dimensions are environment, operation ID, method and outcome. PII, raw credential data and request-body capture are forbidden.

## GREEN evidence

- Implementation exact-head commit: `fb07ffccc7af1cbad9ca409904859e187a016564`.
- Implementation PR #240 merged to `main` as `ab10f0dcd6944eb9b329488a3d4e44586f0b49e6`.
- Exact-head Verify Enchev Web run `36010931042`: SUCCESS; aggregate CI test suite (including 27.02 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36010931097`, Secret Scan `36010931112`, SBOM Generation `36010931040`, Build Provenance `36010931179`, SYSTEM 26.05 `36010931158`, SYSTEM 24.02 `36010931099`.
- Exact-head Vercel Preview `dpl_CZK6gj2VNcgpd2sutXiMCGFhio1Z` for commit `fb07ffccc7af1cbad9ca409904859e187a016564`: READY.
- This evidence commit is based directly on merged `main` commit `ab10f0dcd6944eb9b329488a3d4e44586f0b49e6`; its exact-head CI provides the required post-merge descendant verification before the evidence PR is merged.
- No SLO target percentage was invented; target ownership remains SYSTEM 27.07.
- PostgreSQL remains authoritative; telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
