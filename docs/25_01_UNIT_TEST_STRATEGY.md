# 25.01 — Unit-test strategy

## Goal
Define the repository-wide unit-test contract for deterministic, isolated verification of pure logic and validation boundaries before integration or end-to-end testing.

## Scope
Unit tests cover pure domain logic, contract validation, configuration validation, and failure boundaries. They must not require live providers or production data.

## Rules
- deterministic and repeatable;
- isolated from network and production services by default;
- fast enough to run inside the aggregate CI test suite;
- every critical validation path includes negative cases;
- a failing applicable unit test blocks GREEN;
- a flaky or intermittently passing test is not accepted as evidence;
- dedicated verifiers use `--self-test` when that pattern applies.

## Current execution
The canonical aggregate unit/self-test runner is `scripts/run-ci-tests.mjs`, invoked through `npm test` and the GitHub Actions verification workflow.

## Boundaries
This task does not replace integration, end-to-end, contract, browser, load, or provider-live tests owned by later 25.xx tasks and other frozen phases.
