# SYSTEM 41.19 — SBOM produced and archived

The existing exact-head SBOM workflow is hardened into the frozen 41.19 evidence gate.

It generates a CycloneDX JSON SBOM from the lockfile, validates it, computes a SHA-256 digest, verifies that digest, and archives both files for 30 days. GREEN additionally requires the exact-head **SBOM Generation** workflow to succeed.
