# ENCHEV P0.2 — Password recovery implementation

Date: 2026-10-20
Status: CODE READY FOR REVIEW / NOT ACTIVATED OR PRODUCTION ACCEPTED

## Scope
- Email-only reset request: `POST /api/enchev-auth/request-reset`.
- A fixed server-controlled HTTPS redirect to `/reset-password`.
- Recovery-link fragment is immediately removed from URL by the browser before
  posting its one-time bearer token to the same-origin server route.
- Provider validates access token; only a ten-minute HTTP-only, SameSite=Strict
  recovery cookie is set. **No buyer authentication cookies are issued**.
- Password update: `POST /api/enchev-auth/set-new-password` calls the provider
  under the recovery credential, signs that session out, clears cookies and
  requires a fresh login.
- Generic email response avoids account enumeration.
- New `/reset-password` page matches existing ENCHEV design and login links.
- No production flag, database migration, env variable, secret or real user changed.

## Still BLOCKED and NOT production approved
1. `ENCHEV_AUTH_ENABLED` must remain OFF in production until
   dedicated-project env binding / Vercel access is restored and confirmed.
2. Vercel environment-variable listing still returns **403 forbidden** as of
   2026-10-20. Do not guess env values or activate by trial.
3. Configure Supabase Auth's exact HTTPS Site URL and redirect allowlist to
   include `/reset-password` on the selected staging origin, and verify the
   default recovery-email link sends implicit `#access_token=...&type=recovery`
   fragments (this implementation does not handle PKCE `?code=` links).
4. Complete real email-provider/SMTP delivery, expiration, replay and
   cross-account browser tests on a **non-production environment** with two
   separate test identities; source tests alone are insufficient.
5. Add and test per-IP/account recovery rate limits before public signup.
   Provider-level quotas and 429 propagation alone are not a substitute.
6. Enable/review leaked-password protection and current email settings.
7. Security review: browser recovery tokens are short-lived bearer credentials.
   A token from an ordinary session could be submitted to the recovery
   verification endpoint; provider user verification proves ownership of that
   token, **not recovery-event provenance**. Introduce and test a provider-
   attested recovery-only exchange before production acceptance.
8. Test the reset request's non-enumeration behavior and potential abuse
   of recovery mails; test 5xx / bad origin / oversized input / invalid token.
9. Verify 320px, 390px, desktop layouts, accessible status announcements,
   email links on Android and iOS, and HTTPS-only cookies.

## Static check
`node scripts/verify-enchev-recovery-contract.mjs`
This is a code contract check; pass does not mean production ready.
