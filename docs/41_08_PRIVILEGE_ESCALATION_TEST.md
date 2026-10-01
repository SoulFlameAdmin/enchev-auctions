# SYSTEM 41.08 — Privilege-escalation test

This certification adds the missing server-side privilege-mutation guard and tests horizontal and vertical escalation attempts.

## Enforcement

A role/permission change can occur only after the caller passes:

1. the 41.04 `admin.manage-users` function authorization gate;
2. an active 41.06 authenticated session;
3. the 41.07 fresh AAL2 MFA enforcement gate.

The mutation layer then independently enforces:

- no self privilege mutation;
- compare-and-swap against the target account security version;
- every permission must be backed by at least one requested role;
- unknown roles/permissions and duplicate entitlement injection are rejected;
- any privilege mutation increments the target security version;
- every active session for the target account is revoked immediately so an old session cannot retain pre-change privileges;
- adding/removing `security-admin` / `security.break-glass` requires a caller that already holds both admin and security-admin authority (separation of duties).

## Abuse certification

The verifier covers self-promotion, cross-role permission injection, security-admin escalation, stale target-version replay, old-session reuse after promotion/demotion, client-context mutation, missing MFA, invalid role/permission injection and a valid admin-to-other-user promotion.

## Claim boundaries

This task certifies the repository-side privilege mutation contract. It does not claim production directory-provider integration, database persistence of roles, or an organizational approval workflow for security-admin changes. WebSocket authorization remains 41.09.

Implementation: `packages/domain/src/privilege-escalation.ts`

Run: `node scripts/verify-privilege-escalation-41-08.mjs --self-test`
