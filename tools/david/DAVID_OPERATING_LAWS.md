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
   - do not press Stop on an active GPT/tool turn;
   - only after a long no-progress timeout may the worker enter bounded recovery;
   - recovery is refresh/verify/resend, never an unbounded duplicate loop.
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
- Backoff sequence is fixed:
  1. first confirmed limit -> wait 10 minutes;
  2. after cooldown, exactly one worker atomically becomes PROBE OWNER and may send one probe request;
  3. if that real probe request is rate-limited again -> wait 20 minutes;
  4. after cooldown, exactly one worker probes again;
  5. if that real probe is rate-limited again -> wait 40 minutes;
  6. further confirmed probe failures remain capped at 40 minutes.
- A stale rate-limit popup does not escalate the backoff. Escalation requires the current probe owner to have actually started a new probe send.
- All non-owner workers remain WAIT during probe mode.
- A successful completed response from the probe owner clears the global rate-limit state and normal sending may resume.
- CONTROL must not REFRESH or RESTART a worker merely because it is waiting on the global rate-limit coordinator.
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
- Default minimum interval between new DAVID ChatGPT sends is 60 seconds account-wide, configurable with DAVID_GLOBAL_SEND_INTERVAL_MS.
- Only one worker may reserve the next send slot at a time.
- The global pacer prevents five-tab burst sends even when no explicit rate-limit popup is visible.
- Matrix must show both the active rate-limit countdown and the next normal send countdown.
- The 60-second interval is a DAVID safety policy, not a published OpenAI ChatGPT requests-per-minute entitlement.
