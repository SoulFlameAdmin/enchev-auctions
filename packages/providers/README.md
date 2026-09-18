# @enchev/providers

External-service provider adapter boundary for Enchev Auctions.

Task 02.08 establishes a compilable workspace for provider interfaces and adapters without adding concrete SDK clients, credentials, runtime environment reads, or business authority.

## Rules

- No credentials or secrets in source.
- No direct runtime environment access.
- No domain, auction, configuration, or database authority.
- No browser UI or business-workflow ownership.
- Concrete Supabase, Redis, storage, messaging, or other provider integrations are added only by their dedicated frozen tasks.

## Verification

`npm --workspace @enchev/providers run verify`
