# Enchev Auctions — 00.07 Data Classification Model

Status: YELLOW — classification contract committed; production verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.07`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.06`

This document defines the classification model that later Enchev Auctions schemas, APIs, logs, object storage, realtime events, support tooling, analytics and AI features must use. It is a governance/source-of-truth contract; it does not claim that all listed future data already exists in production.

This task does not add pricing, payment or finance scope.

## 1. Classification dimensions

Every durable or transmitted data element must eventually carry two independent decisions:

1. **Sensitivity class** — who may see/use the data and what protection level is required.
2. **Authority class** — whether the data is authoritative auction truth, a derived projection, development evidence or presentation/demo data.

Sensitivity alone must never be used to decide auction authority.

## 2. Sensitivity classes

### DC-0 — PUBLIC
Information intentionally safe for unauthenticated public disclosure.

Examples:
- published vehicle marketing fields intended for the listing;
- public lot number;
- public auction schedule/state intended for the marketplace;
- public seller/dealer display identity where explicitly approved for display;
- public help/legal content after the relevant legal tasks approve it.

Minimum rules:
- may be cached/indexed publicly when the owning feature permits it;
- must still preserve integrity and provenance;
- public does not mean editable by the public.

### DC-1 — INTERNAL
Operational or engineering data not intended for ordinary customer disclosure, but not itself a secret credential or high-impact personal/auction value.

Examples:
- internal service health state;
- non-sensitive feature/config identifiers;
- engineering deployment metadata;
- sanitized diagnostic metadata;
- Command Center development evidence that contains no customer payloads.

Minimum rules:
- authenticated/authorized staff or service access only where applicable;
- no accidental public indexing;
- logs/telemetry must remain sanitized.

### DC-2 — CONFIDENTIAL
Personal, customer, seller, support, vehicle-history or business information where unauthorized disclosure can harm a person, account, dispute, or marketplace participant.

Examples:
- names, email addresses, telephone numbers, addresses;
- account profile and organization membership data;
- seller private contact details;
- vehicle ownership/supporting documents that are not public listing content;
- non-public inspection evidence;
- support tickets, complaints and dispute material;
- internal moderation/review notes;
- IP/device/session metadata when tied to an identifiable user;
- non-public transport/release records.

Minimum rules:
- server-side authorization and object scope;
- encrypted transport;
- storage access restricted by least privilege;
- no unrestricted browser persistence;
- no public search indexing;
- logging must redact/minimize personal content;
- retention/deletion rules are owned by Phase 29 and legal tasks, not invented here.

### DC-3 — RESTRICTED / CRITICAL
Secrets, identity-verification evidence, private bid strategy, privileged security data or winner-affecting information whose disclosure or mutation can directly compromise accounts, auction fairness, compliance or system authority.

Examples:
- passwords, password reset secrets, refresh/session tokens and API/provider secrets;
- MFA secrets/recovery material;
- KYC/KYB identity documents and verification artifacts;
- private Max Bid / proxy-bid values;
- signing keys, webhook secrets and privileged service credentials;
- security incident evidence containing secrets;
- high-risk admin authorization artifacts;
- database/service credentials;
- unreleased vulnerability details.

Minimum rules:
- default deny and least privilege;
- never exposed through ordinary public API/realtime/search/analytics payloads;
- never stored in browser `localStorage`;
- encrypted in transit and protected at rest using the capabilities of the selected production platform;
- access must be attributable/auditable where practical;
- secrets must support rotation/revocation;
- logs must not contain raw values;
- AI systems must not receive these values unless a later explicitly reviewed feature proves necessity and controls.

## 3. Authority classes

### A0 — AUTHORITATIVE CRITICAL TRUTH
Canonical state that can affect accepted bids, auction lifecycle, eligibility decisions, close/finalization, immutable evidence or privileged overrides.

Examples planned by the FROZEN architecture:
- accepted bid records and accepted-bid sequence;
- authoritative auction state/transitions;
- rule/version snapshot used by an auction;
- immutable vehicle snapshot used at auction start;
- final result/winner event;
- privileged void/reversal audit event;
- eligibility decision used to accept/reject a bid.

