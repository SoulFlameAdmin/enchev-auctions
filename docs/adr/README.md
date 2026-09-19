# Architecture Decision Records

This directory is the canonical Architecture Decision Record (ADR) history for Enchev Auctions.

## Rules

- ADR filenames use `NNNN-kebab-case.md`.
- Existing accepted ADRs are append-only historical records. Do not silently rewrite a past decision; supersede it with a new ADR.
- Every ADR contains: Status, Context, Decision, Consequences.
- Allowed statuses are: Proposed, Accepted, Deprecated, Superseded.
- Runtime implementation remains owned by the relevant MASTER SYSTEM PLAN task. ADRs document decisions; they do not mark implementation work complete.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](./0001-repository-service-boundaries.md) | Accepted | Repository service and package boundaries |
| [0002](./0002-postgresql-is-authoritative-state.md) | Accepted | PostgreSQL is authoritative application state |
| [0003](./0003-provider-boundaries-are-credential-free.md) | Accepted | Provider package boundary does not own credentials |

Use [0000-template.md](./0000-template.md) for new records.
