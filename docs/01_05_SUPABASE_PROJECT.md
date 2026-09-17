# Enchev Auctions — 01.05 Supabase project

Status: YELLOW — project identity and Enchev-only binding are implemented; CI/live verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `01.05`
Execution wave: `WAVE 1 — Engineering foundation & cross-cutting design`
Depends on: completed Wave 0 governance baseline

## Bound project
- Supabase project ref: `frhletkiuupgksmgxoxc`
- Project name: `soulflame-twins`
- Region: `eu-west-1`
- Expected provider status: `ACTIVE_HEALTHY`
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
The shared Supabase project has unrelated security-advisor findings in other schemas/tables/functions. They are not modified under task 01.05 because doing so could affect unrelated systems. Those findings must be handled by their owning workstreams or by a future explicit Enchev dependency when applicable.

Task 01.05 does **not** claim:
- production auction PostgreSQL authority;
- production bid/result tables;
- isolated production Supabase tenancy;
- Redis, KYC, storage, or provider readiness.

## GREEN gate
Mark 01.05 GREEN only when all of the following are true:
1. Supabase project is provider-reported `ACTIVE_HEALTHY` with the exact ref/region above.
2. Enchev allowlisted resources are present and do not expose direct public table writes.
3. Binding invariant self-tests PASS.
4. Public live endpoint test PASS.
5. TypeScript and production build PASS in the same successful CI run/verified descendant.
6. Evidence is recorded in this document and in the Command Center verified evidence map.

No pricing/payment/finance scope is added.
