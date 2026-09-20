# 25.14 — Failure-injection test harness

## Goal

Provide a deterministic local harness for exercising failure behavior without creating real provider outages or mutating production.

## Scenarios

The harness covers six required cases:

- provider timeout with bounded retry handling;
- provider HTTP 503 with fail-closed retry-budget exhaustion;
- duplicate delivery with idempotent ignore;
- sequence gap requiring authoritative resync;
- malformed event rejection;
- controlled-clock expiry where authoritative time wins and browser time is ignored.

## Safety boundary

This task does not perform chaos against production, does not disable providers, does not mutate customer data, and does not claim that a real outage occurred. It is a deterministic simulation harness intended for CI and regression use.

## Acceptance

25.14 is GREEN only when the machine-readable contract, runtime harness, scenario matrix, negative self-tests and aggregate CI all pass on the exact implementation commit.
