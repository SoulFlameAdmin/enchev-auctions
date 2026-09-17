# Enchev Auctions — 00.10 Final Production Acceptance Criteria

Status: YELLOW — final acceptance contract committed; verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.10`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.09`

This document defines the **final production go/no-go acceptance contract** for Enchev Auctions. It defines the evidence that must exist before the system can later be declared production-ready by `47 — FINAL SYSTEM ACCEPTANCE`.

**Important:** GREEN for `00.10` means this acceptance contract is complete and verified as a governance artifact. It does **not** mean the Enchev Auctions platform itself is already production-ready.

This task does not add commercial, billing or finance scope to the tracker.

## 1. Final-acceptance principle

Production acceptance is an evidence-backed release decision, not a visual status, demo, successful page load or verbal approval.

The final system may be accepted only when:

1. every required FROZEN task that feeds final acceptance is GREEN with valid evidence;
2. the exact release candidate is identified immutably;
3. the release candidate has passed all applicable functional, security, correctness, reliability, operational and recovery gates;
4. no unresolved blocker contradicts production readiness;
5. production infrastructure and authoritative data paths are proven, not inferred from demo/projection behavior;
6. rollback/recovery and incident ownership are proven before go-live;
7. the final evidence bundle is traceable to the exact code/schema/configuration being released.

## 2. Release identity gate

Every final acceptance decision must identify one immutable release candidate.

Minimum release manifest:

- Git commit SHA/tag;
- repository and branch/ref;
- build/CI run IDs;
- production deployment ID and environment;
- database migration/version set;
- application/runtime version where applicable;
- infrastructure/config version references where applicable;
- enabled feature flags relevant to acceptance;
- external-provider integration versions/configuration identifiers where applicable;
- evidence timestamp and acceptance owner(s).

A release cannot be accepted against “latest”, an unpinned branch state, or a deployment whose source commit cannot be proven.

## 3. MASTER SYSTEM PLAN completion gate

Before final production acceptance:

- all required predecessor phases/tasks must satisfy `00.09 Definition of GREEN Acceptance`;
- no required task may remain RED;
- no required task may remain YELLOW;
- no known blocker may be hidden by a GREEN UI label;
- append-only GAP tasks introduced under the FROZEN process must be resolved according to their dependency/acceptance requirements;
- Phase 47 cannot waive missing evidence from earlier tasks.

Any dependency needed by the release but not represented in the plan must be recorded through the append-only GAP process before final acceptance.

## 4. Authoritative auction-core gate

The release must prove the winner-affecting authority path end to end.

Required evidence includes, where applicable:

- PostgreSQL-backed authoritative auction state;
- one defined authoritative critical write path;
- atomic bid acceptance;
- deterministic durable bid ordering/sequence;
- server-side validation of bidder/object/rule eligibility;
- authoritative server/database time for deadline decisions;
- private max/proxy-bid handling with no unintended public exposure;
- idempotent handling of ambiguous retries/timeouts;
- concurrency tests for competing bids;
- duplicate-request tests;
- exact boundary tests around auction close;
- retry-safe/logically exactly-once finalization;
- one canonical final result;
- stale-writer/split-brain prevention;
- auditable privileged overrides;
- reconstruction of an auction result from authoritative evidence.

A browser timer, local state, cache, WebSocket message or UI animation can never satisfy this gate.

## 5. Identity, authorization and privilege gate

Production acceptance requires proof that authorization is enforced server-side and follows the actor/permission model.

Required evidence includes, where applicable:

- authenticated session behavior;
- role/permission enforcement;
- object-level authorization;
- default-deny behavior for unsupported privilege;
- positive and negative authorization tests;
- privileged/admin action auditability;
- maker-checker/dual-control tests for actions that require it;
- session expiry/revocation behavior;
- failed identity/provider checks do not grant privilege;
- no privileged production secret is exposed to browser/public repository/logs.

## 6. Data integrity, classification and privacy gate

The production data model must satisfy the classifications from `00.07` and the authority contracts from `00.03`/`00.04`.

Required evidence includes, where applicable:

- intended production schema and migration history;
- field-level handling consistent with data classification;
- restricted values excluded from public payloads/search/cache/realtime/logs by default;
- RLS/server authorization where applicable;
- encrypted transport;
- production-secret handling;
- backup copies inheriting data classification;
- masked/synthetic non-production data policy where required;
- export/support access controls and auditability;
- data lineage/provenance for critical records;
- integrity checks for canonical auction and vehicle records.

## 7. Realtime and client-consistency gate

The client must remain correct when realtime delivery is imperfect.

Required evidence includes, where applicable:

- realtime messages are projections, not authority;
- reconnect behavior;
- sequence/version gap detection;
- authoritative resync after a gap;
- stale-state handling in the UI;
- duplicate/reordered event tolerance;
- multiple-tab duplicate-action protection;
- browser sleep/reload recovery;
- countdown display reconciles to authoritative time/state;
- a disconnected client cannot manufacture accepted state locally.

