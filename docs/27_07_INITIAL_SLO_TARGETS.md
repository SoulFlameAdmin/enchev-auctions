# SYSTEM 27.07 — Initial SLO targets

Status: **GREEN** — the target policy, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Set the first explicit SLO policy targets for the SLIs defined in SYSTEM 27.01–27.06.

These are **initial provisional policy objectives**, not claims about measured production performance. They must be reviewed when representative production evidence exists.

## Evaluation window

All targets use a rolling 30-day evaluation window.

If there is insufficient eligible data, the SLO state is `not_evaluable`. Zero traffic must never be treated as automatic compliance.

## Initial targets

| SLI | Initial target |
| --- | --- |
| Inventory discovery journey | 99.5% successful |
| Lot detail journey | 99.5% successful |
| Live auction view journey | 99.5% successful |
| Bid submission journey | 99.9% successful |
| Auction result visibility journey | 99.9% successful |
| API availability | 99.9% available |
| Bid acceptance latency | 99% of eligible accepted-bid samples within the latency budget defined by SYSTEM 27.09 |
| Realtime delivery latency | 99% of eligible samples within the latency budget defined by SYSTEM 27.09 |
| Reconnect success | 99.0% successful |
| Auction finalization success | 99.9% successful |

## Ownership boundaries

SYSTEM 27.07 owns SLO target ratios only.

It does **not** define:
- error-budget response policy — SYSTEM 27.08;
- numeric latency/timeout budgets — SYSTEM 27.09;
- retry budgets — SYSTEM 27.10;
- capacity model — SYSTEM 27.11.

Therefore the latency SLOs define only the required compliance ratio against a future 27.09 budget; no milliseconds are invented here.

## Review rule

These values are deliberately initial. They may be tightened or relaxed only with representative operational evidence and explicit approval. A change to the targets must not rewrite the underlying 27.01–27.06 SLI semantics.

## Authority

PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results. SLO telemetry is observational only.

## GREEN evidence

- Implementation exact-head commit: `3c6cc7916369d52926139c61955b405aae3feffc`.
- Implementation PR #250 merged to `main` as `290fef77b71a50a3f6af6446eed8ee77794b19b8`.
- Exact-head Verify Enchev Web run `36031081682`: SUCCESS on rerun attempt 2; aggregate CI test suite (including 27.07 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36031081898`, Secret Scan `36031081828`, SBOM Generation `36031081738`, Build Provenance `36031081662`, SYSTEM 26.05 `36031081602`, SYSTEM 24.02 `36031081814`.
- Exact-head Vercel Preview `dpl_FjCGqYEaHbfRQXMBUD4vgRTCRdKk` for commit `3c6cc7916369d52926139c61955b405aae3feffc`: READY.
- This evidence branch is based directly on merged `main` commit `290fef77b71a50a3f6af6446eed8ee77794b19b8`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Targets are explicitly initial/provisional policy objectives, not measured production results.
- Numeric latency/timeout budgets remain owned by SYSTEM 27.09; error-budget policy remains SYSTEM 27.08; retry budgets remain SYSTEM 27.10; capacity remains SYSTEM 27.11.
- PostgreSQL remains authoritative and telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
