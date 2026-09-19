# 25.02 — Integration-test strategy

## Goal

Define how Enchev Auctions verifies interactions across real application/module boundaries without depending on production state or production credentials.

## Scope

Integration tests cover web/API boundaries, database-contract boundaries, provider-adapter boundaries, and multi-module flows. They sit above pure unit tests and below full browser end-to-end tests.

## Rules

- tests are deterministic and repeatable;
- production credentials and production customer data are forbidden;
- live provider calls are forbidden by default;
- external systems use controlled stubs or explicitly approved sandbox environments;
- database-backed integration tests use ephemeral or dedicated test state;
- every critical integration boundary has both a happy-path and a failure-path scenario;
- tests clean up state they create;
- an applicable failing integration test blocks GREEN.

## Execution boundary

The default execution environment is local or CI. This strategy does not authorize production mutations, provider provisioning, Vercel deployment, or use of customer data.

## Relationship to other frozen tasks

25.01 owns unit-test strategy. 25.03 owns end-to-end strategy. 25.04 owns contract-test strategy. 25.02 only defines the integration layer between them.
