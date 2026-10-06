# P0 URGENT — DAVID AGI × ENCHEV CLOSED DEMO PILOT v1.0

Status: ACTIVE / P0
Owner: DAVID AGI + Dimitar + Borko + Enchev
Parent master: `docs/MASTER_SYSTEM_EXPANSION_V2.md`
Frozen master remains immutable: `docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md`
Mission type: execution overlay, NOT a renumbering of the 4,374 SYSTEM points.

## 1. Mission

Reach the first provable end-to-end ENCHEV transaction demo without waiting for all 4,374 SYSTEM points.

Authoritative demo path:

Seller -> Vehicle -> Approval -> Lot -> Auction -> Bid -> Winner -> DEMO Documents -> DEMO Payment -> Release -> Handover -> Audit -> Completed

The demo MUST use realistic workflow and realistic demo documents, but MUST NOT create a real sale, real tax invoice, real transfer of vehicle ownership, or real-money obligation.

After Closed Demo passes:
1. legal/operational calibration with Enchev;
2. document map approved for the real business model;
3. Live Pilot with one real vehicle and real money/documents;
4. reconciliation;
5. Market Pilot with 1-2 real vehicles and controlled advertising;
6. controlled launch.

## 2. P0 execution law

Until this mission is GREEN, DAVID must prioritize work that is a direct dependency of the closed-demo transaction path.

DAVID must NOT:
- chase unrelated Master Plan points while a demo blocker is actionable;
- mark code GREEN without test/evidence;
- silently patch production data to make a demo pass;
- use AI as authoritative winner, bid, money, release, or accounting logic;
- turn a DEMO document into a real accounting/legal document;
- deploy untested critical-path changes directly to production.

Allowed exceptions:
- security/reliability blockers that make the demo unsafe or invalid;
- external blockers where dependency-safe work remains;
- explicit human priority override.

## 3. DAVID active-work timer — mandatory

The purpose of the timer is to measure how much REAL ACTIVE DAVID WORK each exact point consumed.

### 3.1 Core rule
The timer counts only proven active work attached to one concrete `mission_step_id` and, when available, its mapped immutable `master_task_id`.

No task ID = no active time.

### 3.2 Precision
- Internal timing source: monotonic high-resolution clock, preferably Node `process.hrtime.bigint()`.
- Stored duration unit: nanoseconds or microseconds.
- UI display: milliseconds (`HH:MM:SS.mmm`).
- Wall-clock UTC timestamp is stored separately for audit, but elapsed duration is calculated from the monotonic clock.

This gives millisecond display precision. It does NOT claim that an operating system can detect an unexpected crash within exactly 1 ms.

### 3.3 No phantom work
The system must never continue adding time merely because DAVID's process still exists.

Active time requires:
- worker state = ACTIVE;
- a concrete task/mission step is bound;
- DAVID is in an owned execution cycle;
- heartbeat/evidence stream is valid.

### 3.4 Timer events
Persist append-only events:
- WORK_START
- HEARTBEAT
- TASK_SWITCH
- TOOL_START
- TOOL_END
- TEST_START
- TEST_END
- WAIT_EXTERNAL
- PAUSE
- ERROR
- STOP
- RESUME
- TASK_PASS
- TASK_FAIL
- TASK_COMPLETE

Each event stores at minimum:
`event_id, session_id, worker_id, mission_step_id, master_task_id?, monotonic_ns, utc_at, state, detail, evidence_ref?, commit_sha?`

### 3.5 Unexpected stop / crash
DAVID must send a frequent local heartbeat while actively working.

If the worker crashes, freezes, loses its owned ChatGPT session, or stops generating progress:
- timer becomes STOPPED/UNPROVEN;
- recovery must NOT count the detection delay as work;
- the active interval is closed at the last confirmed active heartbeat/evidence timestamp;
- after recovery a new active interval starts.

This intentionally prefers slight under-counting over falsely claiming work time.

### 3.6 Pauses never count as active work
Do not count:
- sleep/idle;
- waiting for the user;
- waiting for login/MFA/CAPTCHA;
- provider quota wait;
- waiting for external approval;
- known Vercel/provider wait;
- machine shutdown;
- DAVID stopped;
- ChatGPT session stalled with no confirmed progress;
- manual human discussion not executed by DAVID.

Keep these as separate `blocked_ms` / `wait_ms`, never merge them into `active_ms`.

### 3.7 Task switch
DAVID cannot have two active P0 mission timers simultaneously under the same worker identity.
A switch must atomically:
1. close old task interval;
2. persist old active duration;
3. open new task interval;
4. update dashboard.