Rules:
- only the authoritative server/database path defined by `00.03` may create/mutate it;
- browser state, cache, realtime delivery, search, analytics and AI cannot become authority;
- changes require durable audit/reconstruction evidence according to later phases.

### A1 — AUTHORITATIVE BUSINESS RECORD
Canonical non-winner state such as account profile, vehicle record, inspection version, publication state, support/dispute record or release/logistics state after the relevant feature is implemented.

Rules:
- server-side authorization;
- explicit provenance/versioning where required;
- may feed derived projections but remains the source record.

### A2 — DERIVED / PROJECTION DATA
Rebuildable or cache-like representations.

Examples:
- search index;
- analytics aggregate;
- notification projection;
- realtime UI snapshot/delta;
- cached listing view;
- AI summary/recommendation;
- frontend countdown/display state.

Rules:
- must never override A0/A1;
- stale/missing data must be recoverable from authoritative sources where applicable;
- if a user-facing projection conflicts with authority, authority wins.

### A3 — DEVELOPMENT EVIDENCE
Engineering/test/deployment evidence proving development state, not customer auction truth.

Observed current example:
- `public.enchev_development_events` in the connected Supabase project.

Its observed columns are `id`, `commit_sha`, `branch`, `run_id`, `run_attempt`, `test_id`, `status`, `started_at`, `occurred_at`, `duration_ms`, and `deployment_url`.

Rules:
- can prove build/test/deployment activity;
- cannot decide bids, eligibility, vehicle truth or winners;
- should contain no customer payloads or secrets.

### A4 — PRESENTATION / DEMO
Static or simulated content used for UI development and demonstration.

Observed current examples:
- hard-coded sample vehicle cards;
- browser-only auction rotation/demo logic;
- Unsplash sample vehicle imagery;
- local Command Center state.

Rules:
- never represented as production auction truth;
- must not be migrated into authoritative data without validation/provenance.

## 4. Domain classification matrix

| Data family | Default sensitivity | Authority target | Notes |
| --- | --- | --- | --- |
| Public vehicle listing fields | DC-0 | A1 with A2 public projection | Public only after publish/review rules |
| VIN / title / odometer / history details | DC-1/DC-2 depending field/source | A1 | Provenance required; not all source documents are public |
| Vehicle media for public listing | DC-0 after approval | A1/A2 | Raw/unapproved media may be DC-1/DC-2 |
| Inspection raw evidence | DC-2 | A1 | Public subset may later be projected as DC-0 |
| Account identity/contact | DC-2 | A1 | Object-scoped access |
| Authentication/session material | DC-3 | A1/security authority | Never public/realtime/search/logged raw |
| KYC/KYB evidence | DC-3 | A1/compliance authority | Access tightly scoped; provider-specific later |
| Eligibility decision | DC-2 | A0 | Decision used by bid path is winner-sensitive |
| Private Max Bid/proxy value | DC-3 | A0 | Explicit invariant: never exposed publicly |
| Accepted bid amount/order | DC-1/DC-2 while auction active; public visibility only by rule | A0 | Canonical ordering is authoritative |
| Auction rules/version snapshot | DC-0/DC-1 | A0 | Public post-close visibility may be allowed later |
| Final result/winner | DC-1/DC-2 internally; public subset by rule | A0 | Immutable result evidence |
| Admin privileged actions | DC-2/DC-3 | A0/A1 | Actor/reason/audit required |
| Support/complaint/dispute evidence | DC-2; DC-3 if it contains secrets/identity docs | A1 | Evidence freeze rules later |
| Release/pickup authorization | DC-3 while valid | A1 | Single-use/abuse controls later |
| Logs/traces/metrics | DC-1 by default | A2 | Must redact DC-2/DC-3 payloads |
| Search index | Maximum DC-0 plus explicitly approved non-sensitive fields | A2 | No secrets/private max/customer private data |
| Analytics | DC-1; aggregated/anonymized outputs may be DC-0 | A2 | Minimize identifiable fields |
| AI prompts/outputs | DC-1/DC-2 depending source | A2 | AI is non-authoritative; DC-3 denied by default |
| Development evidence | DC-1 | A3 | Current Supabase Enchev use |
| Demo/sample vehicle data | DC-0 | A4 | Must remain distinguishable from real listings |

## 5. Transformation rules

