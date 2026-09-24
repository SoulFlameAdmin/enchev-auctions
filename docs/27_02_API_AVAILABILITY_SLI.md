# SYSTEM 27.02 — API availability SLI

Status: **YELLOW** until exact-head CI and post-merge verification pass.

## Purpose

Define one stable API-availability indicator over the canonical SYSTEM 24.09 endpoint inventory without inventing an SLO target. Actual SLO percentages remain owned by SYSTEM 27.07.

## Indicator

The API availability ratio is:

- numerator: eligible API requests that receive a contract-classified response without server-side unavailability;
- denominator: all eligible API requests after ingress validation.

Unknown outcomes fail closed as bad availability events.

## Classification

A contract-valid business rejection does not mean that the API was unavailable. Contract-classified 4xx outcomes therefore count as available. A valid SYSTEM 24.08 429 also counts as available transport behavior, while its frequency remains a capacity/backpressure concern.

5xx responses, network failures after admission, server-side timeouts, response timeouts, malformed/unclassifiable responses and unknown outcomes count as bad availability events.

Malformed requests rejected before ingress eligibility and client cancellations before a response are excluded from the denominator. Synthetic traffic remains measurable and is not silently removed.

## Scope and authority

The endpoint scope is derived from `config/enchev-api-endpoint-inventory.json`; 27.02 must not maintain a second endpoint registry.

Telemetry is observational only. PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## Privacy

Required dimensions are environment, operation ID, method and outcome. PII, raw credential data and request-body capture are forbidden.

## Acceptance

GREEN requires the executable verifier and fail-closed negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge descendant verification. No SLO target percentage is introduced here.
