# SYSTEM 42.14–42.20 — capacity certification wave

This wave extends the production-like performance certification beyond burst and latency tests.

## 42.14 Long-duration soak

The certification keeps the built Next.js server live for at least 600 seconds while sending authoritative bid traffic at a fixed rate. Every request uses a fresh auction and bidder so success is unambiguous. The run fails on any network error, non-success response, health failure, duplicate sequence, shortened duration, or authoritative row-count drift.

## 42.15 Memory-leak observation

The same soak samples the actual Next.js Node process RSS and CPU every five seconds. It compares the early and late RSS medians and fails on large sustained growth or an excessive peak. This is an observation gate, not a claim that all future workloads are leak-free.

## 42.16 CPU saturation behavior

The runner is placed under controlled CPU pressure with busy-loop worker processes while bid and health traffic continues. The service must preserve accepted bid integrity, maintain at least 95% health-probe success during pressure, and recover health after pressure is removed.

## 42.17 Horizontal-scale test

Two independent Next.js API processes share the same PostgreSQL authority. One hundred auctions execute five ascending bids each, distributed across both API instances. Both instances must carry traffic and all accepted sequences must remain authoritative in PostgreSQL.

## 42.18 Load-shedding behavior

`POST /api/bids` supports an explicit per-instance in-flight admission limit via `ENCHEV_BID_ADMISSION_MAX_INFLIGHT`. It is disabled unless configured. When active, overload is rejected before authentication/RPC mutation with HTTP 503, an `OVERLOADED_RETRYABLE` error envelope and `X-Enchev-Load-Shed: capacity`. No `Retry-After` is invented. The certification deliberately holds the local RPC gateway so a burst exceeds the configured limit and proves that shed requests create no accepted bid or auction mutation.

## 42.19 No data/winner corruption at certified load

After horizontal bid load, every auction is finalized through `public.enchev_finalize_auction`. The evidence fails on duplicate sequences, missing finalizations, winner mismatch, auction/finalization disagreement, or any accepted-row count drift.

## 42.20 Launch capacity limit

The repository documents a deliberately conservative pre-production capacity envelope below the certified local limits. Production launch remains **not approved** until the dedicated auction database is live-certified, production WebSocket session authorization is integrated, and SYSTEM 41.20–41.21 security blockers are closed.

The certification workflow is `.github/workflows/system-42-capacity-wave.yml` and archives the evidence for 90 days.
