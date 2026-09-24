# DAVID OPERATING LAWS v1

These rules are mandatory for CONTROL/WATCHTOWER, SYSTEM, DESIGN, DPP/APP2 and DAVID APK workers.

## 0. Terminal OK gate
- A new normal DAVID prompt is allowed only when the previous GPT assistant response has fully completed and its final non-empty line is exactly `OK`.
- `OK.`, `completed`, a quiet response, tool completion, or visible action buttons are not sufficient.
- If the final marker is `PROBLEM IN: ...`, DAVID may enter the bounded problem-fix/defer flow for that problem; it must not advance to the next normal project task.
- If there is neither exact final `OK` nor `PROBLEM IN:`, DAVID waits and sends no new prompt.
- APP2 may also stop permanently on its explicit project-complete marker.

## 1. ChatGPT response recovery
1. A prompt is considered accepted only when the user turn is visible in the conversation.
2. If GPT does not begin thinking/writing within the worker start timeout:
   - refresh the owned ChatGPT tab;
   - verify the same owned session;
   - resend the same logical task once;
   - never create an unbounded duplicate-send loop.
3. If GPT began thinking/writing or is using tools:
   - treat visible active work as BUSY and wait;
   - a real visible ChatGPT Stop / Stop generating / Stop thinking control is an authoritative ACTIVE lock;
   - while that ACTIVE lock is visible: never press Stop, never refresh, never restart the worker, never resend the project prompt, and never switch the model merely because the response is slow;
   - every real assistant-text change resets the no-progress clock;
   - after the configured no-progress window (default 10 minutes) while ACTIVE remains visible, publish watchdog state `gpt-active-no-progress` (or the worker-prefixed equivalent) for SF Scientist investigation, but KEEP WAITING;
   - the text-stall timer is advisory telemetry while ACTIVE is visible and can never override the ACTIVE lock;
   - recovery becomes eligible only after the ACTIVE lock disappears and the response is still incomplete/inactive;
   - inactive recovery is bounded: verify the owned session, refresh only when necessary, and resend the same logical task only within the worker's explicit recovery budget; never create an unbounded duplicate loop.
4. Connection interrupted:
   - never stop an active thinking/writing/tool-using GPT turn;
   - require a persistent interruption signal confirmed across multiple checks;
   - require assistant output to be inactive and not progressing;
   - refresh the owned tab and verify the state;
   - if the response recovered to OK / PROBLEM IN / new progress, do not resend;
   - otherwise resend the latest owned prompt once as a stranded-turn recovery.
5. Message send timeout:
   - the explicit ChatGPT error "Изпращането на съобщението изтече по време / Message sending timed out" has one recovery owner: the central managed guard;
   - project workers wait and do not issue their own duplicate resend while the timeout card is visible;
   - if GPT is active, do nothing;
   - otherwise click the timeout card's Retry / Опитайте отново button in a bounded flow;
   - if Retry does not clear the error, refresh the owned tab, verify, and allow at most the bounded retry count;
   - never paste a duplicate project prompt while explicit send-timeout recovery is active.

6. CAPTCHA, MFA, login and explicit permission gates are never bypassed.
7. Maximum-length conversation:
   - open a new ChatGPT tab;
   - carry forward the project/source-of-truth context;
   - close the old managed tab;
   - save old URL -> new URL rollover history;
   - one worker owns one active tab.

## 1A. Global ChatGPT rate-limit law
- The ChatGPT UI signals `Твърде много заявки`, `Правите заявки прекалено бързо`, `Too many requests`, or equivalent rate-limit text trigger one GLOBAL send block shared by CONTROL, SYSTEM, DESIGN, APP2 and APK.
- While globally blocked, no worker may send a new ChatGPT message.
- Cooldown policy is fixed at 60 seconds:
  1. first confirmed rate limit -> block all DAVID sends for 60 seconds;
  2. after the timer expires, exactly one worker becomes probe owner and may send one probe;
  3. if that real probe request is rate-limited again -> block all sends for another 60 seconds;
  4. repeat the same 60-second cooldown + one-probe cycle until a probe completes successfully.
