# SYSTEM 41.19 — SBOM produced and archived

41.19 certifies the already-existing exact-head CycloneDX SBOM workflow as the frozen Phase 41 software-bill-of-materials evidence.

## Required evidence path

The hosted **SBOM Generation** workflow must:

- checkout the exact pull-request head or exact push SHA;
- run on Node 24;
- generate `artifacts/enchev-sbom.cdx.json` from the lockfile with `npm sbom --package-lock-only`;
- use CycloneDX format and application type;
- validate the generated artifact before upload;
- archive it under an artifact name containing the exact source SHA;
- fail when the artifact is missing;
- retain the artifact for at least 14 days;
- conclude `success` on the exact 41.19 head before GREEN.

The lower-level 26.12 verifier remains authoritative for SBOM document structure. 41.19 adds Phase 41 archival/evidence semantics rather than duplicating generation.

## Scope boundary

This is the application dependency SBOM. Container-image and infrastructure SBOMs are not claimed.

Run:

```bash
node scripts/verify-sbom-produced-archived-41-19.mjs --self-test
```
