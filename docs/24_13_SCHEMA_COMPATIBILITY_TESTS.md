# SYSTEM 24.13 - Schema compatibility tests

Status: **GREEN** — schema compatibility invariant and negative regression suite are merged and verified on `main`.

Purpose: protect the published v1 HTTP schema from breaking changes.

Canonical artifacts:
- config/enchev-schema-compatibility-baseline.json
- packages/contracts/openapi/enchev-api.v1.json
- scripts/verify-schema-compatibility-tests.mjs
- scripts/run-system-test-pre-gates.mjs

The verifier rejects removal of required fields or protected properties, type drift, enum narrowing, const drift, tighter numeric or string constraints, narrower header schemas, incompatible new request requirements, and removed or narrowed oneOf branches.

The check is limited to API schema compatibility. Existing system authority rules remain unchanged.

Verification commands:
npm run verify:schema-compatibility-tests
npm run verify:schema-compatibility-tests:self-test
npm test


## GREEN evidence

- Implementation merged to `main` as `dd76ee358531d060048df70cf41e205bce870f9b` from PR #194.
- Exact-head implementation commit before merge: `52f212cbc58146f3919fc17028ac13c80c05655c`.
- Pre-merge dedicated SYSTEM 24.13 workflow run `35667866119`: SUCCESS.
- Post-merge SYSTEM 24.13 workflow run `35668127618`: SUCCESS; invariant and negative self-tests both PASS.
- Post-merge Verify Enchev Web run `35668127593`: CI test suite PASS, TypeScript PASS, production build PASS, built health smoke test PASS on the merged main commit.
- Pre-merge security/supply-chain checks on the exact implementation head: Secret Scan, Code Scan, SBOM Generation and Build Provenance PASS.
- Protected DAVID orchestrator files were not changed by PR #194.
- No manual Vercel deployment was required for this repository contract/test-only block.
