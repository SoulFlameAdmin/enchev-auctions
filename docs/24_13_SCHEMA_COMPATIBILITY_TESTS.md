# SYSTEM 24.13 - Schema compatibility tests

Status: implemented on the active PR branch.

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

GREEN requires invariant and negative self-tests to pass in CI for the implementation commit or a proven descendant.
