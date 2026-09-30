# SYSTEM 41.03 — Object-level authorization abuse test

This certification exercises concrete Enchev object-ownership boundaries against ID-swapping / cross-account abuse.

## Covered object boundaries

- **Watchlist rows** — PostgreSQL RLS must derive ownership from `auth.uid()`; a client-supplied `user_id` cannot grant access.
- **Buyer auction projections** — bidding, leading and multi-auction workspace projections must return only the requested user's rows.
- **Seller listing drafts** — a seller cannot autosave another seller's listing by swapping the listing/object identifier.
- **Seller reserve state** — reserve mutations must reject a different seller identity.
- **Verified seller replies** — verification belonging to one seller cannot be reused to publish a reply as another seller.
- **Seller live-auction presence** — an existing presence object cannot be rebound to another seller or auction.

The certification is intentionally fail-closed: it tests concrete object-scope controls that exist in the repository and does not claim that UI hiding is authorization or that the governance Supabase project is auction authority.

## Abuse cases

The verifier proves cross-user reads/projections do not leak foreign objects, cross-seller writes fail, RLS does not contain broad `using (true)` / `with check (true)` policies, anonymous/public policy access is absent, and `SECURITY DEFINER` is not used as an ownership bypass.

Run `node scripts/verify-object-level-authorization-abuse-41-03.mjs --self-test`.
