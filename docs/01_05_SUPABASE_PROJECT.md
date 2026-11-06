# Enchev Auctions — 01.05 Supabase project

## Canonical Enchev-owned project — 2026-11-07

- **Supabase ref:** `ejfrnjhlggebzmpmxajl`
- **Project:** `enchev-auctions`
- **Organization:** `EnchevAuctions`
- **Region:** `eu-central-1`
- **Observed provider status:** `ACTIVE_HEALTHY`
- **API base:** `https://ejfrnjhlggebzmpmxajl.supabase.co`
- **Dedicated governance table:** `public.enchev_plan_state`, RLS enabled, no direct `anon` or `authenticated` grants.
- **Dedicated Edge Function:** `enchev-plan-state`, ACTIVE (v2) in the same project.
- **Live verification:** [Verify Enchev Web run 42304527377](https://github.com/SoulFlameAdmin/enchev-auctions/actions/runs/42304527377) established HTTP 200 with a `rows` array and HTTP 401 for a POST without OIDC.
- **Canonical repository binding:** `config/enchev-supabase-project.json` records `shared_project:false` and `scope:enchev-only-development-governance`.

The plan-state database is a **governance projection only**, not the authoritative database for production bids, auction winners, payments or vehicle release. Existing Enchev auction/buyer tables retain their own RLS and responsibility.

## Security
- Edge writes require signed GitHub OIDC JWT with exact repository ID, main-branch push, approved workflow, short-lived audience and issuer claims.
- Edge reads are polled at bounded frequency only from the admin console; there is no public homepage SSE snapshot flood.
- `public.enchev_plan_state` cannot be accessed through browser anonymous Data API privileges.
- Source-backed GREEN proof and explicitly blocked YELLOW entries are eligible for the main-only GitHub sync; cloud GREEN still requires actual write/read-back after required CI succeeds.

## Historical 2026-09-19 configuration — superseded
Earlier task 01.05 evidence verified a **shared development-governance** setup at `frhletkiuupgksmgxoxc` (`soulflame-twins`, `eu-west-1`). That historical project included `enchev_plan_state`, `enchev_development_events`, `enchev-plan-state`, and `enchev-development-status` resources. It was not Enchev auction authority.

Historical verification included GitHub run `35249157579` SUCCESS and binding commit `37ca377d6c4a553313d7b2a11cf4e40d44506197`. Those historical claims must not be confused with the new canonical project.

**Data preservation:** The Twins project cannot currently be read by the connected Supabase account and previously returned `exceed_egress_quota` HTTP 402. No complete export of its history, cloud-only rows or development events has been established. They remain untouched and are not claimed migrated. See `docs/ENCHEV_GOVERNANCE_ISOLATION_2026_11_07.md`.

## Acceptance boundary

This revision makes the project's own governance storage available and independently testable. The source, new client binding, OIDC sync and exact 309th GREEN evidence remain subject to PR review, required checks, merge and cloud read-back. It is not permission to bypass security checks, change billing, claim legal residency approval or enable real-money auctions.
