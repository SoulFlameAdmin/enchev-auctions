# SYSTEM 24.10 - Deprecation/backward-compatibility policy

Task: **24.10 Deprecation/backward-compatibility policy**

Status: **YELLOW** - implementation is present on the task branch; GREEN requires applicable PASS CI, merge, post-merge verification, and concrete evidence.

## Contract

The published v1 HTTP API compatibility line is governed by `config/enchev-api-compatibility-policy.json`.

Within v1, published operations cannot be removed or silently renamed, previously documented response status codes cannot disappear, and an optional request body cannot become required. Breaking changes require a new compatibility line.

Deprecation requires `deprecated: true` plus `x-enchev-deprecation` metadata containing `announcedOn`, `sunsetNotBefore`, `replacementOperationId`, and `reason`. The minimum notice period is 90 days.

Every endpoint in the canonical SYSTEM 24.09 inventory must remain covered by the compatibility contract. The contract is descriptive only; PostgreSQL remains authoritative for auction state, accepted bids, winner selection, and final results.

## Acceptance still required

GREEN requires an executable verifier with negative self-tests, aggregate pre-gate wiring, package scripts, exact-head CI PASS, merge, post-merge verification, and concrete evidence.
