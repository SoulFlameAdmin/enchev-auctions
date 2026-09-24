# SYSTEM 27.04 — Realtime delivery latency SLI

Status: **YELLOW** until exact-head CI and post-merge verification pass.

## Purpose

Define one stable server-side latency distribution for delivery of canonical realtime events without inventing an SLO or latency target. SLO target ownership remains SYSTEM 27.07 and latency/timeout budgets remain SYSTEM 27.09.

## Current architecture boundary

The canonical realtime event registry is SYSTEM 24.12 at `config/enchev-websocket-event-registry.json`.

The current `apps/realtime` workspace is still explicitly a service shell and does not claim implemented WebSocket runtime behavior. SYSTEM 27.04 therefore defines measurement semantics only; it does not claim production realtime delivery already exists.

## Indicator

`realtime_delivery_latency_ms` is a server-side distribution.

Start event:

- a valid canonical registry event has been produced from authoritative state/projection logic;
- the event is handed into the realtime delivery layer.

End event:

- the same event is handed by the realtime service to an eligible subscribed connection transport.

Client rendering, browser event handling and client acknowledgements are deliberately excluded. They may become separate end-to-end experience signals, but they are not mixed into this server delivery SLI.

Events with no eligible subscriber are excluded from the latency distribution. Failed or unknown delivery attempts are not converted into fake latency samples; they remain failures for higher-level delivery/reliability indicators.

## Sequence and resync

SYSTEM 24.12 remains authoritative for realtime envelope and sequence semantics. A sequence gap must trigger authoritative resync and cannot produce a normal delivery-latency sample. Duplicate delivery cannot create a second latency sample.

## Clock requirements

Duration math requires a monotonic server-side clock. Client clocks, ISO envelope timestamps and wall-clock ordering are forbidden for latency calculation, and negative durations are invalid.

## Privacy and cardinality

Required metric dimensions are environment, event type and outcome. Correlation IDs may be used for diagnostic joins but cannot be metric dimensions. Auction IDs, connection IDs, user IDs, PII, credentials and raw event payloads are forbidden metric dimensions/capture.

## Authority

Realtime telemetry is observational only. WebSocket/realtime transport never becomes auction authority. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Acceptance

GREEN requires the executable verifier and fail-closed negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge descendant verification. No SLO percentage or latency target is introduced by SYSTEM 27.04.
