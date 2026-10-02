# SYSTEM 41.18 — Dependency scan clean of Critical/High

41.18 upgrades the existing 26.09 dependency review into a dedicated exact-head certification artifact.

## Gate

The hosted **Dependency Scan** workflow runs:

```bash
npm audit --package-lock-only --audit-level=high --json
```

The raw JSON report and npm exit code are preserved before the certification parser runs. The gate fails closed when:

- `metadata.vulnerabilities.high > 0`;
- `metadata.vulnerabilities.critical > 0`;
- the vulnerability counters are missing/malformed;
- the audit report is missing/unparseable;
- npm audit itself exits non-zero;
- the exact task head does not obtain a successful hosted Dependency Scan workflow.

Medium/Low/Informational findings are retained in the report but do not violate the frozen 41.18 acceptance criterion.

## Scope boundary

This is an npm lockfile advisory scan. It does not claim OS package, container image, runtime-reachability, or external penetration-test coverage.

Run:

```bash
node scripts/verify-dependency-scan-clean-41-18.mjs --self-test
node scripts/verify-dependency-scan-clean-41-18.mjs --report artifacts/dependency-audit.json --exit-code-file artifacts/dependency-audit-exit-code.txt
```
