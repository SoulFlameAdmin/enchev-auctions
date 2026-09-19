# DAVID OPERATING LAWS v1

These rules are mandatory for SYSTEM, DESIGN, DPP/APP2 and DAVID APK workers.

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
5. CAPTCHA, MFA, login and explicit permission gates are never bypassed.
6. Maximum-length conversation:
   - open a new ChatGPT tab;
   - carry forward the project/source-of-truth context;
   - close the old managed tab;
   - save old URL -> new URL rollover history;
   - one worker owns one active tab.

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
- One unified supervisor owns SYSTEM, DESIGN, DPP/APP2 and DAVID APK.
- Startup is successful only after all four managed ChatGPT tabs are present exactly once: SYSTEM=1, DESIGN=1, APP2=1, APK=1.
- Worker state files act as heartbeats.
- A stale worker heartbeat or a missing owned tab triggers restart of only the affected worker.
- Tab ownership is persisted by current chat URL; relay markers are fallback discovery only.
- Duplicate managed tabs are cleaned automatically.
- A clean restart preserves profile/login/state and must not report success if stop/start health checks fail.
