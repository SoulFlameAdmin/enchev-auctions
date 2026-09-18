# @enchev/config

Shared configuration boundary for Enchev Auctions.

Task 02.07 establishes a typed, secret-free configuration package. Existing root configuration files remain canonical and are not duplicated:

- `config/enchev-environment-variables.json`
- `config/enchev-health-endpoints.json`
- `config/enchev-redis-environment.json`
- `config/enchev-supabase-project.json`

## Rules

- No secret values.
- No direct `process.env` reads.
- No Next.js, React, Supabase, provider-client, app-runtime, or domain authority.
- Typed config contracts, non-secret defaults, and configuration key names belong here.
- Runtime validation stays with the dedicated environment/config verifiers until a later frozen task explicitly moves it.

## Verification

`npm --workspace @enchev/config run verify`
