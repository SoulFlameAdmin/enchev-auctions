# SYSTEM 41.06 — Session fixation/revocation test

This certification adds a reusable server-side authenticated-session lifecycle and tests fixation, rotation, revocation and replay behavior without inventing a production identity-provider integration.

## Repository reality

The Enchev repository does not currently contain a production login/session provider implementation. Therefore this task certifies the repository-side session security contract that a production auth adapter must use; it does not claim a live Supabase/Auth session flow.

## Session guarantees

- authenticated session identifiers are **server-issued only**; client-proposed authenticated session IDs are rejected;
- authentication issues a fresh identifier;
- privilege changes and password changes require a fresh identifier and an advanced security version;
- the old session is revoked before the replacement becomes active;
- replay of a rotated, logged-out or globally revoked session fails closed;
- a session cannot be reused across users;
- stale security-version sessions fail closed;
- idle and absolute expiration are enforced independently;
- generated ID collisions are rejected rather than reused;
- the cookie contract is host-only `__Host-enchev-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, and no Domain attribute.

## Abuse certification

The verifier covers 12 scenarios: client-chosen fixation, authentication rotation, privilege/password rotation, old-token replay, logout replay, revoke-all replay, cross-user reuse, security-version staleness, idle expiry, absolute expiry and generated-ID collision.

## Claim boundaries

This task does not claim production IdP session integration, a distributed production revocation store, or actual browser cookie emission. Admin MFA (41.07) and privilege-escalation certification (41.08) remain separate tasks.

Implementation: `packages/domain/src/session-security.ts`

Run: `node scripts/verify-session-fixation-revocation-41-06.mjs --self-test`
