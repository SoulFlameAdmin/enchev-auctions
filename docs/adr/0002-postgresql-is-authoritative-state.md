# ADR 0002: PostgreSQL is authoritative application state

## Status

Accepted

## Context

Auction, bid, winner, and result state requires durable transactional authority. Redis/Valkey may be used for acceleration or coordination, but a cache must not become the source of truth for critical auction state.

## Decision

PostgreSQL, provided through the canonical Supabase project, is the authoritative persistent state for critical application records. Redis/Valkey is non-authoritative support infrastructure only. Database schema and transaction semantics remain owned by the relevant phase 03 and auction-engine tasks.

## Consequences

Critical state remains recoverable and transactionally consistent even when cache infrastructure is unavailable. Cache behavior must tolerate loss/rebuild and cannot independently determine authoritative auction outcomes.