- Legacy persisted 10/20/40-minute cooldown state is capped to the current 60-second policy when workers next request a global send permit.
- A stale rate-limit popup does not escalate the backoff. Escalation requires the current probe owner to have actually started a new probe send.
- All non-owner workers remain WAIT during probe mode.
- A successful completed response from the probe owner clears the global rate-limit state and normal sending may resume.
- CONTROL must not REFRESH or RESTART a worker merely because it is waiting on the global rate-limit coordinator.
- Entering rate-limit wait or becoming the single probe owner MUST NOT reload/refresh the ChatGPT tab. A probe is sent in the existing healthy session.
- Refresh is recovery-only: use it only after confirmed inactive/dead/stale UI or a bounded failed-start/connection recovery window, never as normal pacing.
- Shared Edge CDP connection timeout is not a worker-fatal condition: CONTROL/SYSTEM/DESIGN/APP2/APK/GUARD must stay alive, wait, and reconnect to port 9444. They must never close the shared Edge browser while reconnecting.
- For the ChatGPT send-timeout banner, the central guard owns recovery: click the visible Retry/Try again/Опитайте отново button with bounded retries; do not refresh the page and do not submit a duplicate prompt.
- The global rate-limit state persists across DAVID clean restarts so restart cannot bypass the cooldown.

## 2. External blockers
Quota, provider credentials, Marketplace authorization, billing, legal sign-off and customer data are external blockers.
They must be recorded with evidence and deferred. They must not cause endless retry loops when dependency-safe work remains.

## 3. Vercel deploy coordination
All workers share one global Vercel deploy lease in Supabase:
- table: public.david_vercel_deploy_lease
- events: public.david_vercel_deploy_events
- claim: public.david_claim_vercel_deploy(owner, project_key, commit_sha, lease_seconds)
- start: public.david_mark_vercel_deploying(owner, project_key, commit_sha)
- release: public.david_release_vercel_deploy(owner, success, detail)
- block (only with a real provider retry time): public.david_block_vercel_deploys(owner, retry_after, reason)

Before any Vercel create/update/redeploy:
1. claim the lease;
2. if granted=false, DO NOT deploy; continue non-deploy work;
3. if granted=true, mark deploying and perform exactly one intended deployment;
4. release on success or failure;
5. never guess a retry time for a quota block.

Worker owner IDs:
- ENCHEV_SYSTEM
- ENCHEV_DESIGN
- DPP_APP2
- DAVID_APK

Project keys:
- enchev-auctions
- dpp-autopilot
- soulflame-twins

## 4. Evidence and safety
GREEN requires implementation + applicable PASS test + concrete evidence.
Do not invent secrets, results, deployments or test evidence.


## 4.5 Deterministic turn-dispatch law
- DAVID may submit a new project prompt only when the owned ChatGPT tab is not actively generating, the latest turn is not an unanswered user turn, and the composer does not contain a different/manual draft.
- A visible real Stop/generating control is an absolute dispatch lock.
- If a different user turn is pending, DAVID waits for its assistant response instead of overtaking it.
- If the composer contains a different draft, DAVID preserves it and waits instead of overwriting it.
- Send acknowledgement requires strong evidence: a new user-turn count, a matching pending user turn, a matching user turn followed by a new assistant turn, or composer-cleared plus real generation.
- Composer-cleared by itself is never ACK. It is AMBIGUOUS and DAVID verifies the same turn before any resend.
- Every send exposes prompt hash, baseline/accepted user counts, baseline/accepted assistant counts, method, signal and ACK/AMBIGUOUS state to watchdog telemetry.
- Prompt routing is semantic: normal completion -> NEXT WORK; internal technical defect -> FIX; known external blocker -> DEFER once then independent WORK; human verification/login/MFA/CAPTCHA -> WAIT.
- No router may turn a human gate or external blocker into an uncontrolled resend loop.

