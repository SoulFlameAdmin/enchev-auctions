# SYSTEM 27.01 — Critical user-journey SLIs

Status: **YELLOW** until exact-head CI and post-merge verification pass.

## Purpose

Define stable service-level indicators for the critical ENCHEV user journeys without inventing SLO targets. Target values are owned by SYSTEM 27.07.

## Critical journeys

The contract measures inventory discovery, lot detail, LIVE auction viewing, bid submission, and auction-result visibility. Each journey has an explicit success condition, failure condition, and a fail-closed successful-journey ratio.

Unknown or ambiguous outcomes count as failures. User-cancelled journeys are excluded from the denominator; synthetic traffic remains measurable rather than silently removed.

## Authority boundary

Telemetry is observational only. PostgreSQL remains authoritative for accepted bids, auction state, winner selection, and final results. SLI collection must never mutate auction state or infer authoritative outcomes from monitoring data.

## Privacy

Required measurement dimensions are environment, journey ID, and outcome. PII and raw credential data are forbidden. Country/browser/device dimensions are optional and must remain non-identifying.

## Acceptance

GREEN requires the executable verifier and negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge verification. SYSTEM 27.07 remains responsible for choosing actual SLO targets.
