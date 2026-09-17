# Enchev Auctions — 00.05 Non-functional Requirements Documented

Status: YELLOW — NFR contract committed; production verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.05`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01 System scope and boundaries`, `00.02 Actors and permission map`, `00.03 Authoritative components defined`, `00.04 Critical system invariants documented`

This document defines the cross-cutting non-functional requirements that every later Enchev Auctions implementation must satisfy. It is a system engineering contract, not evidence that the production auction engine, identity stack, realtime service, workers, recovery systems or operational certification already exist.

It intentionally does **not** set a customer-facing SLA, legal promise, commercial term, pricing rule or finance requirement. Exact production SLO targets are owned by later frozen tasks in Phase 27 and operational certification waves.

## 1. Priority order

When requirements conflict, the default engineering priority is:

1. auction correctness and data integrity;
2. security and authorization correctness;
3. recoverability and auditability;
4. availability of the authoritative write path;
5. latency and throughput;
6. freshness of derived/read-only projections;
7. convenience features.

A faster or more available system is not acceptable if it can produce an incorrect accepted bid, duplicate logical critical write, unauthorized mutation or competing final result.

## 2. NFR registry

### NFR-01 — Correctness under concurrency
Winner-affecting behavior must remain correct under concurrent bidders, retries, reconnects, worker restarts and same-boundary races. No test may accept split-brain winner state, non-deterministic finalization or duplicated logical critical writes.

### NFR-02 — Atomic authoritative writes
Critical auction mutations must either commit completely or have no authoritative effect. Partial writes, UI-only success states and realtime-only acceptance are forbidden.

### NFR-03 — Deterministic ordering
Accepted bids and winner-affecting events must have deterministic authoritative ordering that is independent of browser clock, client locale, packet arrival order and WebSocket delivery order.

### NFR-04 — Idempotent retries
Every retryable critical command must have a stable deduplication/idempotency strategy so network ambiguity or worker restart cannot create a second logical operation.

### NFR-05 — Fail-closed critical behavior
When authorization, eligibility, rule version, auction state or authoritative transaction outcome cannot be verified, winner-affecting writes must fail closed or recover from authoritative evidence before returning success.

### NFR-06 — Measurable latency
The platform must expose measurable latency for critical user journeys and backend paths, including at minimum bid acceptance, authoritative state reads, realtime delivery, reconnect/resync and finalization. Later SLO tasks must define and certify p50/p95/p99 targets; this task does not invent those numeric production commitments.

### NFR-07 — Capacity is explicit
Every production launch must have a documented capacity model for concurrent bidders, active auctions, realtime connections, database contention, worker throughput and derived-service load. Capacity assumptions must be tested rather than inferred from development traffic.

### NFR-08 — Graceful degradation
Failure or saturation of search, analytics, AI, notifications, media processing or other derived services must not corrupt authoritative bidding/finalization. Degraded mode may remove convenience features while preserving correctness and protected core paths.

### NFR-09 — Resource isolation
Non-critical workloads must not starve bid acceptance, finalization, identity/authorization checks or authoritative database transactions. Later architecture must provide appropriate pools, limits, bulkheads or scheduling isolation.

### NFR-10 — Recoverable realtime
Realtime delivery may be delayed or interrupted, but reconnecting clients must detect stale/gapped state and recover through authoritative resynchronization. Realtime delivery is never the only copy of a critical event.

### NFR-11 — Single logical finalization outcome
Scheduler duplication, worker retry, failover or deployment restart must not create two logical close outcomes. Finalization must be retry-safe and fenced against stale writers.

### NFR-12 — Auditable critical actions
Critical automated and human actions must produce durable, attributable evidence sufficient to reconstruct actor/service identity, target, operation, relevant rule/version, time and result.

### NFR-13 — Security by default
Protected endpoints, objects and commands use deny-by-default authorization. Least privilege, object scope and server-side enforcement are required; frontend visibility is never a security boundary.

### NFR-14 — Sensitive-data minimization
Private max bids, identity/KYC data, secrets, credentials and other sensitive fields must be excluded from public payloads, ordinary logs, search indexes, analytics and AI context unless explicitly required by a protected function.

