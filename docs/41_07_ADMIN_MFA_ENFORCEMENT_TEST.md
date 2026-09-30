# SYSTEM 41.07 — Admin MFA enforcement test

This task adds and certifies a server-side MFA enforcement gate for privileged Enchev actors.

## Repository reality

The repository did not previously contain a production MFA provider or an Admin MFA enforcement layer. This implementation adds the reusable enforcement contract without claiming that a live identity provider, factor-enrollment UI, recovery flow, or phishing-resistant factor provider is already wired.

## Enforcement contract

An admin or security-admin function call must still pass the normal 41.04 function authorization checks **and** the 41.06 authenticated-session checks. MFA does not replace role, permission, scope, or session validation.

For privileged actors, the server additionally requires:

- MFA assurance marked as coming from a server-verified provider;
- AAL2;
- at least two distinct factor classes;
- assurance bound to the exact actor;
- assurance bound to the exact active session ID;
- assurance bound to the current session security version;
- a fresh step-up no older than 15 minutes;
- factor evidence timestamps that do not post-date the assurance or current time.

A stale, foreign, client-asserted, single-factor, AAL1 or absent MFA assertion fails closed.

## Abuse certification

The verifier covers 12 scenarios: admin/security-admin without MFA, AAL1, two factors from only one factor class, stale step-up, foreign actor/session assurance, stale security version, client-asserted assurance, expired session with otherwise valid MFA, MFA without underlying role/permission, and a valid two-factor admin step-up.

## Claim boundaries

41.07 does not claim production MFA provider integration, factor enrollment UX, account recovery, or phishing-resistant MFA. General privilege-escalation certification remains 41.08.

Implementation: `packages/domain/src/admin-mfa-enforcement.ts`

Run: `node scripts/verify-admin-mfa-enforcement-41-07.mjs --self-test`