## 4A. SF Scientist -> Supervisor recovery law
- SF Scientist continuously audits worker watchdog/state freshness, runtime topology, recent logs/logAlerts and probeErrors.
- `gpt-active-no-progress` is an investigation signal, not permission to interrupt an active ChatGPT response.
- SF Scientist may request only allowlisted DAVID recovery actions: REFRESH or RESTART one managed project worker, or CLEAN_DUPLICATES.
- Every Scientist recovery request must pass through the unified DAVID Supervisor; Scientist must not use PowerShell process-kill commands to bypass that gate.
- The Supervisor re-checks worker watchdog protection and the real owned ChatGPT tab immediately before execution. If thinking/writing/tool/Stop-active evidence is present, recovery is rejected.
- A Supervisor rejection is evidence to WAIT, not a reason to escalate around the safety gate.
- Human verification, CAPTCHA, MFA, login, permission and explicit approval gates remain human-owned and are never bypassed.

## 4B. Recovery-budget exhaustion law
- Inactive recovery is finite. A worker may use only its explicit bounded resend/refresh budget for one logical turn.
- When that budget is exhausted, the worker enters an `*-awaiting-supervision` state, keeps a lightweight supervision heartbeat, and performs no further refresh/resend by itself.
- `*-awaiting-supervision` is a real watchdog anomaly for both CONTROL and SF Scientist.
- The next lifecycle recovery must come through the guarded Unified Supervisor path, which re-checks real active-work protection immediately before REFRESH/RESTART.
- A rate-limit cooldown, human-verification gate, login/MFA/CAPTCHA, or explicit permission wait does not consume the inactive technical recovery budget.

## 5. 24/7 supervisor health
- One unified supervisor owns CONTROL/WATCHTOWER, SYSTEM, DESIGN, DPP/APP2 and DAVID APK.
- Startup is successful only after all five managed ChatGPT tabs are present exactly once: CONTROL=1, SYSTEM=1, DESIGN=1, APP2=1, APK=1.
- Worker state files act as heartbeats.
- A stale worker heartbeat or a missing owned tab triggers restart of only the affected worker.
- Tab ownership is persisted by current chat URL; relay markers are fallback discovery only.
- Duplicate managed tabs are cleaned automatically.
- A clean restart preserves profile/login/state and must not report success if stop/start health checks fail.


## 6. CONTROL / WATCHTOWER
- Dedicated CONTROL chat: https://chatgpt.com/c/6aade2fa-e2a0-83ed-96af-702c0430d49e
- CONTROL receives local DAVID telemetry only; it does not perform project implementation work.
- CONTROL may request only these allowlisted actions:
  - ACTION WAIT
  - ACTION REFRESH SYSTEM|DESIGN|APP2|APK
  - ACTION RESTART SYSTEM|DESIGN|APP2|APK
  - ACTION CLEAN_DUPLICATES
- CONTROL output is executable only when its final non-empty line is exactly OK.
- Any non-allowlisted action is rejected by the local supervisor.
- CONTROL has no arbitrary shell command bridge and no free-form destructive browser control.
- Healthy worker means WAIT; CONTROL must not interrupt active thinking/writing/tool work.
- RESTART is stronger than REFRESH and is reserved for dead, stale, missing-tab, or otherwise evidenced worker failure.
- CONTROL itself is monitored by the same 24/7 supervisor heartbeat and tab-ownership laws.
- CONTROL conversation max-length follows the same rollover law: create replacement chat, close the old managed CONTROL tab, preserve state/history, continue monitoring.
- Project blockers are not session-health failures: Redis/Valkey/provider credentials, Vercel quota/deploy blockers, failing tests, and ordinary PROBLEM IN project work normally require WAIT, not refresh/restart.
- The local supervisor independently rejects CONTROL REFRESH/RESTART commands when the target watchdog or browser UI shows active thinking, writing, tool work, final-OK waiting, sending, settling, or send-timeout recovery.
- CONTROL suggestions never override CAPTCHA/MFA/login/permission restrictions, exact-final-OK laws, deploy coordination, or worker-specific safety laws.


