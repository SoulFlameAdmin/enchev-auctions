# ENCHEV AUCTIONS — MASTER SYSTEM PLAN v1.0 FROZEN

Status: FROZEN baseline

Purpose: one permanent technical source-of-truth for building Enchev Auctions from the current repo to a production, international, realtime vehicle-auction platform.

## Immutable governance

- Existing task IDs are never silently renumbered, reused, or deleted.
- Status means: RED = missing; YELLOW = partial/error/pending proof; GREEN = implemented, verified, and backed by evidence.
- New discoveries after freeze are append-only as GAP items.
- Phase numbers are taxonomy IDs, not build order.
- The real build order is the Execution Wave model displayed in the Command Center.
- FINAL SYSTEM ACCEPTANCE (Phase 47) is blocked until every other system point is GREEN.

## Execution waves

0. Definition & governance
1. Engineering foundation & cross-cutting design
2. Core data & reliability infrastructure
3. Identity, security & compliance foundations
4. Vehicle, seller & physical domain
5. Authoritative auction core
6. Realtime, events & communications
7. Product, admin, search & trust surfaces
8. International, accessibility & frontend proof
9. Hardening, security & load certification
10. SLO, operations & recovery certification
11. Closed pre-production pilot
12. Production readiness & closed production pilot
13. Controlled public launch
14. International production expansion & advanced features
15. Final system acceptance

## Non-negotiable auction invariants

1. PostgreSQL is the authoritative source of truth for auction state, accepted bids and final results.
2. Browser state, WebSocket messages, Redis Pub/Sub, search indexes and AI output are never authoritative for winner selection.
3. Bid acceptance is atomic and validates auction state, eligibility, ordering and increments inside the authoritative transaction.
4. Accepted bids are append-oriented and deterministically ordered.
5. Max/proxy bids are private and ties resolve by a documented deterministic rule.
6. Server time is authoritative. Browser clocks never decide whether a bid is on time.
7. Closing/finalization is retry-safe and logically exactly-once.
8. Every active hot auction has a single authoritative write owner/path; no split-brain winner decisions.
9. Realtime clients recover through sequence-gap detection and authoritative resync.
10. Transactional outbox + idempotent consumers protect critical state/event consistency.
11. Critical admin overrides are auditable; highest-risk result changes use maker-checker / dual control.
12. Country expansion must not require rewriting the auction core.

## Standards/research baseline used for the freeze audit

- Google SRE launch/readiness practices: architecture, capacity, dependencies, failure behavior, monitoring, rollout and recovery.
- OWASP ASVS 5.0.0 for application security verification.
- OWASP API Security Top 10 for API authorization, authentication, resource abuse, SSRF, inventory and third-party API risks.
- NIST SP 800-63-4 for modern identity assurance, authenticator and recovery considerations.
- SLSA 1.2 for provenance and software-supply-chain trust.
- CloudEvents concepts for a canonical event envelope and interoperable event metadata.
- W3C WCAG 2.2 and W3C Internationalization guidance for accessibility and multilingual/multiscript correctness.
- PostgreSQL transaction/isolation principles for concurrency correctness.
- Redis delivery-semantics awareness: Pub/Sub is transport, not system of record.
- EU privacy/marketplace/accessibility obligations are handled through applicability gates per launch country; legal sign-off is required before activation.

## Evidence model

Every GREEN item should point to at least one real artifact where applicable:

- commit SHA / pull request
- CI test run
- deployment URL
- automated test report
- load/chaos report
- security scan / penetration-test report
- restore/failover drill evidence
- provider sandbox/production verification
- legal/compliance approval record
- production telemetry screenshot/report

A file existing is not enough to mark a function GREEN.

## Failure rule

Any critical production incident, concurrency bug, security finding, data-integrity defect, missed recovery case or internationalization failure that is not already represented in the frozen plan becomes a new append-only GAP item plus a regression test.
