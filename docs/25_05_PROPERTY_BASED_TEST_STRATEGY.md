# 25.05 — Property-based test strategy

## Goal

Define how Enchev Auctions uses generated inputs to validate stable invariants across broad input spaces while keeping failures deterministic and reproducible.

## Scope

Property-based testing covers domain invariants, serialization round-trips, numeric/range boundaries, and state-transition properties where a stable invariant can be expressed.

## Rules

- tests run only in local or CI environments;
- production calls and production credentials are forbidden;
- every run exposes a deterministic seed;
- a failing counterexample must be reproducible from recorded evidence;
- generated case counts are bounded;
- shrinking is required when the chosen tool supports it;
- generated values must deliberately include valid boundaries and invalid/edge cases where applicable;
- a failing applicable property test blocks GREEN.

## Evidence requirements

When a property fails, CI output must preserve the seed and counterexample. Where supported, the minimized/shrunk counterexample should be reported. Randomized behavior without replayable seed evidence is not acceptable.

## Relationship to other frozen tasks

25.01 owns the unit-test strategy, 25.02 integration-test strategy, 25.04 contract-test strategy, and 25.06 deterministic fixtures. 25.05 defines the property-testing layer only and does not claim that domain-specific generators or fixture factories are already implemented.
