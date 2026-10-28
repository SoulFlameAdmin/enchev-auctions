# E&A Early Access — production activation

**Target project only:** Enchev Auctions, Supabase project ref `ejfrnjhlggebzmpmxajl`, URL `https://ejfrnjhlggebzmpmxajl.supabase.co`.

The connected Supabase account used during this implementation did **not** have permission to access the target project. Do not substitute a DAVID or unrelated database. The public endpoint will fail closed until the correct Enchev configuration is active.

## Database (owner/Borko)
Apply the committed migration `supabase/migrations/20261028223500_ea_early_access_signups.sql` **only** in the Enchev Supabase SQL editor, after checking whether an equivalent existing marketing table is already in use. The migration creates `public.ea_early_access_signups` with a unique, normalized email, consent timestamp, creation timestamp, RLS, and no public role access. Test one authorized insert and verify the count with SQL:

```sql
select count(*) from public.ea_early_access_signups;
select email, created_at from public.ea_early_access_signups order by created_at desc limit 5;
```

Do **not** invent/import test registrations into the production list.

## Vercel (owner/Borko)
Set these encrypted **Production** environment variables on Vercel project `enchev-auctions`:

- `ENCHEV_EARLY_ACCESS_SUPABASE_URL=https://ejfrnjhlggebzmpmxajl.supabase.co`
- `ENCHEV_EARLY_ACCESS_SERVICE_ROLE_KEY` = server-side service role credential for that exact Enchev Supabase project; never commit it or make it `NEXT_PUBLIC_`.
- `ENCHEV_EARLY_ACCESS_ADMIN_SECRET` = a different random, private string at least 32 characters long; keep it between the authorized administrators only.

Redeploy **Production** after changing environment variables.

## Behavior & verification
- `GET /api/ea-early-access`: public aggregate **count only**, from DB; `—` if unavailable.
- `POST /api/ea-early-access`: accepts explicit consent and valid email; normalizes to lowercase; unique on email; reports success only after Supabase confirms it saved.
- `/early-access-admin`: new menu item immediately below System progress; must enter the administrator secret; session is signed, HttpOnly, SameSite=Strict, 8-hour expiry.
- `GET /api/ea-early-access/admin`: protected list of 50 rows per page; no data without a valid signed admin session. Verify `401` from an unauthenticated browser.
- Mobile & desktop video: top count + bottom-left registration button; at video end the same form opens automatically after any active CarAR overlay is closed.
- Do not disclose personal email list to the public or export it without a confirmed lawful purpose.

## Post-activation smoke test
1. Check `GET /api/ea-early-access` returns `ok: true` and an integer count.
2. Register one consenting test mailbox that belongs to the tester. Confirm `accepted: true` and a single DB row.
3. Re-submit that same address. Confirm count does not increase.
4. Visit `/early-access-admin`, sign in as admin, confirm that exact mailbox and date are visible.
5. Open `/api/ea-early-access/admin` in incognito without admin session: must return 401.
6. Confirm mobile and desktop video preserve original CarAR visuals and the top count matches the admin total.

No frontend writes directly to Supabase; all writes and reads are server-only.
