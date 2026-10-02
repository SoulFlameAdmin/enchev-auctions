# SYSTEM 41.15 — Secret scanning clean

41.15 certifies that Enchev's repository-history secret scan is configured fail-closed and that **the exact task head must obtain a successful Secret Scan workflow result** before this task can be recorded GREEN.

## Scanner boundary

The canonical workflow is `.github/workflows/secret-scan.yml` and uses TruffleHog with:

- PRs targeting `main` and pushes to `main`;
- read-only repository contents permission;
- full-history checkout (`fetch-depth: 0`);
- action pinned to an immutable commit SHA;
- an explicit TruffleHog runtime version;
- no `continue-on-error`;
- no hidden exclude-path / suppression flags;
- no repository `.trufflehogignore` file.

The existing 26.10 gate remains a lower-level workflow configuration invariant. 41.15 adds the security-certification boundary and requires exact-head workflow success as the cleanliness evidence.

## Important evidence rule

A local verifier cannot prove that a hosted scanner found zero secrets. Therefore this task deliberately separates:

1. **repository-verifiable configuration** — checked by `verify-secret-scanning-clean-41-15.mjs`; and
2. **clean result evidence** — the exact GitHub head must have the **Secret Scan** workflow conclude `success`.

A passing configuration test alone must never be used to claim the repository is clean.

## Claim boundaries

41.15 does not claim organization-wide GitHub secret scanning, external secret-manager rotation, or that historical credentials were revoked merely because the current history scan is clean. SAST certification remains frozen task 41.16.

Run:

```bash
node scripts/verify-secret-scanning-clean-41-15.mjs --self-test
```
