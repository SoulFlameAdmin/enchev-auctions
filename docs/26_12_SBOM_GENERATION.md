# 26.12 — SBOM generation

Status: implemented; GREEN requires exact-head CI evidence and post-merge main CI evidence.

## Contract

- Generate a machine-readable CycloneDX software bill of materials from the committed npm lockfile.
- Use the repository's Node/npm toolchain with `npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application`.
- Validate that the output is CycloneDX, represents the `enchev-auctions` application root, and contains dependency components.
- Upload `artifacts/enchev-sbom.cdx.json` as an exact-head GitHub Actions artifact named with the exact source SHA (`github.event.pull_request.head.sha` for pull requests, otherwise `github.sha`).
- Missing generation, invalid structure, or missing upload fails CI.

## Evidence rule

26.12 is GREEN only after the SBOM workflow is terminal PASS on the exact pull-request head, the uploaded artifact exists for that head, the existing repository verification remains PASS, and the post-merge main run is terminal PASS.

No Vercel deployment, provider credentials, or DAVID infrastructure changes are required for this task.
