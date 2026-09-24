# SYSTEM 27.04 — Realtime delivery latency SLI

Status: **GREEN** — the measurement contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define one stable server-side latency distribution for delivery of canonical realtime events without inventing an SLO or latency target. SLO target ownership remains SYSTEM 27.07 and latency/timeout budgets remain SYSTEM 27.09.

## Current architecture boundary

The canonical realtime event registry is SYSTEM 24.12 at `config/enchev-websocket-event-registry.json`.

The current `apps/realtime` workspace is still explicitly a service shell and does not claim implemented WebSocket runtime behavior. SYSTEM 27.04 defines measurement semantics only; it does not claim production realtime delivery already exists.

## Indicator

`realtime_delivery_latency_ms` is a server-side distribution.

Start event:

- a valid canonical registry event has been produced from authoritative state/projection logic;
- the event is handed into the realtime delivery layer.

End event:

- the same event is handed by the realtime service to an eligible subscribed connection transport.

Client rendering, browser event handling and client acknowledgements are deliberately excluded. Events with no eligible subscriber are excluded. Failed or unknown delivery attempts are not converted into fake latency samples.

## Sequence and resync

SYSTEM 24.12 remains authoritative for realtime envelope and sequence semantics. A sequence gap must trigger authoritative resync and cannot produce a normal delivery-latency sample. Duplicate delivery cannot create a second latency sample.

## Clock requirements

Duration math requires a monotonic server-side clock. Client clocks, ISO envelope timestamps and wall-clock ordering are forbidden for latency calculation, and negative durations are invalid.

## Privacy and cardinality

Required metric dimensions are environment, event type and outcome. Correlation IDs may be used for diagnostic joins but cannot be metric dimensions. Auction IDs, connection IDs, user IDs, PII, credentials and raw event payloads are forbidden metric dimensions/capture.

## Authority

Realtime telemetry is observational only. WebSocket/realtime transport never becomes auction authority. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## GREEN evidence

- Implementation exact-head commit: `6a41c2cd9b1fe298135eee827784c13207598b9c`.
- Implementation PR #244 merged to `main` as `40a567f9c612810d201c12ed7d1465c016b2d598`.
- Exact-head Verify Enchev Web run `36020468413`: SUCCESS; aggregate CI test suite (including 27.04 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36020468463`, Secret Scan `36020468648`, SBOM Generation `36020468828`, Build Provenance `36020468554`, SYSTEM 26.05 `36020469053`, SYSTEM 24.02 `36020468322`.
- Exact-head Vercel Preview `dpl_uZH4h5H3PRvX4XPZS5LQrRZG75TB` for commit `6a41c2cd9b1fe298135eee827784c13207598b9c`: READY.
- This evidence branch is based directly on merged `main` commit `40a567f9c612810d201c12ed7d1465c016b2d598`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- No SLO percentage or latency target was invented; ownership remains SYSTEM 27.07 and 27.09.
- Current architecture truth is preserved: `apps/realtime` remains a service shell; 27.04 does not claim production realtime runtime is implemented.
- PostgreSQL remains authoritative; realtime telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
