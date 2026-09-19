# ADR 0003: Provider boundaries are credential-free

## Status

Accepted

## Context

External services such as Supabase, Redis/Valkey, storage, messaging, and deployment providers require integration code, while credentials and environment secrets have different security and lifecycle ownership.

## Decision

The `@enchev/providers` package owns provider adapter and client-interface boundaries but does not own credentials, secret storage, direct runtime environment reads, domain authority, or concrete provider readiness by itself. Concrete integrations are introduced only by their dedicated frozen tasks.

## Consequences

Provider integrations remain replaceable and testable without embedding secrets in shared package source. Configuration and secret injection stay outside the provider package boundary.
