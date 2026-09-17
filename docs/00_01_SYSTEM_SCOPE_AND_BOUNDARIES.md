# Enchev Auctions — 00.01 System Scope and Boundaries

Status target: MASTER SYSTEM PLAN v1.0 FROZEN task `00.01`
Execution wave: `WAVE 0 — Definition & governance`

This document defines the system boundary for Enchev Auctions without changing, renumbering, or replacing any task in `MASTER_SYSTEM_PLAN_V1_FROZEN.md` or any append-only GAP item.

## 1. Product scope

Enchev Auctions is an international vehicle-auction platform that supports the complete technical lifecycle of a vehicle lot from seller intake through publication, auction participation, authoritative bidding, close/finalization, result reconstruction, release/pickup/logistics, support/dispute handling, and operational evidence.

The platform must support, as separate but coordinated domains:

- public marketplace and vehicle discovery;
- buyer, seller, support, yard/operations and admin identities;
- vehicle records, inspection/media/document provenance and version history;
- auction configuration, pre-bid/max-bid, live bidding and finalization;
- realtime delivery with authoritative recovery after disconnects or gaps;
- notifications and provider integrations;
- release, pickup, transport and physical chain-of-custody operations;
- audit, observability, incident response, recovery and certification evidence;
- international configuration, localization, accessibility and country activation gates;
- non-authoritative AI-assisted features that cannot decide winners or alter authoritative auction state.

## 2. Authoritative boundary

Inside the authoritative auction boundary:

- PostgreSQL is the system of record for auction state, accepted bids and final results.
- Bid acceptance, eligibility validation, increment validation and ordering must execute through an authoritative server-side transaction path.
- Auction close/finalization must execute through one authoritative write-owner/path for each hot auction.
- Server time is authoritative for bid and close boundaries.
- Critical accepted-bid and result history must be durable, auditable and reconstructable.

Outside the authoritative auction boundary and therefore never sufficient by themselves to determine a winner:

- browser state and browser clocks;
- localStorage/sessionStorage;
- WebSocket/realtime messages;
- Redis/cache/pub-sub state;
- search indexes;
- notification delivery state;
- analytics or observability data;
- AI output;
- client-side countdowns, optimistic UI or animations.

These non-authoritative systems may accelerate UX and delivery, but on conflict they must resynchronize from the authoritative state.

## 3. Application/service boundary

The target system is logically separated into these capabilities, even if some are initially deployed together:

- **Web** — public marketplace, buyer/seller workspaces, admin/support/operations UI.
- **API** — authenticated application commands and queries, validation, authorization and provider orchestration.
- **Auction core** — authoritative bid acceptance, proxy/max logic, auction state transitions and finalization rules.
- **Realtime** — authenticated fanout, rooms, sequence delivery, reconnect and authoritative resync.
- **Workers** — close/finalization jobs, outbox dispatch, notifications, reconciliation, media/provider/background jobs.
- **PostgreSQL** — authoritative relational state and critical durable history.
- **Object storage** — private vehicle media/documents with controlled access and lifecycle rules.
- **Cache/queue infrastructure** — derived/non-authoritative acceleration and job/event transport.
- **External providers** — identity/KYC/KYB, email/SMS, VIN/history, transport and other country-specific providers behind replaceable provider boundaries.

## 4. Human actor boundary

Human-facing roles expected inside the product boundary:

- Buyer
- Seller
- Support
- Admin
- Yard/physical-operations staff
- Auctioneer/operator where enabled
- Organization member/delegate where enabled

Provider employees, infrastructure-vendor operators and third-party service personnel are outside the Enchev product-role model unless explicitly onboarded through a controlled privileged-access mechanism.

## 5. Trust boundaries

The following transitions are security/trust boundaries and require explicit authentication, authorization, validation and audit as applicable:

1. Public internet → Web/API
2. Browser/mobile client → authenticated API
3. Client → realtime connection/room
4. Web/API/realtime/worker → PostgreSQL
5. Application services → object storage
6. Application services → Redis/cache/queue
7. Application services → external providers
8. CI/CD → staging/production infrastructure
9. Admin/support/auctioneer/yard privileged actions → authoritative state
10. Country configuration activation → production market behavior

No client-provided role, price, bid ordering, timestamp, winner, result, release permission or privileged state is trusted without server-side verification.

## 6. Data boundary

Data managed by Enchev Auctions includes:

- account, role, session and verification state;
- seller and organization information;
- vehicle/VIN/lot, inspection, condition, media and document data;
- auction configuration and rule snapshots;
- private max-bid data;
- accepted bids and deterministic ordering data;
- final auction results;
- notification and provider-delivery metadata;
- support/dispute/release/logistics records;
- security, audit and operational evidence;
- country/locale/configuration metadata.

Secrets, passwords, provider credentials and signing keys must not be stored in public frontend code, ordinary logs, auction event payloads or user-visible evidence artifacts.

## 7. Explicitly out of scope for the authoritative core

The following must not become hidden dependencies of winner selection or bid validity:

- payment/pricing/finance logic unless separately approved by a human decision;
- ad-tech, recommendation ranking or personalization;
- AI summaries, assistants or damage suggestions;
- email/SMS delivery success;
- search-index freshness;
- client connectivity quality;
- animation state or visual lot rotation.

The MASTER tracker may contain separate tasks for these capabilities, but failure of a non-authoritative capability must not silently corrupt authoritative bid or winner state.

## 8. Environment boundary

The target lifecycle requires isolated local/development, staging and production environments. Production data, credentials, provider endpoints and privileged operations must not be reused casually in local or test execution. Production-like validation must use controlled test identities/data or an explicitly approved production pilot.

## 9. Geographic boundary

The auction core must remain country-agnostic. Country-specific differences belong in configuration/provider/legal/document profiles and activation gates. Adding a new country must not require rewriting bid ordering, close/finalization or winner-selection rules.

## 10. Failure boundary

A failure in realtime, Redis/cache, search, notifications, AI, a non-critical provider or a client connection must degrade functionality without inventing authoritative auction state. Any ambiguous client outcome must be resolved by querying/replaying authoritative server state.

Failures that can affect bid acceptance, close/finalization, authoritative persistence, authorization or critical audit integrity are critical-path failures and must fail closed or enter an explicitly designed recovery mode rather than guessing.

## Acceptance evidence for 00.01

`00.01` can be GREEN only when all of the following are true:

- this artifact exists on the repository default branch;
- the artifact preserves the FROZEN/GAP governance model;
- the repository still typechecks/builds successfully after the change;
- the GitHub-linked production deployment completes successfully;
- no contradictory implementation is discovered during the verification pass.

The commit SHA and successful Vercel deployment generated by this change are the concrete evidence for the task.
