# SYSTEM 41.16 — SAST clean of Critical/High

41.16 turns CodeQL from a scan-only workflow into a fail-closed SAST severity gate.

## Why the existing workflow was not enough

A successful CodeQL analysis step proves the analyzer ran and uploaded/processed results; by itself it does **not** prove that no High/Critical security findings exist. 41.16 therefore requires the exact CodeQL SARIF to be inspected before the workflow can pass.

## Enforced flow

1. CodeQL initializes for JavaScript/TypeScript using the `security-extended` query suite.
2. `analyze` writes SARIF to `artifacts/codeql-sarif` with automatic upload disabled.
3. `verify-sast-clean-41-16.mjs --dir artifacts/codeql-sarif` parses the actual SARIF.
4. Any security result with numeric `security-severity >= 7.0` fails the workflow.
5. Any security-tagged result without a parseable security severity also fails closed.
6. The SARIF is uploaded to GitHub Code Scanning afterwards with `if: always()`, so findings remain visible even when the gate fails.
7. The exact PR head must have the **Code Scan** workflow conclude `success` before 41.16 can be GREEN.

## Scope and claim boundary

This certifies the JavaScript/TypeScript CodeQL surface scanned by the configured query suite. It does not claim DAST, dependency-vulnerability scanning, external penetration testing, or coverage of languages not present in this CodeQL job.

Run configuration/self-tests:

```bash
node scripts/verify-sast-clean-41-16.mjs --self-test
```

Run against a generated SARIF directory:

```bash
node scripts/verify-sast-clean-41-16.mjs --dir artifacts/codeql-sarif
```
