# ENCHEV — P0 Stage 2: dedicated identity project and buyer RLS

**Status:** Schema and automation prepared only. **No Supabase project has been created, modified or charged.** The currently connected `soulflame-twins` database must remain limited to governance. The `veska-logoped` project is unrelated.

## 1. Before provisioning (requires user approval)

Supabase organization currently visible: `SoulFlameAdmin`. Ask the owner to choose the organization explicitly, and obtain the connector's cost confirmation if provisioning may incur charges. Proposed project:
- Name: `enchev-auctions` (distinct database, Auth tenants and billing).
- EU region: `eu-central-1` or `eu-west-1`, to be confirmed.
- Project credentials are never written to GitHub, comments, chat, docs, or browser JavaScript.

## 2. Deployment boundary

The existing production website stays in **preview mode**. The feature flag `ENCHEV_AUTH_ENABLED` remains false until each gate below passes.

1. Provision the dedicated project. Confirm project reference is neither `frhletkiuupgksmgxoxc` nor `rigfvyzsfojtbkhjgvxl`.
2. Enable email verification; add allowlisted redirect URLs to `https://enchev-auctions.vercel.app`. Configure email templates and an appropriate sender.
3. Review the append-only file `supabase/migrations/20261010143000_enchev_isolated_buyer_profiles.sql`; run only in the dedicated project, once, by a controlled migration job.
4. Inspect table and policies in Supabase; `anon` must not read/write; `authenticated` can read own profile and only update `display_name`, `phone_e164` and `locale`.
5. Create two staging buyer users and confirm direct PostgREST requests cannot read or mutate each other's profile; try forged `id`, DELETE, INSERT, phone/locale invalid values, and attempts to change created/updated dates. Check anonymous access and `service_role` isolation separately.
6. Test sign-up confirmation mail, sign-in, cookie flags, expiry, refresh rotation, sign-out and failed credentials across phone and PC. Sign-in is not safe for production before independent rate limits and password-reset/recovery flow.
7. Audit login API reverse proxy `Origin`/Host behind Vercel production, sanitize logs, ensure no credentials are persisted, and verify request correlation IDs.
8. Configure the **dedicated** URL, project ref and anonymous key in server-side Vercel environment only, then activate in **staging**. Production activation requires a separate explicit readiness decision.
9. Watchlist, auctions, inventory, payments, seller admin and transport remain demo even when a real identity session exists. No real bids or financial flows are authorized by this schema.

## 3. Test evidence and limits

`node scripts/verify-dedicated-buyer-identity.mjs --self-test` checks source-level RLS safeguards and rejects intentionally weakened schema. It **does not** establish a live database permission proof. A separate two-user test on the newly provisioned database is mandatory.

## 4. Follow-on implementation slices

- P0.2: provider-backed email recovery + session limits, secure credential rate limiting.
- P0.3: saved searches/watchlist persisted per actual Auth UID, with RLS.
- P0.4: seller onboarding, vehicle ownership, admin review, immutable audit events.
- P0.5: authoritative auction engine with two distinct buyers, a bid ledger and dispute/restart checks.
- P0.6: payment sandbox, settlement reconciliation, fees, compliance and receipts.
