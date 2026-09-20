# 26.11 — Code scanning gate

## Goal

Fail closed on static application-security analysis for the repository's JavaScript/TypeScript code before merge.

## Contract

- GitHub CodeQL is the SAST engine for this gate.
- The workflow runs on pull requests to main and pushes to main.
- The CodeQL action is pinned to upstream commit `977e6ceaea7361825998245d787fa3b4d6b9e5df` (CodeQL bundle v2.27.0).
- Analysis language is `javascript-typescript`.
- Workflow permissions are limited to `contents: read` plus `security-events: write` for CodeQL result upload.
- `scripts/verify-code-scanning-gate.mjs` rejects configuration drift, floating CodeQL refs, missing permissions, or removal of the JS/TS analysis target.
- The contract verifier also runs inside the primary `Verify Enchev Web` workflow so deleting or weakening the dedicated scan workflow breaks the main CI gate.

## Acceptance

26.11 is GREEN only after the exact pull-request head has terminal PASS for:
1. Code Scan / CodeQL analysis,
2. Secret Scan regression,
3. Verify Enchev Web,

and after the merged main commit repeats the applicable checks successfully.
