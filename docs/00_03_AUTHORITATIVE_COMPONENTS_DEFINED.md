# Enchev Auctions — 00.03 Authoritative Components Defined

Status: GREEN — implemented, verified and backed by production evidence
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.03`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01 System scope and boundaries`, `00.02 Actors and permission map`

This document fixes the authority contract for Enchev Auctions. It defines which component is allowed to decide each class of critical state and which components are explicitly non-authoritative. It does **not** claim that the later database, bidding, realtime, identity, worker or finalization tasks are already implemented.

## 1. Core authority rule

For any critical auction fact there must be exactly one authoritative decision path. Presentation state, caches, realtime transports, search indexes, analytics, AI output and client-side storage may copy or project authoritative state, but they may not create a competing truth.

If two components disagree, the authoritative PostgreSQL-backed transaction/result path wins and every derived component must resynchronize from it.

## 2. Authority map

| Domain / decision | Authoritative component | Non-authoritative / derived components |
| --- | --- | --- |
| Auction record and lifecycle state | PostgreSQL through the server-side auction application/API transaction layer | Browser state, WebSocket payloads, Redis, search index, analytics |
| Bid acceptance or rejection | Server-side bid command handler executing one PostgreSQL transaction | Browser UI, client timestamp, WebSocket server, Redis Pub/Sub, AI |
| Bid ordering / accepted sequence | PostgreSQL persisted accepted-bid sequence/order | Arrival order at browser, network packet order, realtime delivery order |
| Max/proxy bid secret value | Private server/database path with access control | Public API responses, browser state, realtime events, search, logs |
| Eligibility at bid time | Server-side identity/eligibility policy evaluated inside the authoritative bid path | UI button state, cached profile state, client claims alone |
| Auction time boundary | Server time used by the authoritative server/database path | Browser clock, device timezone, client countdown |
| Late extension decision | Authoritative auction transaction using server time and versioned rules | Client countdown animation, WebSocket timing |
| Close/finalization | Single authoritative finalization worker/path backed by PostgreSQL locking/idempotency | Browser, cron UI, Redis, realtime process |
| Winner / final result | Durable final result derived from accepted authoritative bids and auction rules in PostgreSQL | Realtime leader display, cache, search, AI summary |
| Exceptional result override/void | Audited privileged server-side command; maker-checker where required by the frozen plan | Direct database console edits, browser-only admin state, AI |
| Vehicle canonical record | PostgreSQL domain record plus immutable/versioned provenance where required | Search index, listing card cache, CDN metadata |
| Inspection/document canonical metadata | PostgreSQL metadata/version history; object storage holds bytes, not business truth | CDN cache, browser upload state |
| Object/media bytes | Approved private object-storage object referenced by canonical database metadata | Temporary upload URL, browser File object |
| Identity session validity | Supabase Auth / configured identity provider plus server-side authorization checks | Client UI login state alone |
| Application roles and object permissions | Enchev authorization policy/RBAC layer enforced server-side and, where applicable, database RLS | Hidden buttons, route visibility, frontend role strings |
| Realtime event delivery | Transport only; events carry authoritative IDs/version/sequence but do not become truth | WebSocket clients, BroadcastChannel, browser memory |
| Cache / Redis | Acceleration, coordination or ephemeral transport only; never winner truth | Any cache consumer |
| Search index | Read/discovery projection rebuilt from canonical source | Search result state |
| Notifications | Derived messages generated from authoritative events | Email/SMS provider delivery state cannot alter auction truth |
| Audit/reconstruction | Durable authoritative event/audit records plus canonical domain state | Browser console, transient logs alone |
| AI-assisted features | Advisory/non-authoritative only | AI may not accept bids, alter winner state, approve identity, grant privileges or silently override canonical data |
| Development tracker evidence | `enchev_development_events` and Git/Vercel evidence are authoritative only for development/test status, never for customer auction state | Command Center localStorage/BroadcastChannel display |

## 3. Required authoritative write paths

The target production architecture must converge on these write paths as later frozen tasks are implemented:

### A. Auction configuration command path

`authorized operator -> server API/application service -> validation -> PostgreSQL transaction -> durable event/outbox`

Only this path may publish or mutate authoritative auction configuration. Once an auction starts, fields declared immutable by later tasks cannot be silently rewritten.

### B. Bid command path

`authenticated bidder -> server bid endpoint -> auth/eligibility -> auction-state/rule validation -> authoritative lock/isolation -> increment/order validation -> accepted bid + sequence in PostgreSQL -> commit -> outbox/realtime projection`

