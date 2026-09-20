# 26.13 — Build provenance

Status: implemented; GREEN requires exact-head CI evidence and post-merge main CI evidence.

## Contract

- Build the production Next.js output from the committed lockfile with Node 24 and `npm ci --no-audit --no-fund`.
- Check out the exact pull-request head SHA (or exact push SHA on `main`) before the build.
- Hash every regular file in `.next` in stable path order and derive one SHA-256 digest for the complete build output.
- Hash `package-lock.json` independently so the provenance binds the build to the committed dependency graph.
- Emit `artifacts/enchev-build-provenance.intoto.json` as an in-toto Statement v1 with SLSA provenance v1 predicate type.
- Record the repository, exact source SHA, GitHub workflow reference, Node runtime, lockfile digest, build-output digest, GitHub Actions run identity and output file count.
- Upload the provenance as an exact-head artifact named `enchev-build-provenance-<source-sha>`.
- Missing build output, malformed provenance, non-matching source SHA, invalid digests or missing artifact fail CI.

## Trust boundary

This task creates verifiable CI-generated provenance and exact-head artifact evidence. It does **not** claim a cryptographic signature, transparency-log inclusion or higher SLSA build level. Those require a separately approved attestation/signing trust step.

## Evidence rule

26.13 is GREEN only after the dedicated Build Provenance workflow is terminal PASS on the exact pull-request head, the exact-head provenance artifact exists and validates, the repository verification remains PASS, and the post-merge `main` run is terminal PASS.

No Vercel deployment, provider credential mutation, database mutation or DAVID infrastructure change is required.
