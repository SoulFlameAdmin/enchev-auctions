# Enchev Auctions — 00.05 Non-functional Requirements Documented

Status: YELLOW — NFR contract committed; production verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.05`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01 System scope and boundaries`, `00.02 Actors and permission map`, `00.03 Authoritative components defined`, `00.04 Critical system invariants documented`

This document defines the non-functional requirements that every later Enchev Auctions implementation must satisfy. It is a system-quality contract, not evidence that the auction engine, RBAC, realtime service, workers, search, providers or production SLOs already exist.

It intentionally does **not** introduce pricing, payment or finance tracker scope.

## 1. NFR governance rule

A feature is not production-ready merely because its happy path works. A downstream task cannot be GREEN when it violates a required quality property in this document or the invariants in `00.04`.

Where a later frozen phase owns a detailed numeric target (for example Phase 27 SLO/capacity targets), this document defines the required measurable property and acceptance method without inventing a conflicting final number.

## 2. Correctness and consistency

### NFR-01 — Authoritative correctness over apparent availability
When the system cannot safely determine a winner-affecting state, it must fail closed rather than invent or guess a successful bid, eligibility decision, close result or privileged mutation.

### NFR-02 — Strong consistency for winner-affecting writes
Accepted bids, accepted-bid sequence, auction lifecycle transitions and finalization results must use the authoritative transactional path defined by `00.03` and preserve the invariants in `00.04`.

### NFR-03 — Eventual consistency is allowed only for projections
Search, analytics, notifications, cache state and ordinary UI projections may lag canonical state, but must expose a recovery/resync path and may not become an alternative authority.

### NFR-04 — Deterministic reconstruction
For every completed auction, durable data must be sufficient to reconstruct rule version, lifecycle, accepted-bid order, extensions, finalization and privileged exceptions without relying solely on ephemeral logs.

Acceptance evidence later: transaction/integration tests, reconstruction tests, race tests and finalization tests.

## 3. Availability and resilience

### NFR-05 — Fault isolation
Failure of search, analytics, notifications, AI, cache or a non-authoritative provider must not corrupt canonical bidding/finalization state.

### NFR-06 — Graceful degradation
When optional dependencies fail, the system must degrade explicitly and safely. The UI must not silently present stale derived state as authoritative.

### NFR-07 — Retry safety
Client, API, worker and scheduler retries for critical operations must preserve logical idempotency and must not create duplicate bids, duplicate close results or duplicate privileged actions.

### NFR-08 — Restart recovery
Web/API/realtime/worker restarts must have defined recovery behavior. A restart may interrupt availability, but must not create two active authorities or lose already committed critical truth.

### NFR-09 — Reconnect recovery
Realtime clients detecting disconnect, sequence gap or stale state must reconcile from authoritative state before continuing winner-sensitive interactions.

Formal availability SLO values and error budgets belong to Phase 27 and are not frozen by this task.

## 4. Performance and latency

### NFR-10 — Critical-path latency is measured end-to-end
Bid acceptance latency must be measured from server receipt through authoritative commit and response, not only frontend animation time.

### NFR-11 — Realtime latency is measured separately from bid acceptance
Realtime fanout/delivery latency is a projection metric. A fast WebSocket event cannot compensate for a slow or failed authoritative bid transaction.

### NFR-12 — Performance measurements use percentiles
Critical latency reporting must include percentile-based measurements (at minimum p50/p95/p99 where practical) rather than averages alone.

### NFR-13 — Performance tests include contention
Performance acceptance must include concurrency, database contention, reconnect storms, duplicate requests, slow clients and worker recovery—not only single-user synthetic requests.

### NFR-14 — No unbounded critical-path work
Winner-affecting request paths must not perform unbounded loops, unlimited retries, unlimited fanout waits or provider calls with no timeout budget.

Numeric performance targets are owned by Phase 27 and validated by Phases 18 and 23.

## 5. Scalability and capacity

