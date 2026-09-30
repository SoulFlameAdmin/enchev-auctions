# SYSTEM 40.16–40.19 — Production failure certification

This block closes Phase 40 with deterministic CI verification of service restart behavior, aggregate bid-history integrity, aggregate winner integrity, and structured failure-drill evidence capture.

Coverage:
- 40.16 service restart with active rooms
- 40.17 no bid-history corruption after failure
- 40.18 no winner corruption after failure
- 40.19 failure drill evidence captured

Acceptance:
- active rooms cannot resume unsafe bidding after a service restart until clients rejoin and perform authoritative resynchronization
- every simulated Phase 40 failure state preserves the accepted-bid fixture
- every simulated Phase 40 failure state preserves the authoritative winner fixture
- a structured evidence summary must contain all 16 failure-scenario IDs from 40.01 through 40.16 and explicitly prove bid-history and winner integrity
- production mutation, real provider fault injection and real customer data remain forbidden

Run `node scripts/verify-production-failure-certification-40-16-19.mjs --self-test`.
