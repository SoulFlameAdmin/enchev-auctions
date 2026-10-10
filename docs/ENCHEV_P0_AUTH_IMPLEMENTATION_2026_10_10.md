# ENCHEV P0 — Buyer Identity foundation (2026-10-10)

## Scope completed in this branch
- New mobile-friendly buyer login and registration screens: `/login` and `/register`.
- Server-only Supabase Auth proxy: `/api/enchev-auth/sign-up`, `sign-in`, `sign-out`, `session`.
- Signed-in proof from the identity provider's `/auth/v1/user` endpoint. On expiry, the backend rotates the refresh token and validates the renewed access token.
- Auth credentials stay server-side; session tokens stay in `HttpOnly`, `SameSite=Lax`, production `Secure` cookies. Session responses expose only verified `{id,email}` (not JWTs or secrets).
- POSTs require same-origin `Origin`, limited JSON payload, and a password of 12–128 characters.
- Buyer profile **explicitly labels** existing saved lots and auction cards as demo data even when authenticated. No false claims that they are synced/owned.
- App login/register navigation points to the new UI instead of a query string that did not perform registration.

## Safety gate — OFF by default
`ENCHEV_AUTH_ENABLED` is disabled unless exactly `true`. No credentials or database schema were modified during development. We must **not** attach customer identity to shared SoulFlame/Twins governance project `frhletkiuupgksmgxoxc`. The server rejects this specific ref even when misconfigured.

Required **server-side only** environment variables (never `NEXT_PUBLIC_*`):

```env
ENCHEV_AUTH_ENABLED=false
ENCHEV_AUTH_URL=https://<DEDICATED_ENCHEV_REF>.supabase.co
ENCHEV_AUTH_ANON_KEY=<DEDICATED_PROJECT_ANON_PUBLIC_API_KEY>
ENCHEV_AUTH_PROJECT_REF=<DEDICATED_ENCHEV_REF>
ENCHEV_AUTH_SITE_ORIGIN=https://enchev-auctions.vercel.app
```

Although the Supabase anon key is public in principle, we pass it **only from the server** in this gateway; never supply the service-role key here. All secrets/configs must be set in Vercel secure environment settings, not committed.

## Required activation checklist
1. Create a **separate ENCHEV Supabase project** (billing and access must be approved before provisioning). Do not use `soulflame-twins` or `veska-logoped`.
2. Set the dedicated project Auth Site URL + allowlisted redirect URL `https://enchev-auctions.vercel.app/login?verified=1`. Enable email confirmation and customize domain/SMTP as needed.
3. Put dedicated project URL and *anon* key into Vercel server environment only; leave `ENCHEV_AUTH_ENABLED=false` until configured and validated in staging.
4. Confirm two independently created users, verification emails, bad-credential rejection, refresh rotation, logout/revocation and HTTPS cookie flags in staging. Check Supabase Auth rate limits; add a per-IP/per-account rate limit before wide public signup.
5. Complete password reset and recovery endpoints before going live. No passwords are stored in ENCHEV Postgres tables.
6. Create **isolated ENCHEV business tables and policies** for the buyer/seller model; perform RLS owner-vs-other tests with two distinct users. Do not apply the old shared-project migration automatically.
7. Keep actual bids, win/loss, saved searches and payment flows in **DEMO** mode until an independent authoritative and audited auction backend proves PASS.

## Known limitations (not certified)
- No separate identity project is currently connected. The auth screen truthfully reports activation pending.
- Registration is not open and no real customer account has been created or tested; email delivery and password reset are not yet proven.
- No real user-owned auction data, seller admin, payment processor, stock feed or third-party VIN/transport service.
- This is a **first implementation slice**, not proof of complete production registration. Deployment READY alone never certifies identity or authorization security.
