# SYSTEM 27.05 — Reconnect success SLI

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define a fail-closed reconnect-success indicator for realtime clients without inventing an SLO target or retry budget. SLO target ownership remains SYSTEM 27.07 and retry-budget ownership remains SYSTEM 27.10.

## Current architecture boundary

The canonical realtime envelope/sequence/resync contract is SYSTEM 24.12 at `config/enchev-websocket-event-registry.json`.

The current `apps/realtime` workspace remains a service shell and does not claim production WebSocket runtime behavior. SYSTEM 27.05 defines measurement semantics only.

## Indicator

`reconnect_success_ratio` measures eligible reconnect attempts after an unexpected eligible disconnect.

A reconnect counts as **success** only when:
- transport is re-established;
- the client regains an authoritative baseline through `enchev.auction.snapshot.v1` or an authoritative HTTP/PostgreSQL-backed resync;
- incremental realtime events resume only after that baseline;
- sequence handling is safe under SYSTEM 24.12.

A socket opening by itself is **not** reconnect success. Unknown outcomes and reconnect timeouts count as failures.

Intentional disconnects such as explicit logout, page navigation away or user-requested disconnect are excluded. Synthetic attempts remain eligible and may not be silently removed.

## Sequence and resync

A sequence gap requires resync. `enchev.resync.required.v1` is an instruction to recover state, not evidence that recovery succeeded. Duplicate events cannot create reconnect success.

## Privacy and cardinality

Required dimensions are environment and outcome. Correlation IDs may be used only for diagnostics. Auction IDs, connection IDs, user IDs, PII, credentials and raw event payloads are forbidden metric dimensions/capture.

## Authority

Reconnect telemetry is observational only. Realtime transport never determines accepted bids, winners or final results. PostgreSQL remains authoritative.

## GREEN evidence

- Implementation exact-head commit: `f9b3be19a0cd27408f7bf84259de794fb2abc02f`.
- Implementation PR #246 merged to `main` as `195b9d09b6e0ae85fb21df5cd766f09459130630`.
- Exact-head Verify Enchev Web run `36022906008`: SUCCESS; aggregate CI test suite (including 27.05 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36022906051`, Secret Scan `36022906155`, SBOM Generation `36022906287`, Build Provenance `36022906201`, SYSTEM 26.05 `36022906149`, SYSTEM 24.02 `36022906134`.
- Exact-head Vercel Preview `dpl_7FbARcxc8Sw6aqTZgK3js6NgfbJe` for commit `f9b3be19a0cd27408f7bf84259de794fb2abc02f`: READY.
- This evidence branch is based directly on merged `main` commit `195b9d09b6e0ae85fb21df5cd766f09459130630`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- No SLO target or retry budget was invented; ownership remains SYSTEM 27.07 and 27.10.
- Current architecture truth is preserved: `apps/realtime` remains a service shell.
- PostgreSQL remains authoritative; reconnect telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
