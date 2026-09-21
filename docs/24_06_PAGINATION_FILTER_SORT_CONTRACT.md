# SYSTEM 24.06 — Pagination/filter/sort contract

Status: GREEN — exact-head CI passed and implementation merged via PR #168.

The canonical HTTP list-query contract is implemented in `packages/contracts/src/http-schema.ts` through `parseApiListQuery`.

- Pagination is one-based: `page` defaults to 1; `pageSize` defaults to 20 and is capped at 100.
- Filters use repeatable `filter=field:value`. Endpoints may provide an explicit field allowlist. Duplicate filter fields are rejected.
- Sorting uses repeatable `sort=field:asc|desc`; query order defines precedence. Endpoints may provide an explicit sort allowlist. Duplicate sort fields are rejected.
- Unknown query parameters, malformed values, duplicate scalar pagination parameters, and non-allowlisted fields fail closed.
- This is a transport/query contract only. It does not create auction authority.

Evidence: exact implementation head `9105353b71d4f03ebc7e2e184cb46c2b9fb2492c` passed Verify Enchev Web run `35552920184`, Code Scan `35552920113`, SBOM `35552920247`, Secret Scan `35552920069`, Build Provenance `35552920251`, SYSTEM 24.02 `35552920143`, and SYSTEM 26.05 `35552920225`; merged to main as `de7e56be7a162d2a6b6dc8e06d01cd3759c8253e`. Vercel remained externally build-rate-limited and no manual deployment was attempted.
