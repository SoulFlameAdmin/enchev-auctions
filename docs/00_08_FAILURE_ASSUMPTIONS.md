# Enchev Auctions — 00.08 Failure Assumptions

Status: GREEN — failure contract implemented and verified with independent production-build evidence
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.08`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.07`

This document defines the failure assumptions that every later Enchev Auctions implementation must be designed and tested against. It is a contract for later architecture, testing, recovery and operational tasks; it does not claim those mechanisms are already implemented.

This task does not add pricing, payment or finance scope.

## 1. Core failure posture

Enchev Auctions assumes that failures are normal, partial, concurrent and sometimes ambiguous.

The system must therefore be designed around these principles:

1. **Critical correctness beats apparent availability.** If the platform cannot prove whether a winner-affecting write is safe, it must fail closed rather than guess.
2. **A timeout is not proof of failure.** A client may lose the response after the server/database committed. Retries must use idempotency and authoritative reconciliation.
3. **A successful HTTP/WebSocket response is not authority by itself.** Authoritative state is the committed PostgreSQL-backed state defined by `00.03` and `00.04`.
4. **Partial dependency failure is expected.** Realtime, cache, search, analytics, AI, media and notifications may fail without corrupting auction truth.
5. **Processes crash.** Web/server instances, workers, finalizers, schedulers and browsers may stop at any instruction boundary and restart later.
6. **Messages duplicate, delay and reorder.** Consumers must be idempotent and ordering-sensitive flows must carry durable sequence/version information.
7. **Networks partition.** Clients and services may be disconnected while other parts of the platform remain healthy.
8. **Clocks drift.** Browser/device clocks and node clocks are not trusted to decide bid deadlines; authoritative server/database time wins.
9. **Humans make mistakes.** Admin actions, deployments, migrations and operational interventions require auditability, review and recovery paths.
10. **Infrastructure can fail regionally or globally.** The system must preserve critical invariants even when availability is reduced.

## 2. Failure classes

### FA-01 — Client/browser failure

Assume that a bidder browser can crash, freeze, sleep, reload, lose storage, lose focus, have stale JavaScript, open multiple tabs, or submit the same action more than once.

Required design consequences:
- browser state is never authoritative for accepted bids, auction close or winner selection;
- critical commands need stable operation/idempotency identifiers;
- multi-tab duplicate submissions must not create multiple logical actions;
- reconnect must fetch authoritative state rather than trusting stale local state;
- countdown display drift cannot decide whether a bid is accepted.

### FA-02 — Network timeout / ambiguous outcome

Assume a critical request can reach the authoritative service and commit while the response is lost.

Required design consequences:
- clients must not blindly create a new logical bid after a timeout;
- retry of the same logical operation must be idempotent;
- the client must be able to reconcile the operation against authoritative state/history;
- an ambiguous write outcome must not be converted into an assumed rejection or acceptance locally.

### FA-03 — Duplicate, delayed and reordered delivery

Assume HTTP retries, event consumers, queues and realtime transports can produce duplicates, delay and out-of-order delivery.

Required design consequences:
- consumers are idempotent;
- accepted bid/order events carry durable sequence/version information;
- stale events cannot overwrite newer authoritative state;
- event handlers must tolerate replay;
- notification duplication must not create duplicate authoritative effects.

### FA-04 — Realtime disconnect / sequence gap

Assume WebSocket/realtime transport disconnects without warning and messages can be missed.

Required design consequences:
- realtime is a projection/transport, never the source of truth;
- clients detect sequence/version gaps where applicable;
- clients resync from an authoritative snapshot before continuing critical UI assumptions;
- stale/disconnected state is visibly distinguishable in later UI work.

### FA-05 — Database transaction conflict / deadlock / timeout

Assume PostgreSQL transactions can block, deadlock, abort, exceed timeout or lose their connection.

Required design consequences:
- transaction failures never return a false accepted result;
- retry policy distinguishes safe transaction retry from a new logical operation;
- winner-affecting operations preserve deterministic ordering under retry/concurrency;
- database errors do not fall back to browser/cache authority.

### FA-06 — Database unavailable

Assume the authoritative database can be temporarily unavailable or unreachable.

Required design consequences:
- winner-affecting writes fail closed;
- read-only/public surfaces may degrade where safe;
- no alternate datastore may silently become auction authority;
- recovery must restore/reconcile authoritative state before accepting critical writes again.

