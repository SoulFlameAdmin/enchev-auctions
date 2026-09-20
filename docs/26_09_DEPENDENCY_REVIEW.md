# 26.09 — Dependency review

## Goal

Fail closed when the locked dependency graph contains HIGH or CRITICAL known vulnerabilities, while remaining independent of optional GitHub repository security settings.

## Contract

- npm is the canonical dependency-review engine for this repository;
- CI runs `npm audit --package-lock-only --audit-level=high` against the deterministic `package-lock.json` established by 26.08;
- the npm registry advisory service is the authoritative vulnerability data provider for this gate;
- HIGH and CRITICAL findings fail the existing `verify-web` PR check;
- the local contract verifier rejects weakened severity, missing lockfile ownership, or removal of the CI audit command;
- dependency review does not modify packages automatically.

## Provider fallback evidence

The initial `actions/dependency-review-action@v4` attempt failed on exact-head CI because GitHub reported that Dependency Graph is not enabled for this repository. Enabling that repository setting is outside this code-only task and is not required for the npm advisory gate. The implementation therefore uses the supported npm registry audit path instead of bypassing permissions or fabricating provider state.