### NFR-15 — Secure transport and secret handling
Production traffic carrying authenticated or sensitive information must use approved encrypted transport. Secrets must be environment-scoped and must not be committed to source, bundled into public frontend code or written to ordinary logs.

### NFR-16 — Abuse resistance
Public and authenticated interfaces must support rate limits, resource ceilings and abuse controls appropriate to the endpoint risk. Abuse controls must not silently alter auction fairness or accepted-bid ordering.

### NFR-17 — Data integrity constraints
Canonical data must use database-level integrity protections where applicable: stable identifiers, foreign keys, uniqueness, check constraints, transaction boundaries and versioning/immutability rules for critical history.

### NFR-18 — Migration safety
Schema/data migrations must be reproducible, reviewed/tested and compatible with rollback/recovery strategy. A migration that can corrupt active auctions or make deterministic reconstruction impossible cannot be considered production-ready.

### NFR-19 — Backup and restore proof
Backups alone are insufficient. Production readiness requires tested restoration of the authoritative datastore and verification that recovered state preserves critical history and consistency.

### NFR-20 — Defined recovery behavior
Each critical dependency must have documented failure behavior and recovery strategy. Recovery procedures must specify how authority is preserved and how stale writers or projections are fenced/resynchronized.

### NFR-21 — Observability of critical paths
Critical services must emit structured telemetry sufficient to detect failures in bid acceptance, authorization, realtime sequence continuity, finalization, workers, database health and recovery. Logs are diagnostic evidence, not auction truth.

### NFR-22 — Actionable alerting
Operational alerts must identify conditions that can affect correctness, security, availability or recovery. Alerting must avoid depending solely on a customer report or browser-visible failure.

### NFR-23 — Correlation and reconstruction
Requests, commands, durable events and relevant worker actions must carry correlation identifiers sufficient to trace a critical journey across services without relying on browser memory.

### NFR-24 — Deployment safety
Deployments must not create two authoritative write owners, silently change rules for an already-running auction or invalidate deterministic reconstruction. Later CI/CD tasks must implement staged rollout, migration gates and rollback controls.

### NFR-25 — Backward-compatible contracts
Public/internal APIs and realtime event schemas require explicit versioning or compatibility rules. Rolling deploys must tolerate supported mixed-version windows without corrupting critical state.

### NFR-26 — Testability
Critical time, concurrency, failure and retry behaviors must be testable deterministically. The architecture must permit controlled clocks, deterministic fixtures, fault injection and repeatable race/recovery tests.

### NFR-27 — Maintainable boundaries
Domain rules, provider integrations, transport code and presentation code must remain separable enough that changing UI, notification provider, search engine or AI feature does not require rewriting the authoritative auction core.

### NFR-28 — Configuration over country hardcoding
Country, locale, timezone, legal profile, KYC profile and document/provider differences must be configuration-driven where defined by later tasks. Country expansion must not fork the core auction algorithm.

### NFR-29 — Unicode and locale correctness
User-facing text and searchable canonical fields must support Unicode correctly. Locale-aware display must not alter canonical identifiers, authoritative ordering, server-time decisions or numeric auction logic.

### NFR-30 — Time correctness
Canonical timestamps are stored and processed in UTC where appropriate; user display may be localized. Future scheduling must use explicit timezone semantics where required and must not rely on browser clock for authoritative decisions.

### NFR-31 — Accessibility target
Public and authenticated user interfaces target WCAG 2.2 AA as defined by later Phase 28 verification. Critical status, bidding controls, errors and live-auction state must not rely on color alone.

### NFR-32 — Responsive device quality
Critical buyer and operator journeys must remain usable on the supported desktop/mobile browser matrix defined later. Mobile layout or reduced viewport must not hide required confirmation, status or error information.

### NFR-33 — Performance isolation for media/search/AI
Large media operations, indexing, recommendations and AI inference must be asynchronous or isolated where needed so they cannot monopolize resources required for authoritative auction operations.

