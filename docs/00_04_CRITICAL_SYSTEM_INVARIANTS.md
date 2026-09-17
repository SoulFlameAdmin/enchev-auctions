# Enchev Auctions — 00.04 Critical System Invariants Documented

Status: GREEN — invariant contract implemented and verified with production evidence
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.04`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01 System scope and boundaries`, `00.02 Actors and permission map`, `00.03 Authoritative components defined`

This document defines the non-negotiable invariants that later implementation, testing, security, realtime, database, worker and operational tasks must preserve. It documents the rules; it does **not** claim that the later auction engine, database schema, RBAC, realtime service or finalization worker already exist.

## 1. Authority and truth invariants

### INV-01 — One canonical auction truth
PostgreSQL-backed authoritative state is the canonical source for auction lifecycle state, accepted bids and final results. Browser state, WebSocket messages, caches, search indexes, analytics and AI output are projections only.

### INV-02 — One authoritative write path per critical decision
Winner-affecting mutations must pass through a single supported server-side command/transaction path for that decision class. No browser, realtime node, cache worker or AI component may create a parallel truth.

### INV-03 — Commit defines acceptance
A bid, auction mutation or final result is authoritative only after the corresponding authoritative database transaction commits. Optimistic UI, an HTTP response prepared before commit, a WebSocket echo or a queued job is not proof of acceptance.

### INV-04 — Derived state must be rebuildable
Realtime room state, Redis/cache data, search indexes, dashboards, notification queues and browser state must be reconstructable from canonical state plus durable events. Loss of a projection must not destroy auction truth.

## 2. Bid invariants

### INV-05 — Bid eligibility is checked inside the authoritative path
Authentication, account state, market/auction eligibility and required restrictions are validated server-side as part of the authoritative bid command. A visible/enabled frontend button never grants permission.

### INV-06 — Bid increment/rule validation is authoritative
Every accepted bid must satisfy the versioned auction rules and increment constraints in the authoritative transaction path. Client-side validation is advisory only.

### INV-07 — Accepted bid ordering is monotonic and durable
Every accepted bid receives an authoritative ordering/sequence that cannot move backwards or be silently rewritten. Realtime/network arrival order is never used as the canonical order.

### INV-08 — Idempotent critical writes
Retries of the same logical critical command must not create duplicate bids, duplicate close results or duplicate privileged mutations. Critical write APIs/workers must use an idempotency/deduplication mechanism appropriate to the later implementation.

### INV-09 — Accepted bid history is append-only
Accepted bid history must be durable and reconstructable. Corrections or exceptional administrative actions must be represented as explicit audited events rather than destructive editing of historical accepted bids.

### INV-10 — Private max/proxy values remain private
A bidder's private maximum/proxy bid value must not be exposed in public APIs, realtime payloads, browser-visible state, search documents, ordinary application logs or AI context. Only the minimum information required to execute the authoritative bidding algorithm may leave the protected boundary.

### INV-11 — Same-boundary races have deterministic resolution
Concurrent or same-millisecond bids are resolved using authoritative transaction ordering/rules, never device clocks or whichever WebSocket message a browser sees first.

## 3. Time invariants

### INV-12 — Server time is authoritative
Bid deadlines, auction start/end boundaries and late-bid extension decisions use authoritative server/database time. Browser clocks, device timezones and countdown animations are display-only.

### INV-13 — Exact boundary behavior is defined and testable
The system must have one explicit rule for whether a command arriving at the exact end boundary is accepted or rejected. That rule must be implemented in the authoritative path and covered by deterministic tests.

### INV-14 — Clock drift cannot create two truths
Schedulers, workers and realtime nodes may observe different local clocks, but only the authoritative time rule may decide winner-affecting boundaries. Recovery/finalization logic must tolerate scheduler drift without producing competing outcomes.

## 4. Auction lifecycle invariants

### INV-15 — Auction state transitions are legal and versioned
Auction lifecycle changes must follow the declared state machine. Impossible transitions are rejected server-side. Rules used for a running auction are versioned and reconstructable.

### INV-16 — Started-auction critical facts cannot silently mutate
Fields that affect bidding or winner determination and are declared immutable once an auction starts must not be silently changed. Any permitted exceptional change requires an explicit audited path and the rules defined by later frozen tasks.

### INV-17 — One authoritative finalizer per logical close
An auction can have multiple readers and retrying jobs, but there must be one logical authoritative finalization outcome. Locking/lease/fencing/idempotency must prevent two competing winners.

### INV-18 — Finalization is deterministic
Given the same canonical auction snapshot, accepted-bid history and versioned rules, finalization must produce the same result. Realtime delivery timing, client state and AI output cannot affect the winner.

### INV-19 — Final results are durable
The final result is persisted as durable canonical state/event before notifications, search, realtime or UI projections announce it as final.

### INV-20 — Exceptional reversal/void is explicit and audited
A final result may never be silently overwritten. Any supported exceptional void/reversal path must require the privileged authorization, reason/evidence and maker-checker controls specified by later frozen tasks and must preserve the original result history.

## 5. Authorization and security invariants

### INV-21 — Default deny for privileged actions
If authorization is missing, ambiguous or cannot be verified, privileged mutations are denied. UI visibility, route knowledge or possession of a public identifier is never sufficient authorization.

### INV-22 — Object scope is enforced server-side
A role that may perform an action does not automatically gain access to every vehicle, auction, organization, yard, seller, buyer or country. Object/tenant/market scope must be checked at the protected boundary.