### FA-07 — Failover / stale writer / split-brain risk

Assume failover can leave an old process or lease holder alive long enough to attempt writes.

Required design consequences:
- later authoritative-owner/finalizer designs need fencing, locks, leases or equivalent protection;
- two instances must never be able to produce competing final results;
- stale writers must be rejected by authority/version checks;
- failover success is not declared until stale-writer protection is tested.

### FA-08 — Server/worker crash mid-operation

Assume a serverless/server process, worker, outbox publisher, scheduler or finalizer can crash before, during or immediately after a durable commit.

Required design consequences:
- critical state transitions are transactionally durable before derived effects;
- workers/finalizers are retry-safe;
- notification/search/realtime publication can resume from durable state/outbox evidence;
- process memory is never the only record that an operation happened.

### FA-09 — Finalizer executes more than once

Assume auction-close/finalization triggers can fire concurrently, late or repeatedly.

Required design consequences:
- finalization is logically exactly-once even when execution is at-least-once;
- repeated execution returns/reuses the same canonical result or safely no-ops;
- no retry may select a different winner from the same authoritative input snapshot.

### FA-10 — Clock drift / scheduling delay

Assume browser clocks are wrong and server/scheduler clocks can drift or execute late.

Required design consequences:
- database/server time is authoritative;
- bid acceptance evaluates the authoritative deadline in the critical transaction/path;
- scheduler timing alone cannot decide that an auction is closed;
- exact boundary behavior must be tested later.

### FA-11 — Cache / Redis / search outage

Assume caches, Redis, search indexes and projections are stale, unavailable or lost.

Required design consequences:
- loss of a projection does not lose accepted bids or final results;
- caches/search are rebuildable;
- stale cache/search data cannot be used to accept/reject a bid or pick a winner;
- the platform may degrade search/realtime convenience while preserving authority.

### FA-12 — Event/outbox consumer lag

Assume an outbox or asynchronous consumer can stop for minutes or longer, then replay a backlog.

Required design consequences:
- authoritative commit does not depend on immediate downstream delivery;
- lag is observable;
- consumers remain idempotent during backlog replay;
- delayed notification/search/realtime state must not alter canonical auction truth.

### FA-13 — Auth/identity provider degradation

Assume authentication, session validation or identity/KYC provider calls can fail, time out or return temporarily inconsistent state.

Required design consequences:
- uncertainty never grants additional privilege;
- eligibility-sensitive bidding fails closed when required authorization cannot be proven;
- cached identity/eligibility state may only be used under explicitly versioned rules later;
- recovery cannot silently broaden access.

### FA-14 — Object storage / media failure

Assume images and documents may be unavailable while metadata/database state remains healthy.

Required design consequences:
- missing media does not change auction state or winner;
- UI must tolerate partial media availability;
- critical provenance/document workflows later require integrity/version evidence rather than relying only on a public URL.

### FA-15 — External provider outage

Assume email/SMS/push/AI/geocoding/inspection/import and other external providers fail independently.

Required design consequences:
- provider failure cannot mutate canonical auction outcomes incorrectly;
- retries are bounded/idempotent;
- provider callbacks/webhooks are authenticated and idempotent when later implemented;
- AI failure never blocks or overrides the authoritative auction core unless an explicitly approved non-critical feature chooses to degrade.

### FA-16 — Deployment/build failure

Assume a GitHub/Vercel build can fail, be rate-limited, partially roll out or leave old and new application versions running concurrently.

Required design consequences:
- failed builds are never treated as deployed features;
- old and new clients/services must be compatible during rollout where necessary;
- schema/API changes later require backward/forward compatibility strategy;
- deployment success is evidence only for the exact commit/descendant that contains the feature;
- rollback/forward-fix must not rewrite accepted bid history or final results.

### FA-17 — Schema migration failure / mixed version

Assume migrations can fail part-way before transaction rollback, or application versions can temporarily disagree about schema capabilities.

Required design consequences:
- later migrations must be transactional where possible and explicitly staged where not;
- destructive/incompatible migrations require an explicit compatibility plan;
- migrations must not create a period with two authoritative write paths;
- application code must fail safely when required schema capability is absent.

### FA-18 — Capacity exhaustion / overload

Assume traffic bursts, hot auctions, bots or accidental retry storms can exhaust CPU, connections, memory, rate limits or provider quotas.

