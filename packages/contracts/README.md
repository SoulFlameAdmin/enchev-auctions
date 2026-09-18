# @enchev/contracts

Transport-neutral shared contract package for Enchev Auctions.

Task 02.06 establishes a compilable package boundary for request/response DTOs, event contracts, and validation-schema interfaces. Concrete business/API/realtime/provider contracts are added only by their dedicated frozen implementation tasks.

## Rules

- No Next.js or React dependency.
- No Supabase/provider client dependency.
- No imports from application runtime layers under `app/` or `apps/`.
- No domain authority or persistence ownership.
- No HTTP, realtime, worker, browser, or provider runtime implementation.

## Verification

`npm --workspace @enchev/contracts run verify`
