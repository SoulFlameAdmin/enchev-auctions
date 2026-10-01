# SYSTEM 41.11 — Rate-limit bypass test

This task adds a reusable multi-bucket request limiter and certifies common bypass attempts.

## Existing foundation

SYSTEM 24.08 already defines the canonical HTTP 429 response contract. SYSTEM 41.05 adds principal + source throttling for authentication brute force. 41.11 generalizes bypass resistance for critical routes.

## Bypass-resistant policy

The limiter uses three independent sliding-window buckets:

- **actor bucket** — source/IP rotation cannot let one authenticated actor exceed its own budget;
- **trusted-source bucket** — account/actor rotation cannot let one network source exceed its budget;
- **route bucket** — rotating both actor and source still cannot exceed the route-wide safety budget.

Actor and trusted-source identity are server-derived. Client-provided actor or source/IP claims are rejected rather than trusted. Every allowed attempt counts, regardless of success/failure outcome. Server clock regression is rejected so a client cannot reset a window by manipulating request time.

The public blocked response is generic and maps into the canonical SYSTEM 24.08 429 contract without revealing which internal bucket fired.

## Abuse certification

The verifier covers 16 scenarios including source rotation, actor rotation, simultaneous actor+source rotation, spoofed identity/source claims, same-timestamp burst delivery, route-wide exhaustion, exact window recovery, clock rollback, cross-route isolation and generic/canonical 429 behavior.

## Claim boundaries

This is the repository-side limiter contract. It does not claim a production distributed/atomic limiter store, edge-proxy trusted source extraction or provider-specific WAF enforcement. Those runtime adapters must preserve these semantics. Bot/scripted bidding remains 41.12.

Implementation: `packages/domain/src/rate-limit-bypass.ts`

Run: `node scripts/verify-rate-limit-bypass-41-11.mjs --self-test`
