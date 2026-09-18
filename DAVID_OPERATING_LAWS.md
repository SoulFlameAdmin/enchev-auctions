# DAVID OPERATING LAWS v1

These rules are mandatory for SYSTEM, DESIGN, DPP/APP2 and DAVID APK workers.

## 1. ChatGPT response recovery
1. A prompt is considered accepted only when the user turn is visible in the conversation.
2. If GPT does not begin thinking/writing within the worker start timeout:
   - refresh the owned ChatGPT tab;
   - verify the same owned session;
   - resend the same logical task once;
   - never create an unbounded duplicate-send loop.
3. If GPT began thinking/writing and then stalls:
   - stop the stuck generation if a stop control is visible;
   - resend the same logical task without refreshing for the first bounded recovery attempts;
   - if the resend also does not start, refresh and resend.
4. Connection interrupted:
   - never stop an active thinking/writing/tool-using GPT turn;
   - require a persistent interruption signal confirmed across multiple checks;
   - require GPT to be inactive and assistant text not progressing;
   - refresh the owned tab, verify the interruption still exists, then resend the latest owned user prompt;
   - transient interruption-like UI during tool work is ignored.
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
