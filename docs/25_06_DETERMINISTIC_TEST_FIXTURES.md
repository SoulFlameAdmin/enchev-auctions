# 25.06 — Deterministic test fixtures

## Goal

Define a deterministic fixture layer for Enchev Auctions so repeated tests can reproduce the same identities, timestamps, domain values, and synthetic records.

## Rules

- fixtures contain synthetic data only;
- production data and production credentials are forbidden;
- fixture generation must not read the wall clock;
- unseeded randomness is forbidden;
- stable identifiers and explicit timestamps are required;
- shared mutable fixtures must be reset between tests;
- the same fixture inputs must produce the same serialized values;
- fixtures should stay minimal and purpose-built rather than becoming hidden production replicas.

## Initial canonical fixture set

The repository contains a small versioned canonical fixture file with a synthetic buyer, vehicle, and auction. These values exist to prove deterministic fixture conventions, not to claim every future domain fixture is already implemented.

## Ownership boundary

25.05 owns property-based testing strategy. 25.07 owns controlled clock/time-test utilities. 25.06 defines deterministic fixture conventions and canonical synthetic seed examples only.
