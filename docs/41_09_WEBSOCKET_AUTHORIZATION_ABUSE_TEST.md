# SYSTEM 41.09 — WebSocket authorization abuse test

This task certifies the repository-side authorization contract for authenticated realtime connections and auction-room actions while keeping the currently implemented transport honest about its security boundary.

## Repository reality

`apps/realtime/server.mjs` is now an implemented non-authoritative WebSocket transport used for local/CI performance certification. It has a real upgrade handler and persistent socket delivery, so the old `not-implemented` claim is no longer correct.

The runtime does **not** yet integrate the production server-side session state and room authorization contract. Until that integration exists, the runtime is fail-closed to loopback hosts only (`127.0.0.1`, `::1`, or `localhost`). A non-loopback bind is rejected at startup.

Therefore 41.09 certifies the authorization guard in `packages/domain/src/websocket-authorization.ts` and the loopback containment of the certification runtime. It does not claim a production-authenticated WebSocket service.

## Guard behavior

- connection identity comes only from a server-upgraded authenticated socket context;
- client-supplied actor/role claims are rejected;
- handshake authorization requires an active, current authenticated session;
- each room action re-validates the session, so logout, privilege changes or revoke-all invalidate stale socket activity;
- room grants are bound to actor, session, security version, auction and expiration;
- a grant for auction A cannot be reused for auction B;
- `watch` grants cannot be upgraded client-side into `bid` or `operate`;
- `bid` additionally requires the existing `buyer.submit-bid` function authorization;
- `operate` additionally requires `auctioneer.control-lane` authorization and exact auction assignment.

## Abuse certification

The verifier covers 16 authorization cases including forged identity/roles, inactive/revoked sessions, foreign grants, stale security version, cross-auction reuse, expired grants, action upgrade, wrong-role use, missing auction assignment and stale socket reuse after revocation.

The verifier also fails if the local certification runtime stops being loopback-only or if the repository starts claiming production session authorization without a dedicated review.

## Claim boundaries

- local/CI WebSocket runtime: implemented;
- persistent upgrade handler: implemented;
- network exposure before auth integration: loopback-only;
- production session authorization integration: not claimed;
- production room authorization integration: not claimed;
- frozen Phase 10 authenticated-handshake/room completion: not claimed here;
- critical-request replay/duplicate certification remains 41.10.

Implementation: `packages/domain/src/websocket-authorization.ts`

Runtime containment: `apps/realtime/server.mjs`

Run: `node scripts/verify-websocket-authorization-abuse-41-09.mjs --self-test`
