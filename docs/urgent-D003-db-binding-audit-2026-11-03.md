# ENCHEV AUCTIONS — D003 / Supabase database authority, staging & role boundaries

**Updated:** 2026-11-03 19:00 UTC  
**Official decision:** **BLOCKED (4/7 verified)**. The D003 repository acceptance verifier was fixed and merged in PR #409, but a passing CI run is not proof of production DB binding or service-role isolation. **Real-money auctions remain NO-GO.**  
**Owner clarification:** ENCHEV AUCTIONS primary Supabase project is `enchev-auctions` (`ejfrnjhlggebzmpmxajl`).

Original acceptance criterion (119-day plan D003): **"Потвърден authoritative DB target, миграции и отделни staging/production роли"**. D002 is DONE; D003 is not accepted.

## Current Supabase layout — independently inspected

| System | Project identity | Findings | Decision |
|---|---|---|---|
| Enchev primary | `ejfrnjhlggebzmpmxajl`, `enchev-auctions` | `ACTIVE_HEALTHY`, Frankfurt `eu-central-1`, PostgreSQL 17.11; 28 public tables, all 28 RLS-enabled, 28 applied migrations | Owner-designated primary database; **not yet independently verified as Vercel production runtime binding or real-money authority** |
| Isolated staging | `jranctnafndbqzrwcwos`, `enchev-staging`, parent `ejfrnjhlggebzmpmxajl` | Provider status `FUNCTIONS_DEPLOYED`, preview project `ACTIVE_HEALTHY`, 28 public tables, 28 RLS, 29 migration records (28 inherited + 1 staged repair), **with_data=false**; 0 rows in 4 sampled auction/early-access tables | Separate database/schema/credentials. Supabase staging infrastructure verified. **Vercel Preview is not proven to point here.** |
| Development governance | `frhletkiuupgksmgxoxc`, `soulflame-twins` | Source-file pointer `config/enchev-supabase-project.json`; `development-governance`, `auction_authority:false`. Connected Supabase tool: permission denied on live project. | Do not use as primary auction DB or staging; live governance role still unverified |

The staging branch ID is `248ecd54-771a-4830-a7ab-4a29cb81bb32`. It was created from the approved Pro organization `codopqkdjkuqvgwelonw` without data copying. **`persistent:false`: currently an ephemeral branch**, not a certified long-lived staging environment. It may be paused/deleted according to platform branch lifecycle. A persistent branch/config must be arranged before using staging as a durable team environment. The provider quoted **$0.01344/hour compute** (additional usage possible); cost was accepted by the owner before creation.

## Read-only isolation proof

Actual `SELECT count(*)` results taken from both databases (no customer records or secret values fetched):

| Measurement | Primary | Staging |
|---|---:|---:|
| Public tables | 28 | 28 |
| RLS-enabled public tables | 28 | 28 |
| `public.enchev_etap1_auctions` | 36 | 0 |
| `public.enchev_etap1_bids` | 499 | 0 |
| `public.enchev_etap1_rooms` | 1 | 0 |
| `public.ea_early_access_signups` | 5 | 0 |

The main project contains Enchev demo tables alongside `sf_dpp_*`, `sfcal_*`, and `david_*` data domains. RLS being enabled is **not** equivalent to confirmed RLS policy correctness, least-privilege role design or production suitability for payments.

## Staging migration failure and repair (staging-only)

1. New data-less branch initially reported `MIGRATIONS_FAILED` at migration `20261023132014_sfcal_day_rpc_least_privilege`, after 23 inherited migrations.
2. Staging PostgreSQL logs identified the exact failure: `function public.sfcal_day_view(text, date) does not exist` when the migration executed `REVOKE ALL ON FUNCTION public.sfcal_day_view(text,date) FROM PUBLIC`. These functions were present on the main database but absent from the staging schema at that point. This is a **reproducibility gap in the upstream migration baseline**, not evidence of corrupt customer data.
3. The two function definitions `sfcal_day_view(text,date)` and `sfcal_day_set_status(text,text,text,text)` were inspected read-only from the primary DB, then restored **to staging only** in migration `d003_staging_restore_missing_calendar_rpc_baseline`. Public, anonymous, and authenticated EXECUTE privileges were revoked in the same staging-only repair before replay.
4. Provider branch `rebase_branch` returned success and subsequent provider status became `FUNCTIONS_DEPLOYED`. Staging now reports **28 inherited migrations + 1 staged repair**, 28 public RLS-enabled tables. No production SQL writes/migrations were performed.
5. **Technical debt:** Do not assume a future fresh branch or reset will reproduce from clean migrations until the original migration dependency is corrected at its owning source. Do not merge the staging-only repair into production casually.

## D003 acceptance: 4 verified / 3 pending

| Gate | Result | Evidence / open action |
|---|---|---|
| **G1** Production runtime authoritative DB binding | BLOCKED | Vercel production/preview environment variable listing returns **HTTP 403**, even `decrypt:false`. Main project is owner-designated but server/worker binding is **not verified**. |
| **G2** Governance-only `soulflame-twins` resource access | BLOCKED | Supabase connector returns permission denied on live project. Repo pointer is NOT live authorization evidence. |
| **G3** Separate staging DB/branch with isolated data | **VERIFIED** | Provider-created `enchev-staging` branch, distinct project ref, `with_data:false`, schema fully re-applied after staging-only repair; zero sample auction/customer rows. |
| **G4** Separately scoped production/staging DB roles and Vercel secrets | BLOCKED | Distinct Supabase instances automatically have separate API credentials, **but Vercel bindings and least-privilege server role scope cannot yet be independently confirmed**. |
| **G5** Main migrations and RLS inventory | **VERIFIED** | 28 migration records, 28 public tables with RLS. |
| **G6** Source secret hygiene | **VERIFIED** | No credentials introduced in audit/source work; CI secret scanning remains enabled. |
| **G7** Security advisor/grant inventory | **VERIFIED** | Existing security warnings from live inspection logged; findings not falsely recorded as fixed. |

### Additional security cautions

Prior Supabase Security Advisor results include anonymous/authenticated `SECURITY DEFINER` RPC access and leaked-password protection disabled, plus informational RLS-no-policy findings. Review affected app owners' functions rather than revoking grants on the primary shared database without a compatibility review. No production security policy was mutated by D003.

### Remaining work for official D003 DONE

1. In Vercel, confirm **the target project refs and names of secret variables** for Production and Preview without revealing values; demonstrate Production points to `ejfrnjhlggebzmpmxajl` only where required, and Preview points to `jranctnafndbqzrwcwos` rather than main. The current connected Vercel API returns 403 for this metadata operation; the team's owner role was independently confirmed, so **an integration scope limitation is plausible**.
2. Confirm the development/governance project's restricted purpose with authorized metadata or a redacted owner-reviewed report.
3. Verify separate least-privilege DB/service roles and branch-specific credentials inside the **server-only** configuration. No service-role key in `NEXT_PUBLIC_*` or the browser. Apply a fail-closed no-production-write policy on Preview if misbound.
4. Arrange durable staging lifecycle (current `persistent:false`), repair upstream migration ordering, and run synthetic QA on staging only after Preview connectivity is proven.
5. Record all seven independent evidence receipts and only then change D003 state to `DONE`. **D004 real staging fixtures and real-money activation remain blocked until their independent gates pass.**

Original D001/D002 completion remains unchanged. Main plan and DAVID production data are untouched.