## 8. Failure, recovery and resilience gate

The assumptions defined by `00.08` must have executable proof in the owning later phases.

Required evidence includes, where applicable:

- network timeout / ambiguous-outcome tests;
- process crash-and-retry tests;
- transaction conflict/deadlock behavior;
- authoritative database outage behavior;
- cache/search/realtime outage behavior;
- outbox/consumer replay behavior;
- external-provider outage behavior;
- overload/retry-storm behavior;
- finalizer duplicate execution tests;
- stale-writer/failover fencing;
- backup/restore drill;
- disaster/failover drill when required by the NFR/DR plan;
- reconciliation procedure after partial failure.

Critical correctness must fail closed when authority cannot be proven.

## 9. Performance and capacity gate

The release must meet the approved non-functional requirements under representative load.

Evidence may include:

- load test results;
- concurrency test results;
- latency percentiles for critical operations;
- throughput/capacity measurements;
- database connection/resource behavior;
- hot-auction burst behavior;
- retry-storm protection;
- cache/realtime fan-out behavior;
- browser performance for supported client classes;
- resource/quota headroom appropriate to the defined operating target.

Passing an idle smoke test is not performance evidence.

## 10. Observability and operations gate

Operations must be able to detect, diagnose and own production failures.

Required evidence includes, where applicable:

- structured application/runtime logs;
- critical transaction identifiers/traceability;
- metrics for success/failure/latency/queue lag;
- alerts for critical failure conditions;
- dashboard/telemetry ownership;
- alert test/firing evidence;
- operational runbooks;
- escalation/incident ownership;
- audit trail availability;
- deployment/release traceability;
- monitoring that distinguishes projection failure from authority failure.

## 11. Deployment, migration and rollback gate

The exact release candidate must have a reproducible and recoverable deployment path.

Required evidence includes, where applicable:

- clean CI build/typecheck/tests for the release candidate;
- successful production deployment containing the accepted commit;
- schema compatibility/migration verification;
- mixed-version rollout safety where needed;
- no failed migration left partially authoritative;
- rollback or forward-fix procedure;
- rollback candidate/evidence where applicable;
- post-deployment smoke checks;
- production HTTP/route/runtime verification;
- no known blocking runtime error after deployment.

A previous READY deployment does not prove a newer release candidate.

## 12. Frontend and critical user-flow gate

Representative end-to-end flows must work against the intended production authority path.

The applicable suite must cover, at minimum:

- account/session entry flows;
- inventory discovery/list/detail flows;
- auction-state viewing;
- bid submission and confirmed result behavior;
- timeout/retry/reload behavior;
- final result visibility;
- privileged/admin operational flows;
- transport/document/status flows that are in production scope;
- error/degraded-state presentation;
- supported mobile/desktop responsive behavior.

Demo-only flows must be clearly excluded from accepted production capability.

## 13. Accessibility, browser and device gate

Production acceptance requires the supported experience matrix to be explicit and tested.

Evidence should include, where applicable:

- supported browser/version matrix;
- supported viewport/device matrix;
- keyboard navigation for critical flows;
- focus/error-state behavior;
- accessible naming/semantics for critical controls;
- contrast/readability checks;
- mobile/responsive verification;
- no critical flow dependent on unsupported browser-local state.

## 14. Localization and country-expansion gate

The accepted release must not hard-code assumptions that prevent the approved geographic scope.

Evidence should include, where applicable:

- locale/language handling;
- timezone/date/time behavior;
- units/country-specific presentation rules;
- country configuration boundaries;
- server-side authoritative time independent of client locale;
- country expansion without rewriting auction-core authority logic.

## 15. External integration gate

Any external integration included in the release must have environment-appropriate evidence.

Required evidence may include:

- authenticated callback/webhook verification;
- idempotency/retry behavior;
- timeout/degraded behavior;
- provider sandbox/production confirmation where required;
- secret handling and least privilege;
- no provider becoming accidental auction authority;
- provider outage not corrupting canonical auction state.

Mock evidence alone is insufficient when the owning task requires real provider integration.

## 16. Security release gate

Production acceptance is blocked by any unresolved security condition that directly invalidates the release requirements.

The applicable evidence set includes:

- authorization abuse tests;
- RLS/policy tests;
- dependency/security scans;
- secret exposure checks;
- rate-limit/abuse controls;
- input validation tests;
- auditability of privileged actions;
- vulnerability/penetration testing when required by the owning phase;
- explicit handling of accepted security exceptions by the authorized owning task/process.

A finding in an unrelated shared system must be recorded appropriately but must not be silently modified as a shortcut to Enchev acceptance.

## 17. Production-environment isolation gate

The accepted production authority environment must have an explicit boundary from unrelated development systems.

Before final acceptance, evidence must prove:

- which database/project is production authority;
- which storage/project is production authority;
- which deployment/project/domain is production;
- environment/secrets separation;
- development evidence systems cannot mutate production auction truth;
- local DAVID/ChatGPT/browser tooling is not part of the authoritative runtime;
- unrelated SoulFlame/Zorbas/DAVID data/functions cannot become Enchev authority by co-location alone.

