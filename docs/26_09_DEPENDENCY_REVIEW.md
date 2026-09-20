# 26.09 — Dependency review

## Goal

Reject pull requests that introduce newly vulnerable dependencies at HIGH or CRITICAL severity while preserving the reproducible dependency baseline established by 26.08.

## Contract

- dependency review runs on `pull_request` inside the existing `verify-web` CI job;
- the canonical action is `actions/dependency-review-action@v4`;
- `fail-on-severity: high` blocks HIGH and CRITICAL newly introduced vulnerabilities;
- push-to-main runs skip the PR-only review step but still execute the local contract verifier;
- `package-lock.json` remains mandatory through 26.08, so review is based on deterministic dependency resolution;
- any dependency-review or contract-verifier failure blocks GREEN.

## Safety boundary

26.09 does not auto-update dependencies and does not silently accept vulnerable upgrades. Remediation remains an explicit code change reviewed through the same PR checks.