### NFR-15 — Horizontal scaling must preserve single logical authority
Adding web/realtime/worker instances must not create competing auction writers or competing finalizers.

### NFR-16 — Capacity is modeled per hot auction and globally
Testing must consider both many independent auctions and concentrated traffic against one hot auction/room.

### NFR-17 — Backpressure is explicit
Realtime and asynchronous consumers must have bounded buffering/backpressure behavior so a slow client or downstream provider cannot cause unbounded memory/resource growth.

### NFR-18 — Pool exhaustion is a tested failure mode
Database, HTTP, realtime and worker connection pools must have limits/timeouts and must be load-tested for exhaustion/recovery.

Detailed capacity targets and scaling runbooks belong to Phases 18 and 27.

## 6. Security and privacy

### NFR-19 — Default deny
Privileged actions and protected object access must fail closed when authorization or scope cannot be verified.

### NFR-20 — Least privilege
Service credentials, application roles, database access, storage access and provider credentials must expose only the minimum capability required for their responsibility.

### NFR-21 — Sensitive values do not leak to projections
Private max/proxy bid values, secrets, tokens, privileged credentials and other sensitive material must not be exposed through public responses, realtime payloads, browser storage, search indexes, analytics or ordinary logs.

### NFR-22 — Security-sensitive actions are attributable
Privileged changes must produce durable audit evidence sufficient to identify actor, target, action, time and required reason/context.

### NFR-23 — Security controls are server-enforced
Hidden buttons, disabled frontend controls or client-provided role strings are never authorization controls.

Detailed security implementation and abuse testing belong to Phases 04 and 16.

## 7. Data durability and recovery

### NFR-24 — Committed critical data is durable
After a successful authoritative commit, an ordinary process restart must not erase the accepted bid, lifecycle mutation or final result.

### NFR-25 — Backup is not enough without restore proof
A backup capability is not GREEN until later recovery tasks demonstrate a restore/recovery path appropriate to the protected data.

### NFR-26 — Critical history is append-oriented
Accepted bid history, final-result history and privileged exceptional actions must preserve reconstruction evidence rather than relying on destructive overwrite semantics.

### NFR-27 — Recovery objectives are measurable
Recovery processes must have explicit measurable RPO/RTO targets before production acceptance. Final numeric RPO/RTO values are owned by later resilience/operational tasks and are not invented here.

## 8. Observability and diagnosability

### NFR-28 — Every critical request is correlatable
Critical API, worker and realtime flows must support correlation identifiers sufficient to trace one logical action across components without exposing sensitive data.

### NFR-29 — Structured signals
Production observability must provide structured logs, metrics and error signals for critical paths. Free-form console output alone is insufficient.

### NFR-30 — Operational alerts map to user/system impact
Alerting must cover at least authoritative bid failures, finalization failures, worker failure, database unavailability and critical security failures once those components exist.

### NFR-31 — Development evidence is separate from auction truth
`enchev_development_events`, GitHub/Vercel checks and Command Center status prove engineering/test state only; they never become customer auction authority.

Detailed observability implementation belongs to Phase 17.

## 9. Accessibility and device quality

### NFR-32 — Core flows are operable without pointer-only assumptions
Registration, discovery, bidding controls, dialogs and critical status messages must support keyboard/touch semantics appropriate to the later accessibility implementation.

### NFR-33 — Critical state is not color-only
Accepted/rejected/outbid/ended/error/security states must have textual/semantic representation in addition to color.

### NFR-34 — Accessibility target is testable
The detailed target is the FROZEN Phase 28 requirement `WCAG 2.2 AA target`, with keyboard, focus, screen-reader, contrast, zoom, reduced-motion and touch-target tests.

## 10. Compatibility and international readiness

### NFR-35 — Core auction logic is locale-independent
Locale, display language, currency formatting, timezone display and regional presentation must not alter canonical auction ordering, server-time decisions or winner calculation.