## 18. Production data and migration readiness gate

Before opening critical production writes:

- intended production schema exists and is versioned;
- required migrations are applied and verified;
- initial/reference data is controlled and auditable;
- test/demo records are distinguishable or excluded as required;
- no hard-coded demo auction state is mistaken for canonical production state;
- backup/restore baseline exists before accepting irreversible critical history;
- reconciliation tools/processes exist for critical authority paths.

## 19. Release smoke and post-deploy verification gate

Immediately before and after go-live, the release checklist must verify the exact deployment.

Minimum post-deploy checks include, where applicable:

- canonical domain resolves and returns expected HTTP status;
- critical public routes load;
- authenticated critical flows work;
- authoritative DB connectivity is correct;
- bid/finalization canary or controlled production-safe verification as defined by later phases;
- no new blocking runtime error clusters;
- realtime connection/resync works;
- telemetry/alerts receive production signals;
- deployment commit matches release manifest.

## 20. NO-GO rules

Final production acceptance is **NO-GO** if any of the following applies:

- a required FROZEN task is RED/YELLOW;
- release commit/deployment cannot be identified exactly;
- build/typecheck/applicable tests fail;
- authoritative auction core has unproven correctness invariants;
- critical authorization can be bypassed;
- restricted data is exposed through an unintended public path;
- unresolved migration/schema ambiguity can affect critical writes;
- backup/restore/failover evidence required by the approved NFR plan is missing;
- rollback/forward-fix is not possible for a risky release;
- production has a blocking runtime error;
- a known critical security defect directly invalidates an acceptance gate;
- a required human/provider/legal/security approval owned by another phase is absent;
- evidence refers to a different commit/environment than the release candidate;
- final acceptance would rely on localStorage/UI status instead of authoritative evidence.

No single approver, automation or UI control may silently override these NO-GO rules.

## 21. Final evidence bundle

Phase 47 must assemble a release evidence bundle containing references to the applicable proof, including:

- release manifest;
- FROZEN/GAP completion snapshot;
- CI/test reports;
- production deployment proof;
- database/schema/migration proof;
- auction-core correctness/concurrency evidence;
- security evidence;
- load/performance evidence;
- recovery/restore/failover evidence;
- observability/alert evidence;
- critical end-to-end flow evidence;
- provider evidence where applicable;
- required authorized approvals from owning phases;
- known-risk/exception records that are explicitly permitted by the owning process;
- final go/no-go decision record.

The bundle must be immutable/reconstructable enough to answer: **what exact system was accepted, on what evidence, by whom/what process, and when?**

## 22. Acceptance decision procedure

Final production acceptance later follows this order:

1. freeze/identify the release candidate;
2. verify all required plan/GAP dependencies are GREEN;
3. validate release manifest;
4. execute/review required automated test gates;
5. review security/data/authorization gates;
6. review reliability/recovery/operations gates;
7. verify production deployment and post-deploy smoke evidence;
8. confirm no NO-GO condition remains;
9. collect any required authorized approvals from owning phases;
10. record the final decision and evidence bundle;
11. only then may Phase 47 become GREEN.

If new contradictory evidence appears after acceptance, `00.09` GREEN-revocation rules apply and final acceptance must be reassessed.

## 23. Current observed baseline — 2026-09-17

At the start of `00.10` verification:

- current `main` is actively receiving parallel design/DAVID changes;
- Vercel has a READY production deployment, but the repository may advance ahead of the latest deployed commit, so release identity must be checked explicitly;
- the connected Supabase project remains shared;
- read-only inspection shows `public.enchev_development_events` as the only observed `public.enchev%` table;
- no Enchev production auction/bid/finalization/RBAC authority schema has been proven in that connected project;
- current browser/demo auction behavior is not accepted as authoritative auction evidence;
- therefore the platform is **not declared final-production-accepted by this document**.

## 24. 00.10 acceptance criteria

`00.10` itself may be GREEN only when:

1. final release identity requirements are explicit;
2. FROZEN/GAP completion and NO-GO rules are explicit;
3. auction-core correctness gates are explicit;
4. identity/authorization/security/data gates are explicit;
5. realtime/failure/recovery/performance/operations gates are explicit;
6. deployment/migration/rollback gates are explicit;
7. frontend/device/localization/provider gates are explicit where applicable;
8. production-environment isolation and data-readiness gates are explicit;
9. final evidence-bundle contents are defined;
10. Phase 47 decision procedure is defined and cannot waive missing evidence;
11. the document does not claim that currently unimplemented runtime capabilities already work;
12. no commercial/billing/finance scope is added to the tracker;
13. the implementation commit or a proven descendant passes repository TypeScript + production-mode build regression verification;
14. current production HTTP/runtime health is verified for regression context;
15. exact verification evidence is recorded before GREEN.

## 25. Evidence

Pending verification. This document remains YELLOW until the applicable `00.10` governance verification above is complete.
