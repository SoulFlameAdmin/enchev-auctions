# SYSTEM 33.01–33.05 — Buyer workspace foundation

This block implements the first five frozen Phase 33 tasks in order:

- **33.01 Persistent watchlist / favorites**
- **33.02 Recently viewed vehicles**
- **33.03 Saved searches**
- **33.04 Saved-search result alerts**
- **33.05 My Auctions: Watching**

## Persistence

The repository now contains an append-only PostgreSQL migration for the four durable buyer-workspace record families. Every table is owner-scoped by `user_id`, RLS is enabled, and policies prevent cross-user reads/writes.

The currently connected Enchev Supabase binding is intentionally **not** used as the auction application datastore: its checked-in binding declares `scope=development-governance` and `auction_authority=false`. Applying buyer business tables there would violate the existing authority boundary. The migration is therefore ready for the future authoritative auction database/migration runner rather than being silently applied to the governance store.

## Domain behavior

`packages/domain/src/buyer-workspace.ts` provides framework-independent behavior for:

- idempotent favorite/watchlist add/remove;
- user-scoped recently viewed upsert with a bounded 100-item history;
- deterministic saved-search query fingerprints with exact-query deduplication semantics;
- alert cooldown validation and delivery eligibility;
- deterministic derivation of `My Auctions: Watching` from the authenticated user's watchlist only.

## Security and invariants

The verifier fails closed unless:

- frozen IDs/names exactly match the master plan;
- all four persistence tables and RLS owner policies are present;
- alert creation/update proves ownership of the referenced saved search;
- watchlist uniqueness is `(user_id, vehicle_id)`;
- saved searches deduplicate exact normalized query JSON per user;
- domain functions reject blank IDs, overlong names, invalid recent limits and alert cooldowns below 60 seconds;
- watching-auction derivation never includes another user's records;
- the checked-in Supabase binding still declares `auction_authority=false`.

No protected DAVID orchestrator file is modified.
