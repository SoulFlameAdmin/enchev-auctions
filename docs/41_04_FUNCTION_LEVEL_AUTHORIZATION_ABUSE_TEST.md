# SYSTEM 41.04 — Function-level authorization abuse test

This certification adds and tests a server-side **function/capability authorization gate** for privileged Enchev operations.

## Security model

Authorization is not inferred from UI visibility and role alone is not enough. A protected function requires all of the following:

1. a server-derived authenticated context;
2. an active account;
3. an allowed role for the capability;
4. the exact explicit capability permission;
5. the required scope:
   - **own** — the protected object belongs to the actor;
   - **assigned** — the actor has the exact capability/resource assignment;
   - **global** — only the explicitly allowed privileged role may call it.

No wildcard permission is accepted.

## Covered capabilities

The gate covers representative high-risk functions across buyer bidding, seller listing/reserve mutation, support case work, compliance review, inspection, yard custody, auctioneer lane control, admin user/configuration management and security break-glass access.

## Abuse certification

The verifier attempts both horizontal and vertical function escalation: buyer→seller/admin, seller→buyer/admin, support→auctioneer/admin, compliance→bidding, yard→seller/admin, auctioneer→seller/admin, missing-permission calls, client-sourced contexts, inactive accounts, foreign own-scope access and unassigned resource access.

This task does **not** claim that Admin MFA (41.07), general privilege-escalation certification (41.08), or WebSocket authorization (41.09) are complete.

Implementation: `packages/domain/src/function-authorization.ts`

Run `node scripts/verify-function-level-authorization-abuse-41-04.mjs --self-test`.