### INV-23 — Privileged activity is attributable
Security-sensitive/admin/support/auctioneer/yard/compliance actions must produce durable evidence identifying actor, action, target, time and required reason/context.

### INV-24 — AI is never an authority principal
AI may summarize, search, translate, recommend or assist, but cannot accept a bid, select a winner, approve identity, grant privileges, bypass authorization or silently mutate canonical auction state.

## 6. Data and audit invariants

### INV-25 — Critical identifiers are stable
Canonical entities and critical events use stable identifiers. Re-rendering, reconnecting, retrying or projection rebuilds must not create new logical identities for the same canonical event/entity.

### INV-26 — Critical history is reconstructable
For any completed auction, engineering/operations must be able to reconstruct the authoritative lifecycle, rule version, accepted-bid order, finalization decision and privileged exceptions from durable records.

### INV-27 — Vehicle/document provenance is preserved
Canonical vehicle facts, inspection metadata and document/media references that influence marketplace trust must carry sufficient provenance/version information to explain their source and later change history.

### INV-28 — Logs are not the only source of truth
Transient application logs may support diagnosis but cannot be the sole evidence for an accepted bid, final result, authorization grant or canonical domain mutation.

## 7. Failure and recovery invariants

### INV-29 — Uncertainty fails closed for winner-affecting writes
If the system cannot verify authorization, auction state, rule version or authoritative transaction outcome, it must not invent a successful winner-affecting mutation. Recovery may determine the previous transaction actually committed, but must do so from authoritative state/idempotency evidence.

### INV-30 — Retry does not change logical meaning
Network retry, worker restart, deployment restart or scheduler retry must preserve the logical outcome of already-committed critical operations and must not create a second logical result.

### INV-31 — Reconnect resynchronizes from authority
After disconnect, sequence gap or suspected stale state, clients/realtime services must refetch/reconcile authoritative state rather than continue solely from their last local event.

### INV-32 — Degraded projections cannot corrupt authority
Loss or lag of Redis, search, realtime fanout, analytics, notification providers or AI services may reduce features/availability but must not alter canonical bid acceptance, ordering or finalization correctness.

### INV-33 — Failover fences stale writers
If authority moves between workers/nodes during failure recovery, the previous writer must be fenced so that two active writers cannot independently finalize or mutate winner-affecting state.

## 8. Development-status invariant

### INV-34 — GREEN requires evidence
A MASTER SYSTEM PLAN task may be GREEN only when its acceptance conditions have concrete evidence appropriate to the task (for example committed artifact/code, build/typecheck/test result, deployment/runtime/data verification). A UI color or localStorage value alone cannot make a task complete.

`public.enchev_development_events`, GitHub/Vercel checks and repository evidence may prove development/test status only. They are never authority for customer auction state.

## 9. Current implementation boundary observed for 00.04

Connected Supabase inspection on 2026-09-17 shows only `public.enchev_development_events` under the `enchev_%` table namespace. No Enchev production auction, bid, final-result, vehicle-domain or RBAC tables are currently present in the connected public schema.

Therefore these invariants are the contract later waves must implement and test; their existence must **not** be interpreted as evidence that the auction engine itself is already production-ready.

## 10. Required downstream proof mapping

Later tasks must produce executable evidence for these invariant families:

- database/integrity tasks → INV-01, INV-03, INV-07, INV-08, INV-09, INV-25, INV-26;
- identity/RBAC/security tasks → INV-05, INV-10, INV-21, INV-22, INV-23;
- auction configuration tasks → INV-06, INV-15, INV-16;
- pre-bid/max-bid tasks → INV-05 through INV-11;
- realtime tasks → INV-01, INV-04, INV-07, INV-12, INV-31, INV-32;
- finalization tasks → INV-12 through INV-20, INV-30, INV-33;
- observability/recovery/chaos tasks → INV-26, INV-28 through INV-33;
- AI tasks → INV-24;
- project governance/status tasks → INV-34.

A downstream task that violates an invariant cannot be GREEN even if its isolated happy-path test passes.

## 11. Acceptance criteria for 00.04

`00.04` may be GREEN only when:

1. this invariant registry exists in the repository under the frozen task ID without renumbering the plan;
2. it is consistent with `00.01`, `00.02` and `00.03`;
3. it explicitly covers authority, bids, ordering, server time, lifecycle/finalization, authorization, auditability, failure/recovery and AI isolation;
4. the document distinguishes contractual invariants from not-yet-built runtime components;
5. downstream proof responsibilities are mapped;
6. the exact implementation commit successfully builds/typechecks and deploys to production;
7. production HTTP/runtime verification shows no regression caused by the change;
8. GREEN evidence records exact commit/deployment results.

## 12. Evidence

Implementation commit: `e566fe6de2c9b668142cb671026e89282ece2e44`

Production verification for that exact commit:

- Vercel deployment: `dpl_4gawek1QQZDXmchB3fgsyC2R261d`;
- target: production;
- deployment state: `READY`;
- production alias includes `enchev-auctions.vercel.app`;
- Next.js optimized production build: PASS;
- TypeScript: PASS;
- static generation: 4/4 PASS;
- GitHub combined status / Vercel: `success`;
- production `https://enchev-auctions.vercel.app/`: HTTP 200;
- Vercel runtime errors in the verification window: none.

Supabase verification during the task confirmed only `public.enchev_development_events` exists under the `enchev_%` namespace; this is intentionally treated as development evidence only and not as auction runtime authority.