### 3.8 Progress evidence
For every mission step show:
- status RED / YELLOW / GREEN;
- exact active time;
- wall time;
- blocked time;
- attempts;
- tests run;
- latest result;
- evidence links/paths;
- commit SHA;
- deployment if applicable;
- blocking reason;
- next action.

### 3.9 Dashboard
The local DAVID dashboard must always show:
- ACTIVE / PAUSED / BLOCKED / STOPPED / ERROR;
- current mission step;
- mapped Master Plan point;
- current interval timer to milliseconds;
- total active DAVID time;
- active time for current point;
- completed mission steps / total;
- current SYSTEM point if mapped;
- last heartbeat;
- last concrete action;
- last PASS/FAIL;
- current commit;
- points completed per active hour;
- estimated remaining ACTIVE work based on evidence, not calendar time.

### 3.10 Audit rule
Timer history is append-only.
Do not edit elapsed time manually without creating a correction event containing:
- previous value;
- corrected value;
- reason;
- actor;
- timestamp.

## 4. Closed Demo mission steps

These are execution-overlay IDs. They do not alter or renumber the immutable Master Plan.

### MISSION-001 — Gap analysis
Inspect the real repo, current deployments, DB state, tests and existing Master Plan evidence.
Output a blocker map:
- already real;
- UI-only;
- partially implemented;
- missing;
- external blocker.
Acceptance: every later mission step has an evidence-based starting status.

### MISSION-002 — Safe work branch / environment
Create or select a safe demo work branch and isolate demo configuration from production money/legal behavior.
Acceptance: production cannot accidentally receive demo payment/document effects.

### MISSION-003 — Demo identity model
Provide separate Seller/Admin, Mitko Buyer, Borko Buyer and system automation identities/roles.
Acceptance: authorization proves the roles are separate.

### MISSION-004 — Vehicle intake
Create one realistic demo vehicle record with media and condition information.
Acceptance: persisted vehicle survives reload/login and has stable ID.

### MISSION-005 — Vehicle Intake Record
Generate the demo intake document.
Acceptance: correct vehicle/seller identifiers and DEMO watermark.

### MISSION-006 — Seller Declaration DEMO
Generate seller declaration structure for demo purposes only.
Acceptance: versioned, linked to vehicle, clearly non-legal/non-production.

### MISSION-007 — Approval workflow
Draft -> Submitted -> Under Review -> Approved for Auction.
Acceptance: unauthorized state changes blocked.

### MISSION-008 — Lot creation
Create stable lot ID and auction configuration.
Acceptance: lot links to exact vehicle snapshot.

### MISSION-009 — Auction Listing Snapshot
Persist what buyers saw at auction opening.
Acceptance: immutable/versioned snapshot exists after close.

### MISSION-010 — Terms acceptance
Persist accepted terms version per bidder.
Acceptance: bidder cannot bid without valid demo acceptance if configured as required.

### MISSION-011 — Server-authoritative auction clock
Auction time comes from authoritative backend/server state.
Acceptance: client clock manipulation cannot extend/shorten authoritative auction time.

### MISSION-012 — Authoritative bid API
Validate bidder, auction state, increment, amount, idempotency and authorization.
Acceptance: invalid bids are deterministically rejected.

### MISSION-013 — Concurrency safety
Test nearly simultaneous bids from Mitko/Borko.
Acceptance: deterministic order and no dual-winner corruption.

### MISSION-014 — Bid Ledger
Append-only accepted/rejected bid history with reason and server sequence.
Acceptance: full chronology reconstructable.

### MISSION-015 — Realtime UI
Both bidders see authoritative current state and recover after reconnect.
Acceptance: reconnect does not invent or lose authoritative bids.

### MISSION-016 — Deterministic close
Close automatically at authoritative deadline and choose winner by rules.
Acceptance: exactly one final result or explicit no-sale state.

### MISSION-017 — Auction Close Certificate DEMO
Generate result certificate.
Acceptance: lot, auction, bid/winner and close time all match DB truth.

### MISSION-018 — Winner Confirmation DEMO
Winner sees clear result and next steps; loser sees correct ended/outbid state.
Acceptance: role-correct UI after relogin.

### MISSION-019 — Purchase Summary DEMO
Calculate winning amount plus configured demo fees/tax placeholders.
Acceptance: arithmetic is deterministic and sourced from versioned rules.

### MISSION-020 — DEMO Pro Forma
Generate professional pro forma marked DEMO / NOT A TAX INVOICE / NO PAYMENT DUE.
Acceptance: no path can register it as a real fiscal invoice.

### MISSION-021 — Demo payment instruction
Show safe test payment instructions/reference.
Acceptance: cannot route real funds.

### MISSION-022 — Payment sandbox state machine
Pending -> Processing -> Paid/Failed.
Acceptance: duplicate callbacks/actions are idempotent.

