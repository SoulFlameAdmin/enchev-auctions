# SYSTEM 27.05 — Reconnect success SLI

Status: **YELLOW** until exact-head CI and post-merge verification pass.

## Purpose

Define a fail-closed reconnect-success indicator for realtime clients without inventing an SLO target or retry budget. SLO target ownership remains SYSTEM 27.07 and retry-budget ownership remains SYSTEM 27.10.

## Current architecture boundary

The canonical realtime envelope/sequence/resync contract is SYSTEM 24.12 at `config/enchev-websocket-event-registry.json`.

The current `apps/realtime` workspace remains a service shell and does not claim production WebSocket runtime behavior. SYSTEM 27.05 therefore defines measurement semantics only.

## Indicator

`reconnect_success_ratio` measures eligible reconnect attempts after an unexpected eligible disconnect.

A reconnect counts as **success** only when all of the following are true:

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

## Acceptance

GREEN requires executable verifier and negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge descendant verification. No SLO target or retry budget is introduced by SYSTEM 27.05.
