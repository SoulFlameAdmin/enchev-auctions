# ENCHEV — P0 Stage 2: dedicated identity project and buyer RLS

**Status (2026-10-10):** Dedicated ENCHEV project `ejfrnjhlggebzmpmxajl` created in the approved `SoulFlameAdmin` organization, Frankfurt (`eu-central-1`), and verified `ACTIVE_HEALTHY`. Supabase quoted $0/month for project creation. The prepared migration `enchev_isolated_buyer_profiles` was applied as version `20261010144306`. Runtime authentication remains **OFF**. The currently connected `soulflame-twins` database must remain limited to governance. The `veska-logoped` project is unrelated.

## 1. Provisioning completed (user-approved)

Supabase organization confirmed by the owner: `SoulFlameAdmin`. Provisioning cost confirmation completed ($0/month quoted for project creation). Actual project:
- Name: `enchev-auctions` (distinct database, Auth tenants and billing).
- EU region: `eu-central-1` (Frankfurt). Project ref: `ejfrnjhlggebzmpmxajl`.
- Project credentials are never written to GitHub, comments, chat, docs, or browser JavaScript.

## 2. Deployment boundary

The existing production website stays in **preview mode**. The feature flag `ENCHEV_AUTH_ENABLED` remains false until each gate below passes.

1. **DONE:** Dedicated project provisioned. Verified project reference `ejfrnjhlggebzmpmxajl` is neither `frhletkiuupgksmgxoxc` nor `rigfvyzsfojtbkhjgvxl`.
2. Enable email verification; add allowlisted redirect URLs to `https://enchev-auctions.vercel.app`. Configure email templates and an appropriate sender.
3. **DONE:** Applied the append-only file `supabase/migrations/20261010143000_enchev_isolated_buyer_profiles.sql` to the dedicated project via migration tool. Listed migration version: `20261010144306`.
4. **STRUCTURAL PASS:** Supabase reported one empty `public.enchev_buyer_profiles` table, RLS enabled and FORCE enabled; `anon` SELECT=false; authenticated SELECT=true, INSERT=false, DELETE=false, id UPDATE=false, display_name UPDATE=true. Two owner-scoped SELECT/UPDATE policies verified in `pg_policies`. **Two-user runtime RLS tests still pending.**
5. Create two staging buyer users and confirm direct PostgREST requests cannot read or mutate each other's profile; try forged `id`, DELETE, INSERT, phone/locale invalid values, and attempts to change created/updated dates. Check anonymous access and `service_role` isolation separately.
6. Test sign-up confirmation mail, sign-in, cookie flags, expiry, refresh rotation, sign-out and failed credentials across phone and PC. Sign-in is not safe for production before independent rate limits and password-reset/recovery flow.
7. Audit login API reverse proxy `Origin`/Host behind Vercel production, sanitize logs, ensure no credentials are persisted, and verify request correlation IDs.
8. Configure the **dedicated** URL, project ref and anonymous key in server-side Vercel environment only, then activate in **staging**. Production activation requires a separate explicit readiness decision.
9. Watchlist, auctions, inventory, payments, seller admin and transport remain demo even when a real identity session exists. No real bids or financial flows are authorized by this schema.

## 3. Test evidence, limitations and deployment block

Supabase security and performance advisors reported no current notices. This does **not** replace real two-user permission testing. Vercel API request to list project environment variables returned HTTP **403 forbidden**. Therefore Vercel binding/secret configuration was not performed, and `ENCHEV_AUTH_ENABLED` stays OFF. The CLI fallback was unavailable in the current environment. Re-establish Vercel project environment-variable access before attempting the identity integration.

## 3a. Structural testing notes

`node scripts/verify-dedicated-buyer-identity.mjs --self-test` checks source-level RLS safeguards and rejects intentionally weakened schema. It **does not** establish a live database permission proof. A separate two-user test on the newly provisioned database is mandatory.

## 4. Follow-on implementation slices

- P0.2: provider-backed email recovery + session limits, secure credential rate limiting.
- P0.3: saved searches/watchlist persisted per actual Auth UID, with RLS.
- P0.4: seller onboarding, vehicle ownership, admin review, immutable audit events.
- P0.5: authoritative auction engine with two distinct buyers, a bid ledger and dispute/restart checks.
- P0.6: payment sandbox, settlement reconciliation, fees, compliance and receipts.
