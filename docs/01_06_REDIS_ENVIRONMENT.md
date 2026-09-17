# Enchev Auctions — 01.06 Redis environment

Status: YELLOW — Redis environment contract, CI guard and production runtime probe are implemented; no provisioned/live Redis provider has been proven yet
MASTER SYSTEM PLAN v1.0 FROZEN task: `01.06`
Execution wave: `WAVE 1 — Engineering foundation & cross-cutting design`
Depends on: `01.05 Supabase project` GREEN and completed Wave 0 governance baseline

## Contract
Redis is a **non-authoritative support dependency**. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

Allowed Redis roles:
- cache;
- rate-limit support;
- realtime fanout support;
- ephemeral coordination.

Forbidden Redis roles:
- accepted-bid authority;
- auction-state authority;
- winner authority;
- final-result authority.

## Repository binding
`config/enchev-redis-environment.json` defines the non-secret Redis environment contract:
- canonical secret variable name: `REDIS_URL`;
- accepted schemes: `redis:` and `rediss:`;
- non-local Redis must use TLS (`rediss:`);
- all application keys use the `enchev:` prefix;
- no Redis secret values may be committed to the repository;
- a real live `PING` is mandatory before 01.06 can become GREEN.

The provider remains `null` and binding status remains `pending-live-provider` until a real managed Redis/Valkey instance is connected and verified.

## Automated verifier
`scripts/verify-redis-environment.mjs` provides three modes:
- default: validates the repository contract;
- `--self-test`: runs negative tests against authority drift, env-name drift, key-prefix drift, missing GREEN live gate, incomplete forbidden-authority roles, secret leakage, invalid URL schemes and non-TLS remote Redis;
- `--live`: performs a real RESP `PING` against `REDIS_URL`, including optional Redis AUTH, using Node built-ins only. It never prints the password/token.

The verifier supports local `redis://localhost` for development and requires `rediss://` for non-local endpoints.

## Production runtime probe
`app/api/health/redis/route.ts` performs the same non-authoritative Redis health check from the deployed Vercel Node runtime.

The endpoint returns only sanitized fields:
- `configured`;
- `ok`;
- `status`;
- TLS boolean and latency on a successful PING.

It never returns Redis hostname, username, password, token or the `REDIS_URL` value. A missing runtime secret returns HTTP 503 with `configured=false`; a configured endpoint that cannot answer PING returns HTTP 503 with `configured=true` and `redis-ping-failed`.

## CI behavior
The normal web verification workflow runs the Redis contract invariant and self-tests. It intentionally does **not** run `--live` yet because no authorized Redis secret/provider binding has been established in CI. Adding a fabricated URL or secret would violate the frozen evidence rules.

## Observed infrastructure baseline
At task start:
- repository search found no Redis implementation and no `REDIS_URL` reference;
- Vercel project `enchev-auctions` is healthy and deploying, but the available project metadata does not prove a Redis data store or expose a Redis binding;
- Supabase is PostgreSQL-based and is not treated as a Redis substitute;
- Vercel documentation confirms Redis can be provisioned through a Marketplace integration such as Upstash, but the connected Vercel tool surface in this session does not expose Marketplace provisioning or environment-secret mutation actions.

Absence from these surfaces is recorded as **not proven**, not as proof that no external Redis account exists.

## GREEN gate
01.06 may become GREEN only when all of the following are evidenced:
1. a real Redis/Valkey provider instance is provisioned for Enchev;
2. staging/production secret injection is configured outside Git;
3. `REDIS_URL` uses TLS for non-local environments;
4. either `node scripts/verify-redis-environment.mjs --live` or the production `/api/health/redis` probe returns a successful PONG against the bound instance;
5. contract invariant + self-tests PASS;
6. TypeScript + production build PASS on the exact commit or a verified descendant;
7. the exact evidence is recorded here and synced to the Command Center cloud state.

## Current blocker
No authorized/proven live Redis provider endpoint or secret is available through the connected GitHub/Vercel/Supabase surfaces. Therefore 01.06 remains YELLOW and the next dependent foundation task must not be treated as if Redis were production-ready.

No pricing/payment/finance scope is added.