### MISSION-023 — Payment Confirmation DEMO
Generate transaction confirmation from sandbox truth.
Acceptance: amount/reference/status match payment state.

### MISSION-024 — No Payment = No Release
Backend must block release if payment is not confirmed.
Acceptance: direct API/UI abuse test fails safely.

### MISSION-025 — Vehicle Release Order DEMO
Create single-use release authorization/token/QR after demo payment.
Acceptance: bound to winner + vehicle + transaction.

### MISSION-026 — Release validation
Scan/use release credential and validate all prerequisites.
Acceptance: wrong/expired/reused token rejected.

### MISSION-027 — Handover Protocol DEMO
Capture vehicle, mileage, keys, notes, parties and time.
Acceptance: linked to the same transaction and clearly DEMO.

### MISSION-028 — Single-use completion
Consume release credential and set transaction COMPLETED.
Acceptance: second release attempt rejected.

### MISSION-029 — Completion Certificate DEMO
Generate final summary document.
Acceptance: all identifiers agree with transaction truth.

### MISSION-030 — Document Vault
Collect all demo documents in one transaction workspace/package.
Acceptance: one transaction can be reconstructed from the package.

### MISSION-031 — Document version/hash
Version documents and store integrity hash.
Acceptance: regeneration/change creates a traceable new version, not silent overwrite.

### MISSION-032 — End-to-end audit timeline
Show actor/action/time/result/evidence across full transaction.
Acceptance: no hidden manual DB fix is required to explain final state.

### MISSION-033 — Failure injection
Test duplicate bid, late bid, refresh, reconnect, failed payment, duplicate payment action, no-payment release, reused token and restart during critical flow.
Acceptance: no unsafe state or silent corruption.

### MISSION-034 — Internal rehearsal
Run full demo with Mitko + Borko + DAVID before Enchev.
Acceptance: zero critical manual interventions.

### MISSION-035 — Closed Demo acceptance
Run official closed demo with Enchev.
GREEN only if:
- vehicle-to-completed path succeeds;
- winner is deterministic;
- documents agree;
- sandbox payment gates release;
- release is single-use;
- audit is complete;
- relogin/restart does not corrupt state;
- no critical blocker remains.

## 5. Post-demo gates

### GATE-A — Enchev operational interview
Determine the real seller-of-record, platform role, commissions, deposit rules, payment routing, handover flow, cancellations/refunds and required documents.

### GATE-B — Legal & Operational Document Map
For every real document define:
issuer -> recipient -> trigger -> mandatory data -> signature/acceptance -> storage -> retention/versioning -> accounting/legal status.

Qualified legal/accounting review is required where the production rule depends on law/tax/accounting treatment.

### GATE-C — Live Pilot #1
One real vehicle, controlled participants, real approved documents and real approved money flow.
No mass advertising yet.

### GATE-D — Reconciliation
Auction result, payment, invoice/accounting state, release and physical handover must match 1:1.

### GATE-E — Market Pilot
1-2 real vehicles + limited advertising.
Measure:
ad -> visit -> registration -> verification -> bidder -> bid -> winner -> payment -> completion.

### GATE-F — Controlled Launch
Scale only after Live Pilot and Market Pilot are evidence-GREEN.

## 6. Installer target

After DAVID is connected to this mission on the user's PC, build a repeatable installer/bootstrap for the local DAVID ENCHEV worker.

Installer requirements:
- detect/validate required runtime dependencies;
- configure the local ENCHEV project path without hardcoding secrets;
- install/start the DAVID worker and timer service;
- create start/stop/status/recover shortcuts/commands;
- create persistent local state/log directories;
- preserve existing audited DAVID recovery rules;
- never bundle credentials in source or installer;
- never bypass UAC, MFA, login or security controls;
- provide a health check after install;
- prove restart persistence;
- prove timer crash recovery;
- prove exact task binding;
- allow clean uninstall/disable without deleting project data.

Installer acceptance:
fresh supported Windows user environment -> install -> connect approved account/session -> health GREEN -> bind MISSION-001 -> timer ACTIVE -> safe stop -> timer STOPPED -> restart -> state recovered.

## 7. First action when user returns to PC

Do NOT start by writing broad new features.

Run:
**ENCHEV CLOSED DEMO GAP ANALYSIS**

The report must identify the shortest evidence-based path from current repo state to MISSION-035, then DAVID begins the first actionable RED blocker while the active-work timer records the exact mission step.

## 8. Definition of success

The milestone is not "many Master Plan points completed".

The milestone is:

**One ENCHEV demo vehicle can move from intake to a deterministic auction winner, demo financial/document flow, gated release, handover and complete audit trail without hidden manual repair.**
