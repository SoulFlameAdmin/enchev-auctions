# SYSTEM 27.06 — Auction finalization success SLI

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define a fail-closed success indicator for authoritative auction finalization without inventing an SLO target. SLO target ownership remains SYSTEM 27.07.

## Current architecture boundary

SYSTEM 24.12 defines `enchev.auction.closed.v1` as a projection of authoritative finalization state and explicitly keeps PostgreSQL authoritative for accepted bids, winner selection and final results.

The current repository does not yet contain an authoritative production auction-finalization API/worker implementation. SYSTEM 27.06 therefore defines measurement semantics only and does not claim that runtime finalization is already implemented.

## Indicator

`auction_finalization_success_ratio` measures eligible authoritative finalization attempts.

A finalization counts as **success** only when:

- exactly one authoritative terminal auction result is durably committed in PostgreSQL;
- winner outcome is resolved as either one authoritative winner or an explicit closed-without-winner state;
- the committed result is unambiguous and safe for downstream API/realtime projection;
- the result is available to the publication/visibility path used by the critical `auction_result_visibility` journey.

Unknown or timed-out outcomes count as failures.

A realtime `enchev.auction.closed.v1` event by itself is **not** finalization success. It is only a projection of state that must already be authoritative.

## Winner outcome guardrails

Multiple winners and ambiguous winner states are forbidden. Telemetry, browser state and realtime transport may never select or infer the winner.

An auction may legitimately close without a winner when authoritative domain rules produce that terminal state; this must be explicit, not inferred from missing telemetry.

## Eligibility and retries

Authoritative close attempts are eligible. Idempotent worker retries for the same logical finalization are measured as the same logical attempt and must not inflate success counts.

Auctions cancelled before a finalization attempt and non-authoritative browser clock events are excluded. Synthetic finalization attempts remain eligible and may not be silently removed.

## Privacy and cardinality

Required metric dimensions are environment and outcome. Optional dimensions may include region, country profile and finalization path.

Correlation IDs may be used for diagnostic joins but not as metric dimensions. Auction IDs, winner IDs, buyer/seller IDs, PII, credentials and bid amounts are forbidden metric dimensions.

## Authority

PostgreSQL remains authoritative for final auction state, winner selection and final results. Telemetry is observational only and may not mutate auction state.

## GREEN evidence

- Implementation exact-head commit: `4622c7151041ae304b08d6e2e407f4ca459099e0`.
- Implementation PR #248 merged to `main` as `39aa849e289db754181fed92162966c500171cb2`.
- Exact-head Verify Enchev Web run `36026410836`: SUCCESS; aggregate CI test suite (including 27.06 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36026410568`, Secret Scan `36026410670`, SBOM Generation `36026410565`, Build Provenance `36026410639`, SYSTEM 26.05 `36026410779`, SYSTEM 24.02 `36026410607`.
- Exact-head Vercel Preview `dpl_CcFmexGjrp9soUgPmNKDjRPPfdn2` for commit `4622c7151041ae304b08d6e2e407f4ca459099e0`: READY.
- This evidence branch is based directly on merged `main` commit `39aa849e289db754181fed92162966c500171cb2`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- No SLO target was invented; ownership remains SYSTEM 27.07.
- Current architecture truth is preserved: authoritative production auction-finalization runtime is not falsely claimed.
- `enchev.auction.closed.v1` remains a projection only; PostgreSQL remains authoritative for final auction state, winner selection and results.
- Protected DAVID orchestrator files were not modified.
