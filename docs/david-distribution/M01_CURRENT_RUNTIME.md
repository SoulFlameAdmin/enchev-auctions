# DAVID distribution: M01 source audit

## Verified source

Repository: `SoulFlameAdmin/enchev-auctions`.
Audited runtime branch: `test/david-autonomy-system-dpp-apk-20260919`.
Base commit: `76ff8d61c4d96ab0988b0cbec4490e39a2da43cf` (PR #230 merge).
Core package version: `1.7.0`; dependency: `playwright-core@1.63.0`.

The default `main` branch at `c847467ee15250bdb4a0d522914c8210d5ff8a97`
is NOT the current runtime line. `DAVID_MATRIX_START.ps1` explicitly fetches,
checks out and pulls the audited runtime branch. PR #230 targets that branch,
preserving the verified send acknowledgement from PR #229 and replacing normal
post-OK conversation rotation with `next-task-ready` in the SAME chat.
This is source evidence, not confirmation of the HEAD currently on Mitko's PC.
No workstation access or Windows end-to-end execution was available in this audit.

## Component dependency map

Order numbers indicate dependencies, not a new orchestration implementation.

| Component / source | Purpose and dependencies | Start | Stop | Health | Existing recovery |
|---|---|---|---|---|---|
| `DAVID_START.ps1`, `DAVID_MATRIX_START.ps1` | Workstation entry; Git + fixed D drive + PowerShell | 1: clean previous stack, update runtime branch, open selector | Stop launcher/selector after owned work | exit code, Matrix startup log | orchestration mutex wait, error dialog |
| `DAVID_MODE_SELECTOR_V2.ps1` | WinForms modes, task status, Scientist console; mode restart scripts + preview worker | 2 | close UI and its owned preview worker | mode/process/CDP/task status | singleton/reactivation; mode switch clean restart |
| `START_DAVID_AUTONOMY.ps1`, `START_DAVID_SINGLE.ps1`, `START_DAVID_FREETALK_ONLY.ps1` | Select existing scope; shared `start-auto-continue.ps1` | 3 | corresponding clean restart uses common STOP first | exact scope-specific process/tab counts | fail startup on invariant mismatch |
| `tools/david/start-auto-continue.ps1` | Finds system Edge/Chrome/Brave; dedicated profile; npm/Node | 4: browser before supervisor | browser after workers | loopback `/json/version` | bounded initial CDP wait; dependency install currently at runtime |
| `dual-session-worker.mjs` | One Node supervisor; Playwright, child workers, rate coordinator | 5: spawns selected workers and central guard | 1: stop spawning, signal children; current forced tree cleanup fallback | child PID, state heartbeat, owned tabs, monitor JSON | child restart after exit; stale/missing-tab restart; restart debounce; no total crash budget |
| `auto-continue-enchev-v5.mjs` | SYSTEM project continuation; CDP, state, send/effort/rotation/rate helpers | 6 if selected | before browser | heartbeat, owned chat, accepted send | bounded send/recovery, reconnect, maximum-length rollover |
| `auto-complete-app2-v1.mjs` | DPP continuation; same helpers, DPP-specific prompt | 6 if selected | before browser | state, send ACK, explicit completion | continuation in same chat; saved state; defer external blocker |
| `auto-continue-david-apk-v1.mjs` | Twins/APK continuation; same helpers, APK prompt | 6 if selected | before browser | owned tab, state, send ACK | prior-chat discovery, fresh-tab fallback, reconnect |
| `auto-continue-design-v1.mjs` | Optional DESIGN; `app/design-process-2-evidence.json` plus helpers | 6 only in selected scope | before browser | plan evidence and worker state | idle on finite-plan completion, resume regression |
| `free-talk-session-v1.mjs` | FREE_A / FREE_B; shared exchange file, CDP and session helpers | 6 only in A/B scope | both before browser | role-specific state, exchange sequence, tabs | coordinator + verified sends + reconnect/rollover |
| `auto-control-watchtower-v1.mjs` | Optional CONTROL chat, monitor and command/result files | 6 only if enabled | before browser | heartbeat, monitor age | allowlisted WAIT/REFRESH/RESTART/CLEAN_DUPLICATES; active work protected |
| `connection-interruption-guard.mjs` | Shared recovery owner; CDP, worker state, rate coordinator | 6, infrastructure | before browser | process and recovery request/results | confirmed inactive interruption / bounded send-timeout retry |
| `chatgpt-rate-limit-coordinator.mjs` | Cross-worker local file lock, send slot and cooldown | imported by workers | retain durable cooldown | lease owners and timestamps | stale lock/lease recovery; shared cooldown + one probe |
| `chatgpt-send-ack.mjs`, `chatgpt-effort-mode.mjs`, `chatgpt-session-rotation.mjs` | Shared UI acknowledgement, effort and same-tab max-length rollover | imported by workers | no independent process | self-tests + live UI acknowledgement | bounded fallbacks; do not equate button click with task completion |
| `control-panel-task-preview.mjs` | UI task status and focus; DAVID and Scientist CDP + state | UI-owned observer | before UI exits | `.david-control-panel-tasks.json` freshness | polling/reconnect; no recurring screenshot polling after PR #229 |
| `START_SF_SCIENTIST.ps1`, `sf-scientist-sidecar.mjs` | УЧЕН observer/operator; own browser/profile/CDP **9555**; watches DAVID **9444**; Node, PowerShell | separate browser first, then singleton sidecar | `STOP_SF_SCIENTIST.ps1`: sidecar then its browser | singleton PID, CDP, heartbeat, runtime epoch | fresh-context re-analysis, bounded sends/rate retries; logs and memory |
| dashboards | Development progress views; source/evidence files | after selected runtime | before browser | state/CDP/process snapshots | refresh polling |

## Actual scopes

- SOULFLAME: SYSTEM + APP2 + APK; CONTROL chat OFF, DESIGN OFF, guard ON;
  three project tabs and background supervisor monitoring.
- FAST SOLO: exactly one of SYSTEM / APP2 / APK; one project tab, guard ON.
- A/B: FREE_A + FREE_B using the existing free-talk worker.
- Scientist is a separate browser/sidecar; do not count its tabs in DAVID's budget.
- Legacy ALL remains available; it is not the default Matrix product scope.

## State and release boundaries

Most monitor, command, recovery, exchange, rate-limit and Scientist files live
beside source under `tools/david`; worker state overrides are partly supported.
Scientist logs append without rotation. Browser profiles are separate under
`D:\ASI`. None of these user files may enter a runtime package. Code A/B swaps
must not move, overwrite or roll back mutable state or browser profiles.

The inventory explicitly includes DESIGN's evidence JSON because code reads it;
it does not include the website. Legacy dashboard full-project progress views
and old ALL/bootstrap/updater entrypoints are outside the proposed packaged
entrypoint and remain workstation tooling. Host scripts in the inventory are
audited dependencies to port, NOT currently distributable launchers.

## Confirmed implementation gaps

1. Fixed `D:\ASI`, `.git` checks, Git pulls, npm install at startup, and personal
   chat URLs/project prompts prevent a clean per-user installation today.
2. Port reachability does not establish browser ownership. Existing process-name
   matching and port-based shutdown must not be used to kill another user's stack.
3. Runtime state needs a shared configurable data directory; code stays immutable.
4. Supervisor retries are not bounded across repeated crashes. No safe mode or LKG.
5. Scientist currently offers local PowerShell through a deny-pattern classifier.
   This is NOT a remote-support security boundary. Never connect arbitrary
   Scientist command strings to cloud repair. Support requires a separate
   authenticated allowlist and expiring local consent.
6. No four-decision task router or durable user/project/task/conversation mapping
   was found in the audited DAVID modules. Existing Scientist is an observer/operator.
7. Supabase deploy-lease instructions are embedded in project prompts; they are
   not a device-registration/heartbeat/offline-task transport implementation.
   No fleet implementation was established by this runtime audit. Twins/SOUL
   repositories need their own audit before modifying accounts or schema.
8. No installer, embedded Node, signed update manifest, A/B core, global rollback,
   code-signing pipeline or clean-Windows acceptance evidence exists in this scope.

## Verification and next dependency

Run `node tools/david-distribution/inventory.mjs` and the adjacent node tests.
The closure is explicit for spawned/host/data dependencies and inferred for the
literal module imports used in these sources; computed imports fail closed.
This does not prove arbitrary PowerShell dependency discovery or detect every
possible secret. Release needs dedicated secret scanning and package inspection.

Existing source invariant tests PASS on the audited branch. These are static
contract checks, not live Windows/Edge/user-login acceptance.
Next: M02 reproducible inventory and dependency lock; M03 portable data/config
boundary around this SAME core, then launcher/installer. Do not package the
workstation defaults and call it Borko-ready.
