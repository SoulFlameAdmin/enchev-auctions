# SYSTEM 24.14 — Web/API/provider contract tests

Status: **GREEN** — contract verifier, fail-closed negative tests, CI integration, exact-head verification and post-merge descendant verification are complete.

This task verifies the current implemented contract boundaries without inventing provider credentials or live provider integrations.

## Verified surfaces

- implemented `app/api/**/route.ts` HTTP methods match the canonical endpoint inventory;
- inventory operations exist in OpenAPI with matching operation IDs and response contracts;
- `apps/api` remains a single-source bridge to `app/api`;
- the live-auction browser consumer keeps the documented GET/POST request shape and rejects authoritative auction payloads;
- `packages/providers` remains a credential-free adapter boundary until dedicated provider tasks implement real clients.

## Fail-closed tests

The self-test rejects route removal, OpenAPI removal, operation ID drift, API bridge drift, browser POST drift, unverified concrete provider clients, and accidental provider network/credential behavior.

## Commands

```bash
npm run verify:web-api-provider-contract-tests
npm run verify:web-api-provider-contract-tests:self-test
npm test
```

PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results.

## GREEN evidence

- Implementation exact-head commit before merge: `0f08c4698e4af5d53bb85e6601a255b1ac5aa1fd`.
- Implementation merged to `main` as `d89ea3f131a91d55601d0c1d1d545e087a679aad` from PR #234.
- Exact-head Verify Enchev Web run `36004583232`: SUCCESS after one bounded retry of an Edge startup timing flake; CI test suite, TypeScript, production build and built health smoke all PASS.
- Exact-head security/supply-chain checks PASS: Secret Scan `36004583424`, Code Scan `36004583677`, SBOM Generation `36004583348`, Build Provenance `36004583310`, SYSTEM 26.05 `36004583299`, SYSTEM 24.02 `36004583451`.
- Exact-head Vercel Preview `dpl_3zfQHd47ez59j4fc8SnNxEXasa74` for commit `0f08c4698e4af5d53bb85e6601a255b1ac5aa1fd`: READY; root HTTP check returned 200.
- The first visual-regression attempt failed only because Microsoft Edge exposed DevTools after the 30s startup timeout; retry passed without code changes, proving a runner timing flake rather than a 24.14 contract regression.
- This GREEN evidence commit is based directly on merged `main` commit `d89ea3f131a91d55601d0c1d1d545e087a679aad`; its exact-head CI is the post-merge descendant verification required by the SYSTEM acceptance rule.
- Protected DAVID orchestrator files were not modified.
