# 21.11 — Market activation gate

## Goal

Establish a fail-closed country market activation gate. A market must not become active merely because country configuration files exist.

## Canonical gate

The public `@enchev/config` boundary exports the gate from:

`packages/config/src/market-activation-gate.ts`

The gate is:

`evaluateMarketActivationGate(approvalInput, countryProfile, kycProfile, legalProfile, documentProfile)`

Activation requires all of the following at the same time:

- the requested `countryCode` is valid and matches `CountryProfile.countryCode`;
- the 21.08 country KYC profile passes its real runtime validator;
- the 21.09 country legal profile passes its real runtime validator;
- the 21.10 country document profile passes its real runtime validator;
- `kycApproved === true`;
- `legalApproved === true`;
- `documentsApproved === true`.

Any malformed profile, country mismatch, false/missing approval, or unexpected approval field produces `active=false` with explicit blockers.

## Fail-closed law

**Profile existence is not market activation.**

The gate does not infer approval from configuration presence, build success, deployment state, country name, provider state, or environment variables. The active result can only be produced after the dependency profiles validate and the three explicit approvals are true.

## External sign-off boundary

21.11 defines the activation mechanism, not a concrete market launch. This task deliberately creates **no active country record** and does not fabricate legal/compliance/customer-data approval.

A real country may remain inactive because legal sign-off, compliance approval, provider credentials, customer data, or other external prerequisites are missing. Such a blocker must remain visible and must not be bypassed.

## Scope boundaries

21.11 does not own:

- country-specific KYC policy content from **21.08**;
- country-specific legal policy or legal advice from **21.09**;
- country-specific document policy from **21.10**;
- Country #2 rollout owned by **21.12 Country #2 without core rewrite**;
- deployment orchestration, Vercel leases, provider credentials, or secrets;
- pricing, payment, finance, tax, currency, or accounting logic.

## Acceptance

21.11 is GREEN only when the fail-closed gate, dependency-profile validation, explicit approval requirements, country-binding checks, negative self-tests, no-country-hardcoding regression, aggregate CI, typecheck, production build, health smoke, and browser regression all pass with evidence.

GREEN for 21.11 proves the activation gate exists and fails closed. It does **not** claim that any real market is activated.