Classification follows the most sensitive source unless a controlled transformation demonstrably removes that sensitivity.

Examples:
- DC-3 identity document → extracted verification status may become DC-2, but the raw document remains DC-3;
- DC-2 support case → aggregate count may become DC-1 or DC-0 if truly non-identifying;
- A0 accepted bid history → UI event is A2 even if it displays an allowed public subset;
- public listing projection is A2; the reviewed vehicle/listing record remains A1.

Redaction, hashing, tokenization or aggregation must not be assumed to anonymize data without later verification.

## 6. Logging and telemetry rule

Production logs, traces, metrics and development evidence must be designed to record identifiers/correlation metadata rather than raw confidential content.

Never log raw:
- passwords/tokens/API keys/secrets;
- private Max Bid values except in the protected authoritative store where required by the bidding engine;
- KYC/KYB document bodies;
- full sensitive support/identity documents;
- privileged credentials.

If a downstream debugging task needs sensitive payload inspection, it requires an explicitly scoped secure workflow rather than ordinary logs.

## 7. Browser, realtime and cache rule

The browser and derived delivery layers are lower-trust projections.

- `localStorage` must not contain DC-3 data.
- Realtime events must expose only the minimum fields required by the subscriber.
- Search/cache/analytics may not receive private Max Bid, secrets or raw identity verification artifacts.
- client-side timers/state are never A0 authority.
- reconnect/resync must return to authoritative server state.

## 8. AI handling rule

AI is A2 by definition in the current architecture.

Default handling:
- DC-0: allowed when the feature permits it;
- DC-1: allowed only for a defined internal purpose;
- DC-2: minimize/redact and require feature-specific authorization/provenance controls;
- DC-3: denied by default.

AI output never overwrites A0/A1 truth without the explicit validated human/server workflow owned by a later task.

## 9. Current observed state — 2026-09-17

Connected evidence at implementation time shows:

- `main` had advanced beyond the earlier `00.06` state because DAVID/local-monitor tooling continued to land additive commits;
- the active Vercel production project is `enchev-auctions` and recent production deployments are READY;
- the earlier Vercel build-rate-limit blocker has cleared because new builds are succeeding again;
- connected Supabase project `soulflame-twins` is shared with other applications;
- the only `public` table matching `enchev%` is `public.enchev_development_events`;
- no Enchev customer auction/bid/vehicle/RBAC domain tables have been proven in the connected Supabase project;
- current marketplace cards and client-side bid/countdown demonstrations are A4/A2, not authoritative auction data.

Therefore this task establishes the classification contract before production domain data is introduced.

## 10. Ownership boundaries with later FROZEN tasks

This model deliberately does not close downstream implementation work:

- Phase 03 implements database durability/integrity/RLS;
- Phase 04/05 implement identity, RBAC, KYC/KYB and eligibility;
- Phase 06/34 implement vehicle/inspection data and provenance;
- Phase 09–11 implement authoritative bid/realtime/finalization paths;
- Phase 16 implements security hardening and secret controls;
- Phase 17 implements observability/recovery;
- Phase 29 implements system-wide inventory, minimization, retention, deletion/anonymization, export, legal-hold and data-flow engineering;
- Phase 37 implements reconstruction/evidence preservation;
- legal/privacy notices and jurisdiction-specific obligations remain owned by their legal/global tasks and require their own sign-off.

## 11. Acceptance criteria for 00.07

`00.07` may be GREEN only when:

1. sensitivity classes and authority classes are explicitly defined;
2. critical Enchev data families are mapped to default classes;
3. private Max Bid, credentials and identity verification evidence receive the highest protection class;
4. logging/browser/realtime/cache/AI handling rules are defined;
5. current Supabase development evidence is distinguished from customer auction authority;
6. current demo/browser auction data is explicitly non-authoritative;
7. downstream retention/legal/security implementation is not falsely marked complete;
8. no pricing/payment/finance scope is added;
9. the exact implementation commit builds/typechecks and deploys successfully;
10. production HTTP/runtime verification shows no regression;
11. GREEN evidence records exact commit/deployment results.

## 12. Evidence

Pending verification for the implementation commit. After successful build/typecheck/deployment/runtime validation, this document will be updated to `Status: GREEN` with exact evidence.
