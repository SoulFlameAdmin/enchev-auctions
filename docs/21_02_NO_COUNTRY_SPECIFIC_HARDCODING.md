# 21.02 No country-specific hardcoding

Task 21.02 establishes a guard that keeps authoritative/core runtime behavior country-neutral.

## Scope

The invariant applies to core and authoritative runtime surfaces:

- `packages/domain/src`
- `packages/contracts/src`
- `packages/config/src`
- `packages/providers/src`
- `apps/api`
- `apps/realtime`
- `apps/worker`
- `app/api`
- `supabase/functions`
- `supabase/migrations`

Presentation copy, demo vehicle fixtures, and locale resources are intentionally outside this task. Locale extraction and concrete BG/EN locale work are owned by later frozen tasks 21.05-21.07.

## Invariant

Core runtime code must not encode country-specific business behavior through concrete literals. In particular it must not:

- assign a concrete two-letter `countryCode` literal in core runtime source;
- assign concrete `defaultLocale`, `supportedLocales`, or `timeZone` literals in core runtime source;
- branch authoritative behavior by directly comparing country/locale/time-zone variables with a literal;
- embed launch-country markers such as `Bulgaria`, `България`, `Europe/Sofia`, `bg-BG`, or `+359` in the guarded runtime surfaces.

Country-specific values must arrive through typed configuration/profile inputs rather than being compiled into authoritative logic.

## Verification

Run:

`node scripts/verify-no-country-hardcoding.mjs`

and:

`node scripts/verify-no-country-hardcoding.mjs --self-test`

The self-test proves that representative country-code, locale, timezone, phone-prefix, and literal-branch hardcoding are rejected.
