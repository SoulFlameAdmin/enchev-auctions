# SYSTEM 24.10 - Deprecation/backward-compatibility policy

Task: **24.10 Deprecation/backward-compatibility policy**

Status: **YELLOW** - implementation is present on the task branch; GREEN requires applicable PASS CI, merge, post-merge verification, and concrete evidence.

## Contract

The published v1 HTTP API compatibility line is governed by `config/enchev-api-compatibility-policy.json`.

Within v1, published operations cannot be removed or silently renamed, previously documented response status codes cannot disappear, and an optional request body cannot become required. Breaking changes require a new compatibility line.

Deprecation requires `deprecated: true` plus `x-enchev-deprecation` metadata containing `announcedOn`, `sunsetNotBefore`, `replacementOperationId`, and `reason`. The minimum notice period is 90 days.

Every endpoint in the canonical SYSTEM 24.09 inventory must remain covered by the compatibility contract. The contract is descriptive only; PostgreSQL remains authoritative for auction state, accepted bids, winner selection, and final results.


## GREEN evidence

- Implementation merged to `main` as `dd76ee358531d060048df70cf41e205bce870f9b` from PR #194.
- Exact-head implementation commit before merge: `52f212cbc58146f3919fc17028ac13c80c05655c`.
- Pre-merge dedicated SYSTEM 24.13 workflow run `35667866119`: SUCCESS.
- Post-merge SYSTEM 24.13 workflow run `35668127618`: SUCCESS; invariant and negative self-tests both PASS.
- Post-merge Verify Enchev Web run `35668127593`: CI test suite PASS, TypeScript PASS, production build PASS, built health smoke test PASS on the merged main commit.
- Pre-merge security/supply-chain checks on the exact implementation head: Secret Scan, Code Scan, SBOM Generation and Build Provenance PASS.
- Protected DAVID orchestrator files were not changed by PR #194.
- No manual Vercel deployment was required for this repository contract/test-only block.
