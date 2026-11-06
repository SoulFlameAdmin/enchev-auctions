# Enchev-owned MASTER governance migration (2026-11-07)

## Real destination
- Supabase project: `enchev-auctions` / `ejfrnjhlggebzmpmxajl`, EU Central.
- Schema: `public.enchev_plan_state`; migration version `20261106221943` applied successfully. RLS enabled; `anon` and `authenticated` table privileges revoked.
- Edge Function: `enchev-plan-state` on the same Enchev project; live GET returned HTTP 200 and **unsigned POST returned HTTP 401** in [Verify Enchev Web #42304527377](https://github.com/SoulFlameAdmin/enchev-auctions/actions/runs/42304527377).
- Browser: protected admin route `/admin/console` only, with bounded polling (300,000 ms), no full-snapshot SSE.
- GitHub CI: main-only OIDC writes after `verify-web`; Edge validates GitHub JWT RSA signature against issuer JWKS and pins repository ID, exact workflow, `push`, `main`, subject, issuer, audience and SHA.
- Only source-backed GREEN evidence and explicitly blocked YELLOW source entries are synchronized. Each posted row receives the exact GitHub commit and run provenance.
- The Enchev governance projection is **not** an auction/bidding/payment authority.

## Preservation and cutover
- Previous shared governance project `soulflame-twins` (`frhletkiuupgksmgxoxc`) remains untouched. It had a confirmed external egress 402; our connected Supabase access does not permit reading it.
- There is **no evidence of a complete historical export** from the old project. Its cloud-only rows, change/audit history and development event records have NOT been migrated or silently marked GREEN.
- GitHub source carries 309 independently verified GREEN entries and an explicit YELLOW blocker for 29.08 in this PR; they can be projected when required CI is green, PR is merged and main-only OIDC write/read-back passes. Do not claim a live GREEN counter before that read-back.
- No manual upsert, fabricated provider response, production auction data mutation, or billing upgrade was used.
- Do not delete or disable the old project's resources. Archive/migrate remaining historical rows separately only after an authorized source export, record-by-record reconciliation and backups.

## Verification and rollback
1. `node scripts/verify-supabase-project-binding.mjs` and `--self-test`: check exact Enchev host, resource allowlist, source isolation and OIDC security invariants.
2. `node scripts/verify-supabase-project-binding.mjs --live`: HTTP 200 `rows` plus unauthenticated write denial.
3. `node scripts/verify-cloud-plan-state.mjs` and `--self-test`: admin-only polling and read-back contract.
4. On merged main only, successful `sync-plan-cloud` proves the exact GitHub commit for each migrated row; query Enchev DB for row count and exact 24.08 evidence after sync.
5. If the Enchev provider breaks, freeze promotion/mark YELLOW and restore the last verified Enchev state; never silently point clients back at Twins.

**Scope limitation:** This is an isolated governance data plane, not a database migration of all consumer profiles, auctions, DAVID, SoulFlame DPP, or unrelated projects.