Required design consequences:
- correctness requirements remain stronger than latency targets;
- admission control/rate limiting later must protect critical resources;
- overload cannot cause duplicate accepted logical bids or conflicting finalization;
- non-critical work can be shed/deferred before critical authority is compromised.

### FA-19 — Malicious/invalid input

Assume all client input can be malformed, replayed, manipulated or intentionally adversarial.

Required design consequences:
- validation and authorization happen server-side;
- identifiers/object scope are not trusted from UI alone;
- private Max Bid and DC-3 data from `00.07` never travel through public projections by convenience;
- invalid input cannot drive privileged state transitions.

### FA-20 — Privileged human error or abuse

Assume support/admin/operator users can click the wrong action, act on stale context, have compromised accounts, or intentionally abuse access.

Required design consequences:
- high-impact actions require explicit authorization, reason/audit and later maker-checker/dual-control where defined;
- overrides are explicit events, not silent row edits;
- original accepted/final evidence remains reconstructable;
- privileged actions are attributable to an actor and timestamp.

### FA-21 — Secret/credential compromise

Assume a token, provider credential or service secret can be exposed.

Required design consequences:
- least privilege and rotation/revocation are required later;
- compromise of a projection/provider credential must not automatically imply authority over canonical auction state;
- DC-3 values from `00.07` are excluded from public logs, browser storage and ordinary analytics;
- incident response must be possible without rewriting historical auction truth.

### FA-22 — Data corruption / operator mistake

Assume software bugs, migration defects or human actions can corrupt data.

Required design consequences:
- critical history must be reconstructable/auditable;
- backup/restore and reconciliation drills are required later;
- detected corruption must stop unsafe critical writes until authority is re-established;
- correction is explicit and auditable, never a silent rewrite of accepted bid history.

### FA-23 — Regional/cloud control-plane outage

Assume a hosting region, deployment control plane or managed service can become unavailable.

Required design consequences:
- later DR architecture must define RPO/RTO and recovery ownership;
- failover must fence stale writers before reopening critical writes;
- degraded mode may preserve read access while critical writes are paused;
- no regional failover is considered safe until tested with authoritative-state evidence.

### FA-24 — Shared-development-platform blast radius

Current connected Supabase project is shared with unrelated systems. Assume unrelated development activity can consume resources, introduce advisory findings or create operational noise.

Required design consequences:
- Enchev development evidence must remain namespaced and isolated;
- unrelated shared tables/functions are not auction authority;
- Enchev production auction state must not be introduced into the shared project without the later infrastructure/security decision that owns that boundary;
- this Phase 00 task must not mutate unrelated schemas/tables as a shortcut.

## 3. Fail-open vs fail-closed matrix

| Situation | Required behavior |
| --- | --- |
| Cannot prove bidder authorization/eligibility | Fail closed for bid acceptance |
| Cannot reach authoritative database | Fail closed for winner-affecting writes |
| Bid result response times out after possible commit | Reconcile/idempotent retry; never assume |
| Realtime disconnected | Mark stale and resync; do not invent state |
| Search/cache unavailable | Degrade convenience; authority remains DB-backed |
| Notification provider unavailable | Queue/retry later; do not alter canonical state |
| AI unavailable | Degrade AI feature; never substitute authority |
| Media unavailable | Show degraded media state; auction authority unchanged |
| Finalizer uncertainty / competing owner | Fence/lock and fail closed until one authority is proven |
| Admin override lacks required approval | Fail closed |
| Observability pipeline unavailable | Critical writes may continue only if authority/audit invariants still remain provable; otherwise fail closed |

## 4. Ambiguous critical-write rule

For any future winner-affecting command, the protocol must distinguish **logical operation identity** from **network attempt identity**.

Minimum later implementation contract:
- client/server generate or agree a stable idempotency/operation key;
- retries of the same logical operation cannot create a second accepted logical action;
- authoritative history can answer whether that operation committed;
- the client can recover after timeout/reload without guessing;
- duplicate delivery is safe.

This requirement applies especially to bids, lifecycle transitions, finalization and privileged result-changing actions.

## 5. Recovery ordering rule

After a serious failure, recovery order is:

1. restore/prove authoritative datastore availability and consistency;
2. fence stale writers / establish a single authoritative write path;
3. reconcile unfinished critical operations/finalization;
4. restore outbox/derived consumers;
5. rebuild/cache/search/realtime projections;
6. resume non-critical integrations and AI;
7. verify telemetry and audit completeness.

