# SYSTEM 24.06 — Pagination/filter/sort contract

Status: YELLOW pending CI evidence.

The canonical HTTP list-query contract is implemented in `packages/contracts/src/http-schema.ts` through `parseApiListQuery`.

- Pagination is one-based: `page` defaults to 1; `pageSize` defaults to 20 and is capped at 100.
- Filters use repeatable `filter=field:value`. Endpoints may provide an explicit field allowlist. Duplicate filter fields are rejected.
- Sorting uses repeatable `sort=field:asc|desc`; query order defines precedence. Endpoints may provide an explicit sort allowlist. Duplicate sort fields are rejected.
- Unknown query parameters, malformed values, duplicate scalar pagination parameters, and non-allowlisted fields fail closed.
- This is a transport/query contract only. It does not create auction authority.

GREEN requires passing repository verification plus CI evidence on the exact implementation head.
