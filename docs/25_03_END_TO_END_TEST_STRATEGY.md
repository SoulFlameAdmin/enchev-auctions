# 25.03 — End-to-end test strategy

## Goal

Define how Enchev Auctions verifies complete user journeys through the running product while keeping production data, credentials, and mutations outside the test boundary.

## Scope

End-to-end tests cover critical buyer journeys, seller/admin journeys, auction participation, and release/logistics journeys. They exercise the product from user-visible entry points through authoritative backend outcomes.

## Rules

- browser journeys are executed only against local, CI, or staging environments;
- production mutations and production credentials are forbidden;
- test identities, vehicles, auctions, bids, and documents are synthetic;
- external providers use controlled stubs or explicitly approved sandbox environments;
- tests assert both user-visible state and the authoritative outcome where applicable;
- critical journeys include a happy path plus a failure or recovery path;
- state created by a test must be reset or cleaned up;
- time-sensitive auction scenarios use a controlled clock/time source where applicable;
- tests must be deterministic and repeatable;
- an applicable failing end-to-end test blocks GREEN.

## Browser boundary

A representative browser is required for browser journeys and the critical buyer journey must include a mobile viewport. The complete cross-browser matrix belongs to frozen task 25.10, not 25.03.

## Production boundary

This strategy does not authorize Vercel deployment, production test mutations, production customer data, production credentials, payment actions, or live provider calls. Full production smoke behavior belongs to 25.13 and must remain non-destructive.

## Relationship to other frozen tasks

25.01 owns unit-test strategy. 25.02 owns integration-test strategy. 25.04 owns contract-test strategy. 25.10 owns the cross-browser matrix. 25.13 owns the production smoke suite. 25.03 defines only the end-to-end testing layer and does not claim that every product journey is already implemented.
