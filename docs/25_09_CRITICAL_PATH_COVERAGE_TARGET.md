# 25.09 — Critical-path coverage target

## Goal

Define a measurable coverage target for the business and system paths where an undetected defect could corrupt auction authority, access control, eligibility, finalization, release, or production recovery.

This task defines the target. It does **not** claim that the current product already meets it.

## Target

Production acceptance requires:

- 100% of registered critical paths to have automated coverage;
- 100% of the scenario dimensions marked applicable to each critical path to have at least one automated scenario;
- 100% of critical invariants attached to those paths to be covered by automated verification.

The target is scenario/invariant based rather than a repository-wide line-coverage percentage. The repository currently has no authoritative line/branch coverage instrumentation, so this task does not invent a current percentage or pretend that a line metric has been measured.

## Scenario dimensions

The registry can require any of these dimensions per critical path:

- happy path;
- authorization or eligibility denial;
- validation or boundary failure;
- idempotency or duplicate protection;
- time or ordering boundary;
- recovery or reconnect.

Applicability is explicit per path. A dimension that is not applicable does not count against the path, but every listed applicable dimension is mandatory.

## Registered critical paths

The machine-readable registry covers identity/session access, seller vehicle publication, buyer eligibility, pre-bid/max-bid, live bidding, auction close/finalization, result notifications, release/pickup/logistics, high-risk admin operations, and production health/rollback readiness.

## GREEN semantics

GREEN for task 25.09 means the target, registry, measurement semantics, and CI guard are implemented and verified.

It does **not** mean all future critical paths are already implemented or that the product currently meets the target. Final production acceptance must separately prove the target using concrete automated-test evidence tied to exact commits.

Manual-only evidence cannot satisfy this target. A quarantined critical-path test also does not count as covered, consistent with 25.08.

## Ownership boundaries

- 25.08 owns flaky-test classification and quarantine policy.
- 25.10 owns the cross-browser test matrix.
- 25.11 owns the mobile-browser test matrix.