### NFR-34 — Projection rebuildability
Search indexes, caches, realtime room snapshots, analytics and notification projections must have a defined rebuild/resync path from canonical state and durable events.

### NFR-35 — Provider failure containment
Third-party provider timeout, malformed response or outage must be bounded by timeouts/retries/circuit behavior appropriate to the dependency. Provider failure must not silently grant identity, eligibility or privileged access.

### NFR-36 — No hidden production dependencies
Every dependency required for critical production operation must be inventoried, owned and monitored. Browser extensions, developer workstations, localStorage, manual DAVID worker state or undocumented scripts cannot be production authority dependencies.

### NFR-37 — Evidence-driven readiness
A feature or NFR is not satisfied because code exists or a UI looks correct. GREEN requires evidence appropriate to the requirement: tests, deployment results, telemetry, load/chaos reports, security evidence, restore/failover drills or other verifiable artifacts.

### NFR-38 — No production promise from development evidence
GitHub commits, Vercel builds and `enchev_development_events` can prove development status, but they do not prove customer auction correctness, production SLO compliance, legal applicability or launch readiness unless the relevant later certification task explicitly verifies those properties.

## 3. Quantitative-target governance

Exact production numeric targets are intentionally not invented in `00.05` because the FROZEN plan already assigns them to later tasks:

- Phase 18 — concurrency/load/chaos certification;
- Phase 27 — SLIs, SLOs, latency/timeout budgets, retry budgets and capacity model;
- Phase 40 — performance budgets;
- Phase 42 — initial numeric SLO thresholds and error-budget behavior;
- Phase 43 — recovery objectives and restore/failover certification.

Those later tasks may refine numbers without weakening the correctness/security invariants defined by `00.01`–`00.05`.

## 4. Current implementation boundary observed for 00.05

At the time of this task, the production Vercel application is primarily a Next.js marketplace/Command Center surface. Connected Supabase inspection shows no Enchev production auction/bid/final-result/RBAC domain tables under the `enchev_%` namespace; `public.enchev_development_events` is a development/test evidence table.

Therefore this NFR registry is a downstream engineering contract. It does **not** make the unfinished auction core, realtime, identity, security, recovery or operations phases GREEN.

## 5. Downstream proof ownership

- correctness/concurrency/idempotency → Phases 03, 08, 09, 10, 11, 18;
- security/privacy/abuse → Phases 04, 05, 16, 29, 45 plus security GAP items;
- performance/capacity/resource isolation → Phases 18, 27, 40, 42 plus GAP-045–GAP-056;
- recovery/resilience → Phases 17, 23, 27, 30, 43 plus recovery GAP items;
- API/event compatibility → Phase 24;
- testability → Phase 25;
- CI/deployment safety → Phase 26 plus safe-deploy GAP items;
- accessibility/device quality → Phase 28;
- internationalization → Phases 21, 31, 39;
- observability/audit/reconstruction → Phases 17, 37, 41;
- AI isolation → Phase 22 plus GAP-011–GAP-020.

A downstream implementation that violates `00.04` invariants or these NFRs cannot be GREEN even if an isolated happy-path test succeeds.

## 6. Acceptance criteria for 00.05

`00.05` may be GREEN only when all of the following are true:

1. this NFR registry exists under frozen task ID `00.05` without renumbering/redefining the MASTER plan;
2. it covers correctness, concurrency, latency measurement, capacity, degradation, security, data integrity, recovery, observability, deployability, compatibility, testability, accessibility and internationalization;
3. correctness/security precedence over convenience/performance is explicit;
4. numeric production SLA/SLO promises are not invented here and are delegated to the frozen tasks that own them;
5. current implementation gaps are stated rather than falsely marked complete;
6. downstream proof ownership is mapped;
7. the exact implementation commit builds and typechecks successfully;
8. the exact commit reaches production successfully and production HTTP/runtime verification shows no regression;
9. GREEN evidence records exact commit/deployment results.

## 7. Evidence

Pending verification for the implementation commit. After successful build/typecheck/deployment/runtime validation, this document will be updated to `Status: GREEN` with exact evidence.
