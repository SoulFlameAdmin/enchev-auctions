# SYSTEM 40.11–40.15 — Production failure certification

These five drills extend Phase 40 with deterministic CI simulations for event duplication, ordering, projection freshness and clock authority. They do not mutate live production, inject faults into real providers or use real customer data.

Coverage:
- 40.11 duplicate event delivery
- 40.12 out-of-order event delivery
- 40.13 sequence-gap recovery
- 40.14 stale-cache recovery
- 40.15 clock-skew simulation

Required behavior:
- duplicate delivery is idempotent: one logical event causes one logical mutation
- out-of-order projection events are rejected and force authoritative resynchronization
- sequence gaps freeze unsafe client projection until authoritative state is fetched
- stale cache is never treated as auction authority and must be rebuilt from source of truth
- server time alone decides whether bidding is open; client clock disagreement cannot extend or close an auction
- accepted-bid history and the winner fixture remain unchanged through all five drills

Run `node scripts/verify-production-failure-certification-40-11-15.mjs --self-test`.