The platform must not reopen critical writes simply because the UI is reachable.

## 6. Failure evidence required by later phases

This document defines assumptions; later phases must prove them with executable evidence including, where applicable:

- concurrency tests;
- duplicate/idempotency tests;
- network-timeout/ambiguous-outcome tests;
- realtime disconnect/gap/resync tests;
- worker/finalizer crash-and-retry tests;
- deadlock/transaction-retry tests;
- cache/search/provider outage tests;
- load and retry-storm tests;
- failover/stale-writer fencing tests;
- backup/restore/reconciliation drills;
- deployment/migration rollback or forward-fix tests;
- security/privilege-abuse controls;
- observability proving sequence, latency, failures and recovery.

A written assumption is not evidence that a recovery mechanism works.

## 7. Current observed baseline — 2026-09-17

At the start of `00.08`:

- the repository is actively receiving parallel UI/DAVID tooling commits on `main`;
- Vercel production builds can succeed but have also recently encountered build-rate-limit failures, demonstrating that deployment infrastructure itself must be treated as fallible;
- the connected Supabase project is shared with multiple unrelated applications;
- `public.enchev_development_events` is the only observed `public.enchev%` table and is development evidence, not auction authority;
- no Enchev production auction/bid/finalization/RBAC data model has been proven in the connected project;
- current UI auction/countdown behavior remains demo/projection state, not authoritative bidding;
- therefore this task defines failure assumptions before production authority paths are introduced.

## 8. Scope boundaries

`00.08` does not claim implementation of:

- database failover or PITR;
- authoritative bidding/finalization;
- transactional outbox;
- Redis/search/realtime recovery;
- production identity/KYC recovery;
- load/chaos certification;
- backup/restore drills;
- multi-region recovery;
- incident response runbooks.

Those remain owned by later FROZEN phases and must carry their own evidence.

## 9. Acceptance criteria for 00.08

`00.08` may be GREEN only when:

1. the platform explicitly assumes client, network, process, database, dependency, deployment and human failures;
2. ambiguous write outcomes and idempotent reconciliation are defined;
3. fail-open/fail-closed behavior is defined for critical categories;
4. realtime gaps, duplicates, ordering and replay are covered;
5. finalizer retry and stale-writer/split-brain assumptions are covered;
6. clock drift and server-time authority are covered;
7. overload, provider outage, migration and regional failure are covered;
8. shared-development-environment blast radius is documented without mutating unrelated systems;
9. future recovery evidence is explicitly separated from this documentation task;
10. no pricing/payment/finance scope is added;
11. the implementation commit or a proven descendant containing it passes production build/typecheck and HTTP/runtime regression checks;
12. exact evidence is recorded before GREEN.

## 10. Evidence

- Implementation commit: `c727a95ac4924f18ce09c25aea720a6359ab4e1b`.
- Safe verification descendant: `929b6f252231e34624253a13346e44e2f285aca1`; GitHub compare proves it is three commits ahead of and contains the implementation commit.
- GitHub Actions workflow: `Verify Enchev Web`, run `35180993736`, job `105072899190`, conclusion `success`.
- Environment: Ubuntu 24.04, Node `24.20.0`, npm `11.19.0`.
- Dependency installation: PASS.
- Explicit TypeScript check `npx tsc --noEmit`: PASS.
- Production build `npm run build` / `next build`: PASS with Next.js `16.3.5`; compile successful; Next internal TypeScript successful; static generation `7/7` successful.
- Verified routes in the build: `/`, `/_not-found`, `/inventory`, `/live-auctions`, `/lot/[id]`, `/transport`, `/vehicle-history`.
- Vercel production alias health was separately verified as HTTP `200` while the Git-triggered build path was rate-limited.
- Vercel runtime error query returned no runtime errors in the verification window.
- Vercel `build-rate-limit` is recorded as an infrastructure limitation and is not misrepresented as a successful Vercel build for this commit.
- Supabase is not used as fake proof: no exact `enchev_development_events` row was available for the verification commits.
- Detailed evidence and the safe-alternative rationale are recorded in `docs/00_08_FAILURE_ASSUMPTIONS_EVIDENCE.md`.

Because this Phase 00 change is documentation-only and the proven descendant passed an independent production-mode build while the deployed runtime remained healthy, the task's build/typecheck + HTTP/runtime acceptance condition is satisfied without claiming an exact Vercel build that did not occur.
