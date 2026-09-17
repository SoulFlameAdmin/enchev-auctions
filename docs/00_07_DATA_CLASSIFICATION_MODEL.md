# Enchev Auctions — 00.07 Data Classification Model

Status: GREEN — classification contract implemented and verified with descendant production evidence
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.07`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.06`

This document defines the classification model that later Enchev Auctions schemas, APIs, logs, object storage, realtime events, support tooling, analytics and AI features must use. It is a governance/source-of-truth contract; it does not claim that all listed future data already exists in production.

This task does not add pricing, payment or finance scope.

## 1. Classification dimensions

Every durable or transmitted data element must carry two independent decisions:

1. **Sensitivity class** — who may see/use the data and what protection level is required.
2. **Authority class** — whether the data is authoritative auction truth, a canonical business record, a derived projection, development evidence or presentation/demo data.

Sensitivity alone must never be used to decide auction authority.

## 2. Sensitivity classes

### DC-0 — PUBLIC
Information intentionally safe for unauthenticated public disclosure.

Examples:
- approved public vehicle listing fields;
- public lot number;
- public auction schedule/state intended for the marketplace;
- public seller/dealer display identity where explicitly approved;
- approved public help/legal content.

Rules:
- may be publicly cached/indexed only when the owning feature permits it;
- integrity and provenance still apply;
- public does not mean publicly editable.

### DC-1 — INTERNAL
Operational or engineering information not intended for ordinary customer disclosure and not itself a secret or high-impact personal value.

Examples:
- service health state;
- non-sensitive feature/config identifiers;
- engineering deployment metadata;
- sanitized diagnostics;
- Command Center evidence without customer payloads.

Rules:
- staff/service access only where applicable;
- no accidental public indexing;
- telemetry must remain sanitized.

### DC-2 — CONFIDENTIAL
Personal, customer, seller, support, vehicle-history or operational information where unauthorized disclosure can harm a person, account, dispute or marketplace participant.

Examples:
- names, email addresses, telephone numbers, addresses;
- account profiles and organization membership;
- seller private contact details;
- non-public vehicle ownership/supporting documents;
- non-public inspection evidence;
- support tickets, complaints and dispute material;
- moderation/review notes;
- IP/device/session metadata tied to an identifiable user;
- non-public transport/release records.

Rules:
- server-side authorization and object scope;
- encrypted transport;
- least-privilege storage access;
- no unrestricted browser persistence;
- no public search indexing;
- logs must redact/minimize personal content;
- retention/deletion policy is owned by Phase 29 and legal tasks.

### DC-3 — RESTRICTED / CRITICAL
Secrets, identity-verification evidence, private bid strategy, privileged security data or winner-affecting information whose disclosure or mutation can compromise accounts, auction fairness, compliance or system authority.

Examples:
- passwords, reset secrets, refresh/session tokens and provider/API secrets;
- MFA secrets/recovery material;
- KYC/KYB identity documents and verification artifacts;
- private Max Bid / proxy-bid values;
- signing keys, webhook secrets and privileged service credentials;
- high-risk security/admin authorization artifacts;
- database/service credentials;
- unreleased vulnerability details.

Rules:
- default deny and least privilege;
- never exposed through ordinary public API/realtime/search/analytics payloads;
- never stored in browser `localStorage`;
- protected in transit and at rest using the selected production platform controls;
- access attributable/auditable where practical;
- secrets support rotation/revocation;
- logs must never contain raw values;
- AI access denied by default unless a later reviewed feature proves necessity and controls.

## 3. Authority classes

### A0 — AUTHORITATIVE CRITICAL TRUTH
Canonical state that can affect accepted bids, auction lifecycle, eligibility, close/finalization, immutable evidence or privileged overrides.

Examples planned by the FROZEN architecture:
- accepted bid records and accepted-bid sequence;
- authoritative auction state/transitions;
- auction rule/version snapshot;
- immutable vehicle snapshot used at auction start;
- final result/winner event;
- privileged void/reversal audit event;
- eligibility decision used to accept/reject a bid.

