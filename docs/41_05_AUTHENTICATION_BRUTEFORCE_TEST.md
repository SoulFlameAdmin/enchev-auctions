# SYSTEM 41.05 — Authentication brute-force test

This certification adds a reusable server-side authentication throttle guard and tests brute-force, password-spraying and credential-stuffing patterns without using real credentials or production customer data.

## Repository reality

Enchev does not currently expose a production login endpoint or production identity-provider implementation in this repository. Therefore 41.05 does **not** fabricate a live Supabase/Auth provider result. The certification covers the repository-side authentication abuse-control contract that the eventual login handler must call.

## Controls

- independent **per-principal** sliding window: 5 failed attempts / 5 minutes;
- independent **per-source** sliding window: 20 attempts / 60 seconds;
- escalating principal cool-off beginning at 30 seconds and capped at 15 minutes;
- a successful authentication clears the principal failure history;
- source traffic remains rate-limited after a success so one successful account cannot reset stuffing/spraying protection;
- generic authentication failure response does not distinguish nonexistent user, wrong password, restricted account or lockout;
- generic throttle response does not expose which internal bucket fired;
- blocked HTTP behavior is validated against the canonical 24.08 `429 Too Many Requests` response contract.

These dual buckets prevent the classic mistake of rate-limiting only on an IP+username pair. The account/principal bucket still trips when one account is attacked from many sources, while the source bucket trips when one source sprays many accounts.

## Abuse scenarios

The verifier exercises targeted brute force, distributed targeted guessing, password spraying, credential stuffing, lockout/backoff, expiry, successful-login reset, generic failure behavior and canonical 429 response validation.

## Claim boundaries

This task does not claim production identity-provider integration, a production distributed limiter store, Admin MFA certification, rate-limit bypass certification (41.11), or bot/scripted bidding certification (41.12).

Implementation: `packages/domain/src/authentication-bruteforce.ts`

Run: `node scripts/verify-authentication-bruteforce-41-05.mjs --self-test`
