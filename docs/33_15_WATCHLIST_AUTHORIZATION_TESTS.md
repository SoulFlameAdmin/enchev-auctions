# SYSTEM 33.15 — Watchlist authorization tests

Status: YELLOW until implementation PR, exact-head CI/security/provenance, READY Vercel preview, implementation merge and descendant GREEN evidence are proven.

## Frozen identity
- 33.15 — Watchlist authorization tests (kind: security)

## Security boundary
The buyer watchlist remains PostgreSQL-authoritative. The repository migration enables RLS on `public.enchev_watchlist` and ownership is derived from `auth.uid()`; client-provided ownership is not sufficient authorization.

The connected Supabase project is development-governance only and `auction_authority=false`, so this task must not apply the auction watchlist migration there.

## Required guarantees
- SELECT exposes only rows where `auth.uid() = user_id`.
- INSERT accepts only rows where `auth.uid() = user_id`.
- DELETE can affect only rows where `auth.uid() = user_id`.
- a user cannot read, add as, or remove another user's watchlist row;
- the same vehicle may independently exist in different users' watchlists;
- `watchingAuctionsForUser` derives auctions only from the requested user's owned rows;
- blank user/vehicle identifiers fail closed;
- no privileged bypass or SECURITY DEFINER authorization shortcut is introduced.

## Acceptance evidence
The verifier checks the immutable 33.15 security identity, migration RLS/policy text, absence of broad/public authorization bypasses, and executable domain isolation cases for cross-user read/delete and same-vehicle independence. Full GREEN requires exact-head CI/security/provenance and descendant evidence.
