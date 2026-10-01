# SYSTEM 41.09 — WebSocket authorization abuse test

This task adds and certifies the repository-side authorization contract for authenticated realtime connections and auction-room actions.

## Repository reality

`apps/realtime/boundary.json` still records the realtime workspace as `implementation_state: not-implemented`. The frozen Phase 10 persistent WebSocket runtime, authenticated handshake and per-room authorization tasks do not yet have GREEN evidence in the cloud tracker.

Therefore 41.09 certifies the **authorization guard that the future runtime must invoke**. It does not claim that a production socket server, network upgrade handler or persistent room service is already running.

## Guard behavior

- connection identity comes only from a server-upgraded authenticated socket context;
- client-supplied actor/role claims are rejected;
- handshake requires an active, current authenticated session;
- each room action re-validates the session, so logout, privilege changes or revoke-all immediately invalidate stale socket activity;
- room grants are bound to actor, session, security version, auction and expiration;
- a grant for auction A cannot be reused for auction B;
- `watch` grants cannot be upgraded client-side into `bid` or `operate`;
- `bid` additionally requires the existing `buyer.submit-bid` function authorization;
- `operate` additionally requires `auctioneer.control-lane` authorization and exact auction assignment.

## Abuse certification

The verifier covers 16 cases including forged identity/roles, inactive/revoked sessions, foreign grants, stale security version, cross-auction reuse, expired grants, action upgrade, wrong-role use, missing auction assignment and stale socket reuse after revocation.

## Claim boundaries

No production WebSocket runtime, persistent service, upgrade handler or completion of frozen Phase 10 tasks is claimed. Critical-request replay/duplicate certification remains 41.10.

Implementation: `packages/domain/src/websocket-authorization.ts`

Run: `node scripts/verify-websocket-authorization-abuse-41-09.mjs --self-test`
