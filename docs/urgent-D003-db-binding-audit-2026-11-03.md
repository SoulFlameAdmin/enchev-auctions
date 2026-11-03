# ENCHEV AUCTIONS — D003 / Supabase DB Binding & Role Boundary Audit
**Date:** 3 Nov 2026 · **Status:** BLOCKED (3/7 verified) · **Owner:** Борко / Mitko / provider administrators
**Source of truth:** Original 119-day urgent plan D003. Dependency D002 = DONE. Its actual acceptance criterion is **"Потвърден authoritative DB target, миграции и отделни staging/production роли"**. A code-only contract or simulated PASS cannot fulfill this criterion.

## Findings from live, read-only service observations

| Item | Verified fact | Decision |
|---|---|---|
| Governance source repository pointer | `config/enchev-supabase-project.json` points to **soulflame-twins** (`frhletkiuupgksmgxoxc`), `eu-west-1`, `development-governance`, `auction_authority:false` | Do NOT use for real auctions or as staging |
| Governance project live metadata | Direct Supabase connector access to this project **denied by permissions**; its ACTIVE_HEALTHY claim is repository config, not live proof | Owner must verify with authorized project connection |
| Auction/demo database | Connected `enchev-auctions` project (`ejfrnjhlggebzmpmxajl`), `eu-central-1` (Frankfurt), **ACTIVE_HEALTHY**, PostgreSQL 17.11 | Candidate DB, not authenticated runtime production binding |
| Schema | **28 public tables**, each reported with RLS enabled; **28 migration records**. Auction module: `enchev_etap1_*` (demonstration), buyer profiles and early access | Database inventory inspected; RLS alone does not certify full access safety |
| Co-resident services | Same reachable DB also includes `sf_dpp_*`, `sfcal_*`, `david_*` public tables | Separate authorization and tenant audit needed |
| Supabase staging | **Zero development branches** returned; connected project list includes only one accessible project, no separately proven staging project | Block D004 production-data fixture writes until isolated staging confirmed |
| Vercel runtime environment bindings | Read-only metadata list returned **HTTP 403** even with explicit project/team and `decrypt:false` | Could not verify actual preview/production database URLs, key scopes or roles |
| Vercel stage | Repo contract defines staging as **Vercel Preview**, production as **main-only Vercel** | UI deployment separation does NOT imply independent staging database |
| Supabase security advisors | **3 WARN:** `SECURITY DEFINER` functions callable by anonymous or authenticated roles, leaked-password protection disabled. One INFO for RLS tables with no policies | Owner/security audit before real-money rollout |
| Database function grants | Safe SELECT of `pg_proc`/grants found `david_guest_get`, `david_guest_save`, `sfcal_day_set_status`, `sfcal_day_view` among publicly executable privileged functions; Enchev Etap1 bid procedures in that query were **not** executable by `anon` or `authenticated` | Risk needs owning-team review, not an unapproved role change |

**Important:** The findings are an authorized, read-only snapshot, not a continuing health guarantee. Source references and environment IDs are **project identifiers, not database credentials**. No secret values, actual client records, passwords or payment data were read.

## Detailed separation that must be preserved

**System A — Plan/Governance**, project `frhletkiuupgksmgxoxc`: Existing source reference for plan state and development status. This is a shared project explicitly marked `auction_authority:false` in source. Cannot infer live availability from the source, and this Supabase connection cannot inspect it.

**System B — Connected auction/demo**, project `ejfrnjhlggebzmpmxajl`: Actual healthy Supabase project with `enchev_etap1_` demonstration tables. Its credentials' binding to **production runtime** was not accessible; it is NOT certified as the real-money platform's authoritative DB or isolated staging.

**System C — Dedicated staging database**: Not confirmed. The `staging:vercel-preview` runtime mode alone does not create this system or its database identity/role segregation.

## D003 acceptance matrix (3 verified, 4 not verified)

1. **D003-G1 BLOCKED:** Show which production environment variables actually bind to auction DB; do not show secret values. Confirm API server/worker runtime connects to the same approved project and has least-privilege rights.
2. **D003-G2 BLOCKED:** Obtain authorization to read governance project metadata and inspect the allowlisted resources; never promote it to auction authority.
3. **D003-G3 BLOCKED:** Owner approves/provisions an independently isolated staging Supabase project or branch and confirms no production customer data/real funds.
4. **D003-G4 BLOCKED:** Demonstrate **different least-privilege production and staging roles** and isolated secrets. Server-only keys must not enter the browser or Preview accidentally.
5. **D003-G5 VERIFIED (read-only):** Inventory and migrations from the connected Enchev project; 28 tables, 28 applied migrations, RLS flags and branch list.
6. **D003-G6 VERIFIED (scope):** No secrets introduced in source/audit file. The existing secrets review CI must remain enforced.
7. **D003-G7 VERIFIED (read-only):** Supabase Security Advisor observations plus privileged function grant list, pending issue-owner review.

**Day 3 is not DONE** until all four external evidence gates pass. The tracked dashboard must say **BLOCKED**, not artificially PASS due to successful static schema tests.

## Technical approach and owner actions

1. Owner grants authorized view-only project metadata access to `soulflame-twins` (or a project administrator returns a verified, secret-free metadata report).
2. Vercel project owner uses privileged project UI to confirm **only names, target environments and project references** of the relevant Supabase bindings. The connected environment-list API is currently returning 403. Do **not** send credential values to ChatGPT.
3. Establish a separate staging DB/project with isolated auth users, RLS, branch environments and secret scopes. If provisioning incurs cost or shares live data, seek business-owner approval first.
4. Validate role and schema permissions **read-only** on each project. Test forbidden cross-env/cross-tenant access with synthetic fixtures **only on staging** after it exists.
5. Record evidence CI/owner-reviewed screenshots or metadata export (with secrets redacted). Update `config/urgent-D003-db-binding-audit.json` gates after independent confirmation and only then mark the D003 day accepted.

## What changed in this PR

- `config/urgent-D003-db-binding-audit.json`: two known Supabase project identities, production/preview/staging evidence gaps, current security observations and seven atomic release gates.
- `scripts/verify-urgent-d003-db-boundary.mjs`: fail-closed contract and negative tests for fake production roles, stage separation and secret material. **Passing this script does not complete the original D003.**
- `app/components/UrgentPlan119.tsx`: displays D003 3/7 and the blockers, seeds D003 as BLOCKED if unrecorded, and rejects false manual DONE until evidence gates allow it; existing D001/D002 statuses remain accepted.
- No Supabase migration, SQL mutation, Vercel secret mutation, master plan rewrites, real bid/financial activation, or DAVID infrastructure edits.

## Related references

- [Immutable original 119 days](https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/app/data/urgent-119-days.json)
- [Existing governance-only project contract](https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/config/enchev-supabase-project.json)
- [Runtime stage model](https://github.com/SoulFlameAdmin/enchev-auctions/blob/main/config/enchev-runtime-environments.json)
- [D002 completed evidence](https://github.com/SoulFlameAdmin/enchev-auctions/pull/402)
