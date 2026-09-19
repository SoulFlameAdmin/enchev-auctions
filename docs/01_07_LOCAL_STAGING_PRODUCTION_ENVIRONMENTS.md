# 01.07 — Local / staging / production environments

## Goal

Define and verify three distinct Enchev Auctions runtime environments without weakening provider-specific readiness gates.

## Canonical topology

The machine-readable contract is:

`config/enchev-runtime-environments.json`

The pure shared resolver is:

`packages/config/src/runtime-environment.ts`

The topology is:

| Enchev environment | Platform mapping | Branch policy | Production authority |
| --- | --- | --- | --- |
| local | development | developer worktree | no |
| staging | Vercel Preview | non-main branch | no |
| production | Vercel Production | main-only | yes |

The public resolver maps:

- `development -> local`;
- `preview -> staging`;
- `production -> production`.

Unknown platform-environment values are rejected instead of silently falling back to production.

## Why Vercel Preview is the staging environment

Vercel exposes the standard deployment environments `development`, `preview`, and `production` through `VERCEL_ENV`.

For Enchev, the default Vercel Preview environment is the staging role. This provides isolated non-main deployment URLs for branch/PR verification without inventing a second production project or claiming that a Preview deployment is production authority.

A custom Vercel environment named `staging` is not required for task 01.07 because the verified Preview environment already supplies the required non-production deployment tier.

## Verified infrastructure evidence — 2026-09-19

Read-only provider inspection confirmed:

- Vercel project: `enchev-auctions`;
- project ID: `prj_X3TAEQf9oGE79te9NdNlvB6jnhno`;
- recent non-main deployment from branch `system/21-15-unicode-normalization-20260919`:
  `https://enchev-auctions-15mjl5h6j-dimitar-lambovs-projects.vercel.app`;
- that Preview deployment returned HTTP 200 from `/api/health/web`;
- canonical production `https://enchev-auctions.vercel.app/api/health/web` returned HTTP 200;
- CI starts the built application on localhost for health and browser verification, proving the local execution tier.

The provider API reports non-production Git deployments with `target=null`; their non-main Git ref and unique deployment URL are treated as Preview evidence, not as production.

## Provider-binding boundary

Environment topology does not imply that every external provider is already production-ready.

In particular:

- 01.06 Redis/Valkey remains YELLOW until a real managed provider binding passes live PING/PONG;
- 01.08 validates environment-variable contracts across local, CI, staging, and production;
- missing provider credentials remain owned by their provider tasks;
- no secret value is committed to the repository.

`provider_bindings_may_be_pending=true` exists specifically so environment topology can be GREEN without fabricating external provider readiness.

## Safety invariants

- local is never production authority;
- Preview/staging is never production authority;
- production authority maps only to the production platform environment;
- staging uses non-main branch deployments;
- production uses the canonical project URL;
- unknown platform environment values fail closed;
- the shared resolver is pure and does not read `process.env` directly.

## Deployment boundary

No manual Vercel create/update/redeploy operation is required for 01.07. Existing Git integration already produces Preview deployments, and the canonical Production deployment is already reachable.

Git-triggered Preview deployments remain outside the manual DAVID Vercel deploy lease rule.

## Acceptance

01.07 is GREEN only when:

1. the local/staging/production topology is machine-readable and CI-guarded;
2. the runtime resolver maps development/preview/production deterministically;
3. Preview/staging and local cannot gain production authority;
4. unknown environment values fail closed;
5. 01.08 continues to validate local/CI/staging/production variable targets;
6. a real Vercel Preview health endpoint and the canonical Production health endpoint are both observed healthy;
7. aggregate CI, TypeScript, production build, local health smoke, and Chrome/Edge regression pass with concrete evidence.

No pricing, payment, finance, tax, legal conclusion, or market-activation scope is added.
