# Enchev Auctions — 01.05 Supabase project

Status: GREEN — exact shared Supabase development/governance binding is provider-verified, CI-guarded and live-endpoint verified
MASTER SYSTEM PLAN v1.0 FROZEN task: `01.05`
Execution wave: `WAVE 1 — Engineering foundation & cross-cutting design`
Depends on: completed Wave 0 governance baseline

## Bound project
- Supabase project ref: `frhletkiuupgksmgxoxc`
- Project name: `soulflame-twins`
- Region: `eu-west-1`
- Provider status at verification: `ACTIVE_HEALTHY`
- PostgreSQL engine: `17`
- Canonical API base: `https://frhletkiuupgksmgxoxc.supabase.co`

The project is shared with other SoulFlame/DAVID/Zorbas workloads. For Enchev, this binding is deliberately limited to development/governance resources and **must not be interpreted as production auction authority**.

## Enchev resource allowlist observed
Tables:
- `public.enchev_development_events`
- `public.enchev_plan_state`

Edge Functions:
- `enchev-development-status`
- `enchev-plan-state`

Both observed Enchev tables have RLS enabled and zero `anon` / zero `authenticated` table grants. Cloud plan writes remain behind the existing GitHub OIDC Edge Function path.

## Repository contract
`config/enchev-supabase-project.json` is the non-secret canonical binding. It contains only public project identity/scope metadata and an Enchev resource allowlist. It explicitly records:
- `shared_project: true`;
- `scope: development-governance`;
- `auction_authority: false`.

`scripts/verify-supabase-project-binding.mjs` rejects:
- project-ref or URL drift;
- region/name drift;
- falsely marking the shared project as auction authority;
- expansion outside the Enchev resource allowlist;
- secret-like fields in the binding file;
- disagreement between the canonical project URL and the existing cloud-state client/sync code.

CI also performs a public live GET against `enchev-plan-state`; no Supabase secret is required.

## Security boundary
The shared Supabase project has unrelated security-advisor findings in other schemas/tables/functions. They are not modified under task 01.05 because doing so could affect unrelated systems. The latest provider advisor includes `public.spatial_ref_sys` with RLS disabled, PostGIS installed in `public`, unrelated SECURITY DEFINER grants, and leaked-password protection disabled. Those findings belong to their owning workstreams or to a future explicit Enchev dependency when applicable.

Task 01.05 does **not** claim:
- production auction PostgreSQL authority;
- production bid/result tables;
- isolated production Supabase tenancy;
- Redis, KYC, storage, or provider readiness.

## GREEN evidence
Provider evidence:
- Supabase project `frhletkiuupgksmgxoxc` reported `ACTIVE_HEALTHY` in `eu-west-1`;
- project URL verified as `https://frhletkiuupgksmgxoxc.supabase.co`;
- Enchev tables `enchev_development_events` and `enchev_plan_state` verified with RLS enabled and zero `anon` / zero `authenticated` table grants;
- Enchev Edge Functions `enchev-development-status` and `enchev-plan-state` verified ACTIVE.

Repository / CI evidence:
- canonical binding config commit: `37ca377d6c4a553313d7b2a11cf4e40d44506197`;
- binding verifier commit: `8795af9214b6dcbc9e380b97950d18919cec01b2`;
- governance document implementation commit: `5d62ecef07a3717a773b603ff38483e6c7406259`;
- GitHub Actions run `35249157579`: SUCCESS on exact implementation commit;
- `Supabase project binding invariant`: PASS;
- `Supabase project binding self-tests`: PASS (`7` negative cases rejected);
- `Supabase project live endpoint`: PASS;
- all prior governance guards in the same run: PASS;
- TypeScript check in the same run: PASS;
- production build in the same run: PASS;
- `sync-plan-cloud` job in the same run: PASS.

Production regression evidence:
- canonical production URL returned HTTP `200` after the run;
- Vercel production error/fatal log query for the verification hour returned no matching runtime logs.

No new runtime application behavior is introduced by 01.05; the task binds and verifies existing infrastructure. Under the frozen 00.09 GREEN contract, a new exact Vercel deployment is therefore not required for this governance/foundation-only change when CI production build and live production health are proven.

No pricing/payment/finance scope is added.