A bid is accepted only after the authoritative transaction commits. A client-side optimistic state or WebSocket echo is not acceptance evidence.

### C. Finalization path

`close scheduler/recovery scanner -> single authoritative finalizer -> PostgreSQL lock/lease/fencing -> deterministic result calculation -> durable final-result event -> commit -> derived notifications/realtime/search`

Finalization must be retry-safe and logically exactly-once. Duplicate jobs cannot create competing winners.

### D. Privileged exception path

`authorized privileged actor -> step-up/approval where required -> server command -> reason/evidence validation -> audited transaction -> durable exceptional event`

Direct unaudited manual mutation of accepted bids, winner state or final results is outside the supported production authority model.

## 4. Read and projection paths

The following are intentionally projections and must tolerate deletion/rebuild without losing auction truth:

- public vehicle/listing pages;
- buyer dashboards and live leader displays;
- Redis/cache state;
- WebSocket room state;
- search indexes;
- analytics/BI projections;
- notification delivery queues;
- AI summaries/recommendations;
- browser local/session state.

Every critical projection must have a defined resync/rebuild path from authoritative state in later implementation tasks.

## 5. Split-brain prevention rules

1. One hot auction may have multiple readers but only one authoritative write-owner/path for winner-affecting state.
2. Realtime nodes must never select or persist a winner independently.
3. Redis locks alone are insufficient as the final source of truth; PostgreSQL state/transactional fencing must protect critical decisions.
4. A retry after timeout must use idempotency/deduplication so an unknown client outcome cannot create a second logical bid or close result.
5. A stale replica/cache/search result must never be used for bid acceptance or winner determination.
6. Failover must fence the old writer before a new writer can become authoritative.

## 6. Server-time rule

The client may display a countdown, but the authoritative accept/reject decision uses server-side time at the authoritative command path. Client clock, locale, timezone, animation frame timing and network latency may not decide whether a bid was on time.

## 7. Supabase boundary observed during this task

Current connected Supabase inspection on 2026-09-17 shows:

- `public.enchev_development_events` exists as an Enchev development/test evidence table with RLS enabled;
- no Enchev customer auction-state, bid, winner, vehicle-domain or RBAC tables were found in the connected public schema;
- `enchev-development-status` exists as an active development-status Edge Function;
- no Enchev authoritative bidding/finalization Edge Function was found.

Therefore the connected Supabase project is **not yet evidence of a production auction authority implementation**. Later WAVE 1/2/3/5 tasks must build and verify those components before they can become GREEN.

## 8. Vercel / frontend boundary observed during this task

The current Vercel deployment serves the Next.js marketplace/Command Center frontend. The existing live-lot/countdown UI is presentation/demo behavior only unless and until it is connected to the authoritative server/database auction path defined above.

Frontend rendering, localStorage, BroadcastChannel and any automatic visual lot rotation are explicitly non-authoritative.

## 9. Acceptance criteria for 00.03

`00.03` is GREEN because all of the following were verified:

1. this authority map exists in the repository without changing frozen IDs;
2. it is consistent with the FROZEN non-negotiable invariants;
3. PostgreSQL is declared authoritative for auction state, accepted bids and final results;
4. browser/realtime/cache/search/AI are explicitly non-authoritative;
5. bid acceptance and finalization have one defined authoritative server-side path;
6. server time is authoritative;
7. current implementation gaps are stated rather than falsely marked complete;
8. the implementation commit built/typechecked and reached production successfully;
9. production runtime check showed no new runtime errors caused by the change.

## 10. Evidence

Implementation commit: `2e5a17cb10fef4ca52a4fd52feba3b37449088e8` (`docs: define 00.03 authoritative components`).

Verified production deployment: `dpl_9Dy2VGZfvPz25pxxRK5AouthiqHZ`.

Verification results:

- Vercel production state: `READY`;
- GitHub commit status / Vercel context: `success`;
- Next.js 16.3.5 production build: compiled successfully;
- TypeScript check: finished successfully;
- static generation: 4/4 pages generated successfully;
- deployment alias includes `enchev-auctions.vercel.app`;
- production root request: HTTP `200 OK`;
- Vercel runtime errors in the verification window: none found.

Supabase inspection evidence used for the boundary statement:

- `public.enchev_development_events`: present, RLS enabled;
- `enchev-development-status`: active Edge Function;
- no Enchev authoritative auction/bid/finalization tables or Edge Functions observed in the connected project at verification time.
