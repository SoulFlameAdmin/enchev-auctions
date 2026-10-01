# SYSTEM 41.12 — Bot / scripted bidding abuse test

This task adds a repository-side anti-automation guard for bid attempts and certifies common scripted-bidding abuse patterns.

## Layered security model

41.12 does not replace the controls already certified:

- 41.10 prevents replay/duplicate critical requests from creating repeated effects.
- 41.11 provides the hard actor/source/route rate-limit budgets.
- 41.12 adds **behavioral bid-abuse escalation** on top of those hard limits.

The guard requires an active session and the existing `buyer.submit-bid` function authorization before any bid attempt is recorded.

## Scripted behavior signals

The guard challenges rather than silently trusting suspicious activity when it observes:

- too many attempts by one actor against one auction in a short window;
- one actor fanning out across too many auctions;
- too many distinct actors coming from one trusted server-derived source;
- highly regular machine-like cadence across repeated bids.

Same-timestamp attempts count independently. Rotating idempotency keys does not reset behavioral history because the abuse state is keyed to actor/source/auction, not request key.

## Challenge contract

A suspicious attempt must present a previously server-issued, single-use challenge record. The challenge is bound to the exact actor, active session ID, security version and auction, and expires after two minutes. Foreign, stale, expired or previously consumed challenges fail closed.

Client claims such as “I am human”, actor identity or source/IP are never trusted.

## Claim boundaries

The repository does not currently contain a production bot-detection, CAPTCHA, device-fingerprint or distributed abuse-state provider. This task certifies the enforcement contract those adapters must invoke; it does not claim those external/runtime integrations already exist.

The guard never determines whether a bid is authoritative or accepted. Authoritative bid mutation remains outside this task. SSRF certification remains 41.13.

Implementation: `packages/domain/src/bid-abuse-guard.ts`

Run: `node scripts/verify-bot-scripted-bidding-abuse-41-12.mjs --self-test`
