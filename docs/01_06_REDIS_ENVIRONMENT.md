# Enchev Auctions — 01.06 Redis environment

Status: YELLOW — Redis environment contract, CI guard and production runtime probes are implemented; production has no Redis/Valkey binding yet
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
`config/enchev-redis-environment.json` defines the non-secret Redis environment contract.

Supported binding shapes:
- TCP/TLS: `REDIS_URL` (`redis://` local only, `rediss://` required remotely);
- Upstash REST: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`;
- Vercel KV REST compatibility: `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

All application keys use the `enchev:` prefix. No Redis secret values may be committed to the repository. A real live PING/PONG is mandatory before 01.06 can become GREEN.

The provider remains `null` and binding status remains `pending-live-provider` until a real managed Redis/Valkey instance is connected and verified.

## Automated verifier
`scripts/verify-redis-environment.mjs` provides three modes:
- default: validates the repository contract;
- `--self-test`: runs negative tests against authority drift, env-name/binding drift, key-prefix drift, missing GREEN live gate, incomplete forbidden-authority roles, secret leakage, invalid TCP URL schemes, non-TLS remote Redis and non-HTTPS REST URLs;
- `--live`: performs a real Redis PING against the first configured supported binding without printing token/password/URL values.

## Production runtime probe
`app/api/health/redis/route.ts` performs the same non-authoritative Redis health check from the deployed Vercel Node runtime.

The endpoint returns only sanitized fields:
- `configured`;
- `ok`;
- `status`;
- binding kind, TLS boolean and latency on a successful PING.

It never returns Redis hostname, username, password, token or environment-variable values. Missing bindings return HTTP 503 with `configured=false`; configured-but-failing bindings return HTTP 503 with `configured=true`.

## CI behavior
The normal web verification workflow runs the Redis contract invariant and self-tests. It intentionally does **not** run `--live` in GitHub Actions because no authorized Redis secret/provider binding has been established in CI. Adding a fabricated URL or secret would violate the frozen evidence rules.

## Observed infrastructure baseline
- repository originally had no Redis implementation/binding;
- Vercel project `enchev-auctions` is healthy and deploying;
- Supabase is PostgreSQL-based and is not treated as a Redis substitute;
- Vercel documentation confirms Marketplace Redis/Upstash provisioning and project environment-variable APIs exist, but the connected Vercel tool surface in this session does not expose Marketplace mutation or environment-variable mutation actions;
- Plugin Directory lookup did not expose an installable Upstash/Redis/Valkey connector for direct provisioning in this session.

## Attempt 1 blocker evidence — 2026-09-17
A safe production probe was added and deployed to determine whether canonical `REDIS_URL` already existed but was hidden from project metadata.

Evidence:
- runtime-probe implementation commit: `980841c1acece87e3b422e0dd359c5b7ee7aafa6`;
- GitHub Actions run `35251323401`: verify-web SUCCESS and sync-plan-cloud SUCCESS;
- Redis environment contract invariant PASS;
- Redis environment self-tests PASS;
- TypeScript PASS;
- production build PASS;
- Vercel deployment `dpl_AdVAgbByUCKnNb36dZwzzBNxzhmb`: READY on exact implementation commit;
- exact deployment `/api/health/redis`: HTTP 503 with sanitized body `{"ok":false,"configured":false,"status":"missing-redis-url"}`.

This proved the production runtime did not receive `REDIS_URL`.

## Attempt 2 evidence — 2026-09-17
The binding contract and runtime probe were expanded to avoid a false blocker if Vercel/Upstash had supplied standard REST integration variables instead of `REDIS_URL`.

Evidence:
- contract update commit: `aa1fa9e8c3ba8f144dbf1e69d9364681d1715224`;
- verifier update commit: `b93572b47c4badf4a22ea521365fbdfc06c5a690`;
- runtime probe update commit: `3838d7b9cd64bb560738882cb03c6d9dcda8467c`;
- GitHub Actions run `35252283953`: verify-web SUCCESS and sync-plan-cloud SUCCESS;
- `REDIS_ENV_CONTRACT PASS`;
- `REDIS_ENV_SELF_TEST PASS config_cases=8 tcp_url_cases=3 rest_url_cases=2`;
- TypeScript PASS;
- production build PASS and `/api/health/redis` present as a dynamic route;
- evidence/retrigger descendant: `f4379f86fdcf9ccbd7516345f4fb583555893215`;
- Vercel deployment `dpl_FEJ5EMyuqPzV1oouvmapDg4JzB95`: READY on that descendant;
- Vercel build: compile PASS, TypeScript PASS, static generation 9/9;
- exact deployment `/api/health/redis`: HTTP 503 with sanitized body `{"ok":false,"configured":false,"status":"missing-redis-binding"}`.

This proves the production runtime receives none of the supported Redis binding shapes: no `REDIS_URL`, no complete Upstash REST pair and no complete Vercel KV REST pair.

The direct Vercel deploy tool was also attempted but its current connector schema cannot supply backend-required deployment parameters. Vercel project metadata does not expose an environment-variable mutation or Marketplace resource provisioning action through the connected tool surface.

## GREEN gate
01.06 may become GREEN only when all of the following are evidenced:
1. a real Redis/Valkey provider instance is provisioned for Enchev;
2. staging/production secret injection is configured outside Git using one supported binding shape;
3. remote TCP Redis uses TLS and REST binding uses HTTPS;
4. either `node scripts/verify-redis-environment.mjs --live` or production `/api/health/redis` returns a successful PONG;
5. contract invariant + self-tests PASS;
6. TypeScript + production build PASS on the exact commit or a verified descendant;
7. exact evidence is recorded here and synced to Command Center cloud state.

## Current blocker
Production evidence now proves that no supported Redis/Valkey binding exists in Vercel. The connected GitHub/Vercel/Supabase tools still cannot provision a Marketplace Redis resource or create the required project environment variables/secrets. Therefore 01.06 remains YELLOW and dependent work must not treat Redis as production-ready.

No pricing/payment/finance scope is added.