## 7. Finite-plan completion law
- When a finite project plan is fully verified complete, DAVID must not invent new numbered scope just to keep a worker busy.
- Enchev Design Plan V1 is frozen historical evidence: app/design-plan-evidence.json remains D01-D36 = 36/36 GREEN and is never reset by Process 2.
- The active DESIGN source is docs/DESIGN_PROCESS_2.md plus app/design-process-2-evidence.json, executed strictly DP2-01 -> DP2-30.
- If the active DESIGN conversation reaches maximum length:
  1. open one replacement DESIGN chat;
  2. close the old managed DESIGN tab;
  3. send exactly one Process 2 handoff into the replacement chat;
  4. require final exact OK;
  5. continue from the earliest non-GREEN DP2 task, or enter design-idle-complete only when DP2-01 through DP2-30 are all GREEN.
- While Process 2 has non-GREEN tasks, DESIGN remains active and continues dependency-safe work.
- When DP2-01 through DP2-30 are 30/30 GREEN, the worker sends no new normal design prompts and must not invent DP2-31.
- If a completed DP2 task later regresses to non-GREEN, DESIGN leaves idle automatically and resumes from the earliest affected DP2 task.
- Slow loading of the replacement chat is not a restart condition: wait up to the configured ready window, use only bounded refresh attempts, then back off while keeping heartbeat alive.


## 8. Single-owner restart law
- RESTART_DAVID_ALL_CLEAN.ps1 is the only hard-restart owner for the full DAVID stack.
- START_DAVID_ALL.ps1 must never perform an in-place partial worker restart.
- START must fail fast if it sees duplicate supervisors, a supervisor with dead CDP, or worker code changed while an old supervisor is still running.
- A global Windows orchestration mutex prevents concurrent START/RESTART operations.
- Clean STOP terminates the full managed process trees and the dedicated DAVID browser tree, then verifies zero managed workers and CDP offline before START is allowed.

## 9. Exact browser/process invariant
- The dedicated DAVID Edge profile has exactly five managed ChatGPT tabs:
  CONTROL=1, SYSTEM=1, DESIGN=1, APP2=1, APK=1.
- Once all five owned tabs exist, any additional unmanaged ChatGPT tab in the dedicated DAVID profile is closed automatically.
- Startup is not healthy when total ChatGPT tabs is greater than five.
- Runtime process invariant is exactly one each:
  SUPERVISOR=1, SYSTEM=1, DESIGN=1, APP2=1, APK=1, CONTROL=1, GUARD=1, MATRIX=1.
- Any count greater than one is a fault, never a healthy/reusable state.

## 10. One-defer law
- The same external blocker may receive at most one defer relay per worker.
- After that relay, the worker must return to independent WORK mode.
- If GPT repeats the same already-deferred blocker without new evidence, DAVID records it as already deferred and does not send another defer prompt.
- A different new external blocker may receive one new defer relay.
- External blockers never justify an endless relay/defer loop.


## 11. Global send pacing law
- Confirmed ChatGPT rate-limit popups may be acknowledged automatically only with exact informational buttons such as `Разбрано`, `Got it`, or `Understood`.
- Dismissing the popup never clears or shortens the global cooldown.
- All normal CONTROL/SYSTEM/DESIGN/APP2/APK message sends share one atomic global send pacer.
- Default minimum interval between every new DAVID ChatGPT relay is 10 seconds account-wide, configurable with DAVID_GLOBAL_SEND_INTERVAL_MS.
- Only one worker may reserve the next send slot at a time.
- Every actual CONTROL/SYSTEM/DESIGN/APP2/APK send marks the global pacer, so a second session cannot send until at least 10 seconds later. This prevents five-tab burst sends even when no explicit rate-limit popup is visible.
- Matrix must show both the active rate-limit countdown and the next normal send countdown.
- The 60-second interval is a DAVID safety policy, not a published OpenAI ChatGPT requests-per-minute entitlement.
