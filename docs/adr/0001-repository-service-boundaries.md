# ADR 0001: Repository service and package boundaries

## Status

Accepted

## Context

MASTER SYSTEM PLAN phase 02 separates the application into web, API, realtime, worker, domain, contracts, config, and providers boundaries. Several runtimes are intentionally only structural shells until their dedicated implementation tasks.

## Decision

Use npm workspaces under `apps/*` and `packages/*` as explicit ownership boundaries. The current root Next.js application remains the single source for the web/API runtime until a later frozen task explicitly changes that architecture. Realtime and worker workspaces must not claim runtime readiness before their implementation tasks.

## Consequences

Ownership is reviewable and CI-verifiable without duplicating runtime sources. Later implementation tasks can fill the established boundaries without silently moving business authority between layers.