Rules:
- only the authoritative server/database path defined by `00.03` may create or mutate A0;
- browser state, cache, realtime delivery, search, analytics and AI can never become authority;
- critical changes require durable audit/reconstruction evidence according to later phases.

### A1 — AUTHORITATIVE BUSINESS RECORD
Canonical non-winner state such as account profile, vehicle record, inspection version, publication state, support/dispute record or release/logistics state after the relevant feature exists.

Rules:
- server-side authorization;
- explicit provenance/versioning where required;
- derived views may be rebuilt from A1.

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
- if projection and authority disagree, authority wins;
- stale/missing data must be recoverable from authority where applicable.

### A3 — DEVELOPMENT EVIDENCE
Engineering/test/deployment evidence proving development state, not customer auction truth.

Observed current example:
- `public.enchev_development_events` in the connected Supabase project.

Observed columns:
`id`, `commit_sha`, `branch`, `run_id`, `run_attempt`, `test_id`, `status`, `started_at`, `occurred_at`, `duration_ms`, `deployment_url`.

Rules:
- may prove build/test/deployment activity;
- cannot decide bids, eligibility, vehicle truth or winners;
- should contain no customer payloads or secrets.

### A4 — PRESENTATION / DEMO
Static or simulated content used for UI development/demonstration.

Observed current examples:
- sample vehicle cards;
- browser-only auction/countdown demonstrations;
- Unsplash sample imagery;
- local Command Center state.

Rules:
- never represented as production auction truth;
- must not be promoted into authority without validation and provenance.

## 4. Domain classification matrix

| Data family | Default sensitivity | Authority target | Notes |
| --- | --- | --- | --- |
| Public vehicle listing fields | DC-0 | A1 with A2 public projection | Public only after publish/review rules |
| VIN/title/odometer/history details | DC-1/DC-2 depending field/source | A1 | Provenance required |
| Vehicle media for public listing | DC-0 after approval | A1/A2 | Raw/unapproved media may be DC-1/DC-2 |
| Inspection raw evidence | DC-2 | A1 | Public subset may later be projected as DC-0 |
| Account identity/contact | DC-2 | A1 | Object-scoped access |
| Authentication/session material | DC-3 | A1/security authority | Never public/realtime/search/logged raw |
| KYC/KYB evidence | DC-3 | A1/compliance authority | Tightly scoped |
| Eligibility decision | DC-2 | A0 | Bid-path decision is winner-sensitive |
| Private Max Bid/proxy value | DC-3 | A0 | Never exposed publicly |
| Accepted bid amount/order | DC-1/DC-2 while active | A0 | Canonical ordering is authoritative |
| Auction rules/version snapshot | DC-0/DC-1 | A0 | Visibility policy decided later |
| Final result/winner | DC-1/DC-2 internally | A0 | Immutable result evidence |
| Admin privileged actions | DC-2/DC-3 | A0/A1 | Actor/reason/audit required |
| Support/complaint/dispute evidence | DC-2; DC-3 if identity/secrets included | A1 | Evidence-freeze rules later |
| Release/pickup authorization | DC-3 while valid | A1 | Single-use/abuse controls later |
| Logs/traces/metrics | DC-1 by default | A2 | Redact DC-2/DC-3 payloads |
| Search index | DC-0 + explicitly approved non-sensitive fields | A2 | Never private Max Bid/secrets/raw identity docs |
| Analytics | DC-1; aggregates may become DC-0 if non-identifying | A2 | Minimize identifiable fields |
| AI prompts/outputs | DC-1/DC-2 depending source | A2 | AI non-authoritative; DC-3 denied by default |
| Development evidence | DC-1 | A3 | Current Supabase Enchev use |
| Demo/sample vehicle data | DC-0 | A4 | Must remain distinguishable from real listings |

## 5. Transformation rules

Classification follows the most sensitive source unless a controlled transformation demonstrably removes sensitivity.

