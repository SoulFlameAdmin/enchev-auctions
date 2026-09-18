# @enchev/domain

Framework-independent domain package for Enchev Auctions.

Task 02.05 establishes the package boundary and a compilable public entrypoint only. It does **not** invent auction entities, database models, persistence rules, or transport contracts before their dedicated frozen tasks.

## Rules

- No Next.js or React dependency.
- No Supabase/provider dependency.
- No imports from `app/` or `apps/`.
- No HTTP, realtime, worker, browser, provider, or persistence ownership.
- Domain entities/value objects/invariants are added only by the relevant implementation tasks.

## Verification

`npm --workspace @enchev/domain run verify`
