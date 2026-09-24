# SYSTEM 27.01 — Critical user-journey SLIs

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define stable service-level indicators for the critical ENCHEV user journeys without inventing SLO targets. Target values are owned by SYSTEM 27.07.

## Critical journeys

The contract measures inventory discovery, lot detail, LIVE auction viewing, bid submission, and auction-result visibility. Each journey has an explicit success condition, failure condition, and a fail-closed successful-journey ratio.

Unknown or ambiguous outcomes count as failures. User-cancelled journeys are excluded from the denominator; synthetic traffic remains measurable rather than silently removed.

## Authority boundary

Telemetry is observational only. PostgreSQL remains authoritative for accepted bids, auction state, winner selection, and final results. SLI collection must never mutate auction state or infer authoritative outcomes from monitoring data.

## Privacy

Required measurement dimensions are environment, journey ID, and outcome. PII and raw credential data are forbidden. Country/browser/device dimensions are optional and must remain non-identifying.

## GREEN evidence

- Implementation exact-head commit: `e371f151a890e917fead60b01b28922ed98da1d8`.
- Implementation PR #238 merged to `main` as `6e32902c645a39e660e76bc7e434f3fa1a5c2291`.
- Exact-head Verify Enchev Web run `36008002214`: SUCCESS; aggregate CI test suite (including the 27.01 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression, and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36008002232`, Secret Scan `36008001993`, SBOM Generation `36008002037`, Build Provenance `36008002178`, SYSTEM 26.05 `36008001992`, and SYSTEM 24.02 `36008002025`.
- Exact-head Vercel Preview `dpl_HHAjQsuHgQMmFMJJwAgSPtbUtvEA` for commit `e371f151a890e917fead60b01b28922ed98da1d8`: READY.
- This evidence commit is based directly on merged `main` commit `6e32902c645a39e660e76bc7e434f3fa1a5c2291`; its exact-head CI is the post-merge descendant verification required before GREEN.
- No SLO target percentage was invented; target ownership remains SYSTEM 27.07.
- PostgreSQL remains the authoritative auction source; telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