Examples:
- DC-3 identity document → extracted verification status may be DC-2 while the raw document stays DC-3;
- DC-2 support case → aggregate count may become DC-1/DC-0 only if truly non-identifying;
- A0 accepted-bid history → UI event is A2 even if it displays an allowed subset;
- public listing projection is A2 while the reviewed source record remains A1.

Redaction, hashing, tokenization or aggregation must not be assumed to anonymize data without later verification.

## 6. Logging and telemetry

Never log raw:
- passwords/tokens/API keys/secrets;
- private Max Bid values outside the protected authoritative store;
- KYC/KYB document bodies;
- sensitive support/identity documents;
- privileged credentials.

Use identifiers/correlation metadata instead of raw confidential payloads wherever possible.

## 7. Browser, realtime and cache

- `localStorage` must not contain DC-3 data.
- realtime events expose only minimum required fields;
- search/cache/analytics may not receive private Max Bid, secrets or raw identity-verification artifacts;
- client-side timers/state are never A0 authority;
- reconnect/resync must return to authoritative server state.

## 8. AI handling

AI is A2 by definition in the current architecture.

Default handling:
- DC-0: allowed where the feature permits it;
- DC-1: allowed only for a defined internal purpose;
- DC-2: minimize/redact and require feature-specific authorization/provenance controls;
- DC-3: denied by default.

AI output never overwrites A0/A1 truth without an explicit validated human/server workflow owned by a later task.

## 9. Current observed state — 2026-09-17

Connected evidence shows:
- active production project: `enchev-auctions` on Vercel;
- connected Supabase project `soulflame-twins` is shared with other applications;
- only `public` table matching `enchev%`: `public.enchev_development_events`;
- no Enchev production auction/bid/vehicle/RBAC domain tables have been proven in the connected Supabase project;
- marketplace cards and client-side bid/countdown demonstrations are A4/A2, not authoritative auction data.

## 10. Ownership boundaries with later FROZEN tasks

This model does not falsely close downstream work:
- Phase 03: database durability/integrity/RLS;
- Phase 04/05: identity, RBAC, KYC/KYB, eligibility;
- Phase 06/34: vehicle/inspection data and provenance;
- Phase 09–11: authoritative bid/realtime/finalization;
- Phase 16: security hardening and secret controls;
- Phase 17: observability/recovery;
- Phase 29: full data inventory, minimization, retention, deletion/anonymization, export, legal hold and data flows;
- Phase 37: reconstruction/evidence preservation;
- legal/privacy/jurisdiction obligations remain in their legal/global tasks.

## 11. Acceptance criteria

`00.07` is GREEN because:
1. sensitivity and authority classes are explicit;
2. critical Enchev data families are mapped;
3. private Max Bid, credentials and identity-verification evidence receive highest protection;
4. logging/browser/realtime/cache/AI handling rules are defined;
5. Supabase development evidence is distinguished from customer auction authority;
6. current demo/browser auction data is explicitly non-authoritative;
7. downstream retention/legal/security work remains open;
8. no pricing/payment/finance scope was added;
9. the implementation content is present unchanged in a later descendant commit that successfully compiled, typechecked and deployed to production;
10. production HTTP/runtime verification shows no regression;
11. exact evidence is recorded below.

## 12. Evidence

Original implementation commit:
- `1561969541ca082008d26266464ca7c184ca1e3f`
- its immediate Vercel check failed only because of `build-rate-limit`; no code/build failure was produced for the document itself.

Verified descendant production commit:
- `e76a4e84bb43281a7891a89dc24eca49c6435a71`
- GitHub compare proves it is 3 commits ahead of `1561969541ca082008d26266464ca7c184ca1e3f`, so it contains the 00.07 implementation.
- Vercel deployment: `dpl_8mVzSYNxUY6PicgULaEgvcYHhQ4t`
- target: production
- state: READY
- Next.js compile: PASS
- TypeScript: PASS
- static generation: 4/4 PASS
- GitHub Vercel status: success
- production root: HTTP 200
- runtime errors in verification window: 0

Supabase check:
- no Enchev customer-domain tables were used as evidence;
- `public.enchev_development_events` remains engineering evidence only.