### NFR-36 — UTC/canonical time internally, localized presentation externally
Winner-sensitive timestamps use the authoritative canonical time model; clients may render localized time without changing business truth.

### NFR-37 — Unicode-safe identifiers and user data
International names, addresses, search input and text must have defined Unicode handling; cross-script/transliteration behavior belongs to international/search phases.

### NFR-38 — No country-specific core rewrite
Adding a market/country must use configuration/profile/provider boundaries rather than forking the core authoritative auction algorithm.

Detailed international validation belongs to Phases 21, 31 and 39.

## 11. Maintainability and change safety

### NFR-39 — Public/internal contracts are versioned where compatibility matters
API contracts, WebSocket events, auction rule versions and durable event formats must have an explicit compatibility/versioning strategy before they become externally relied upon.

### NFR-40 — Schema changes are migration-controlled
Production database structure must evolve through controlled migrations with rollback/recovery consideration rather than ad-hoc manual drift.

### NFR-41 — Critical behavior is testable deterministically
Time, bidding rules, race ordering and finalization must be designed so deterministic automated tests can exercise exact boundaries and failure cases.

### NFR-42 — Production changes have rollback/kill capability
Later launch engineering must provide rollback, staged rollout and/or kill-switch mechanisms appropriate to the component risk.

## 12. AI isolation

### NFR-43 — AI is non-authoritative and optional to core correctness
Loss, latency, hallucination or unavailability of AI features must not prevent the authoritative auction path from determining bids, permissions, lifecycle or winners correctly.

### NFR-44 — AI output is distinguishable from canonical facts where material
AI-generated summaries/recommendations must not silently overwrite canonical vehicle, inspection, compliance, identity or auction facts.

## 13. Current implementation boundary observed for 00.05

Connected state checked on 2026-09-17:

- GitHub FROZEN plan contains `00.05 Non-functional requirements documented` immediately after `00.04`;
- current `package.json` exposes `next build` but no standalone lint/test script yet; later testing/CI phases remain required;
- connected Supabase project contains `public.enchev_development_events` as Enchev engineering evidence, but no Enchev customer auction/bid/final-result/RBAC domain tables;
- current production deployment is a Next.js marketplace/Command Center frontend and must not be interpreted as proof of the future auction-engine NFRs.

Therefore `00.05` documents the required quality contract only. Runtime achievement of these properties must be proven by their later implementation/test tasks.

## 14. Downstream ownership map

- Phase 03 → durability, integrity, locking, idempotency, database resilience;
- Phase 04 / 16 → authorization, security, least privilege, abuse resistance;
- Phase 09 / 10 / 11 → bid correctness, realtime recovery, finalization correctness;
- Phase 17 → observability and recovery signals;
- Phase 18 → concurrency, stress and chaos evidence;
- Phase 21 / 31 / 39 → international quality;
- Phase 25 / 26 → deterministic testing and CI/CD quality gates;
- Phase 27 → numeric SLIs/SLOs, latency budgets, retry budgets and capacity targets;
- Phase 28 → accessibility/device quality;
- Phase 30 → operational readiness/runbooks;
- Phase 47 → final production proof.

## 15. Acceptance criteria for 00.05

`00.05` may be GREEN only when:

1. this NFR contract exists under the immutable frozen task ID;
2. it is consistent with `00.01` through `00.04`;
3. it covers correctness, consistency, resilience, performance, scalability, security, durability, observability, accessibility, international readiness, maintainability and AI isolation;
4. it separates required measurable properties from later-owned final numeric SLO/capacity targets;
5. it explicitly states current implementation gaps rather than claiming runtime NFR compliance;
6. the exact implementation commit builds/typechecks and deploys successfully;
7. production HTTP/runtime verification shows no regression from the change;
8. GREEN evidence records the exact commit/deployment results.

## 16. Evidence

Pending production verification for the implementation commit. After successful build/typecheck/deploy/runtime validation, this document will be updated to GREEN with exact evidence.
