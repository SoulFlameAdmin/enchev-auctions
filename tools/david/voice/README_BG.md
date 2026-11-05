# DAVID Voice V1 — separate Windows adapter (draft)

Primary chat: https://chatgpt.com/c/6ae76768-b7cc-83ed-8960-415469e2dacb  
Tracking: https://github.com/SoulFlameAdmin/enchev-auctions/issues/393

## Architecture
Gemini transcriber (local adapter, **not yet wired to DAVID OS**)
-> loopback `POST /transcript`
-> bounded durable queue and conservative Guardian
-> **separate** Windows Edge profile
-> existing ChatGPT conversation (only after operator has started Voice and muted ChatGPT microphone).

This worker is **NOT** a sixth tab in the dedicated port 9444 / five-tab DAVID profile, and is **NOT** started by `START_DAVID_ALL.ps1`. Do not merge, start or enable LIVE until reviewed, tested on Windows, and explicitly approved. Nothing in these files auto-starts existing Windows workers.

## Setup — manual Windows laboratory test
From the repository root, after `npm install --prefix tools/david` and Node.js 22:

```powershell
node --test .\tools\david\voice\voice-guardian.test.mjs
# Use two different locally generated, unpredictable secrets. Never commit or paste them into chat.
$env:DAVID_VOICE_RELAY_TOKEN = Read-Host "Relay token (minimum 16 chars)"
$env:DAVID_VOICE_GUARDIAN_TOKEN = Read-Host "Guardian token (different, minimum 16 chars)"
# First run: no browser, no sending
node .\tools\david\voice\voice-worker.mjs
```

The listener binds **only** `127.0.0.1:9448`. It never executes shell commands from a transcript. Config source: `voice-config.json`; primary URL cannot redirect to other sites. `/status` requires one of the tokens. Requests: `Authorization: Bearer <token>`; `POST /transcript` body `{"id":"gemini_000001","text":"Здравей, DAVID","source":"gemini-relay"}`.

For a real, explicitly approved UI test, stop the dry-run process, set `$env:DAVID_VOICE_LIVE="1"`, and start the worker again. It will open its own Edge profile **only after** the operator calls `POST /arm`. To arm it, open the Voice chat in that profile, start ChatGPT Voice output, mute the ChatGPT microphone (Gemini must remain the sole microphone source), and **separately** send to `POST /arm` with Guardian-token authentication and `{"voiceOutputStarted":true,"chatgptInputMuted":true}`. This confirms a human visually inspected the controls: the worker does **not** verify the actual microphone hardware state. It checks the target conversation and visible text composer before arming.

### HTTP contract
- `GET /status`: safe aggregate health, never returns raw transcripts or tokens.
- `POST /transcript`: a unique 8–90 character ID per utterance. Identical IDs are deduplicated. If a send's acceptance is ambiguous, the turn stays `uncertain` and will **never** be automatically re-sent.
- `POST /guardian/approve`: separate Guardian token + `{"id":"..."}` to release a `held` sensitive transcript after genuine human approval.
- `POST /pause`: separate Guardian token, disable automatic sending. Saying “DAVID, пауза” is also recognized.
- Default dry-run: transcripts can be queued and reviewed, but are never sent.

The worker uses the existing global ChatGPT send coordinator to respect pacing and rate-limit signals, and checks its queue every 10 seconds. It never attempts to bypass login, MFA, CAPTCHA or provider limits.

## Non-goals / remaining gates
- Automatic clicking of the yellow voice button and microphone mute **not implemented**; buttons must be mapped from the actual Windows UI before safe automation.
- No actual Gemini-to-loopback producer is wired yet. The prior DAVID OS app's dictation is available, but its integration to this local transport must be designed and tested.
- No proof yet that ChatGPT Voice allows a text composer in the requested Windows state. If unavailable, worker refuses to arm. Fallback may require API voice output or a different supported UI workflow.
- Audio feedback/echo prevention needs physical headset or OS audio routing validation.
- Automatic rollover to a new chat is deliberately **not enabled**. Stop and require Guardian approval, context handoff and new URL validation.
- No ongoing Windows DAVID status can be inferred solely from GitHub code.
- Queue file `.david-voice-queue.json` contains transcript text locally (not tracked by Git). Keep Windows profile and user directory private and set appropriate filesystem access permissions.
- Guardian heuristic is conservative, not a complete security boundary. Arbitrary external actions require a separate policy enforcement layer.

## Acceptance gates before moving to production
1. Pure Guardian tests pass.
2. Windows Edge separate profile test confirms no impact on the five main managed tabs.
3. Gemini transcript reaches loopback and is persisted exactly once.
4. Explicit Voice started + GPT microphone muted -> text composer visible -> one real test message -> one spoken GPT response.
5. Pause, blocked commands, duplicate ID, interrupted send, rate limits and restart recovery tested with evidence.
6. Only then wire into DAVID Center with a dedicated visible Voice status and operator-controlled arm/pause.
