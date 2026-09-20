# 25.08 — Flaky-test policy

## Purpose

Flakiness must never become a mechanism for hiding defects. A failed test is evidence until its cause is classified and resolved or, for a narrowly defined infrastructure transient, re-run under controlled conditions.

## Core rules

- Blind retries are forbidden.
- Test bodies have zero automatic retries by default.
- Product assertion failures are never reclassified as flaky merely because a later run passes.
- A targeted workflow/job retry is allowed at most once and only when logs show a concrete transient infrastructure class.
- Retry evidence must be from the exact same commit SHA with no code changes.
- The original failed run remains part of the evidence trail; a successful retry does not erase it.
- Product defects, deterministic logic failures, schema mismatches, authorization failures, data integrity failures, and business-rule failures are not flake classes.

## Allowed transient classes

- runner infrastructure transient;
- external service transient;
- browser-process startup transient;
- network transport transient.

Each classification requires concrete logs and an exact failure signature.

## Recurrence

If the same failure signature occurs twice, it is no longer treated as a one-off. Root-cause work must be opened and the issue must stop being waved through as transient.

Quarantine is allowed only with a named owner, tracking reference, and expiry. A quarantined critical-path test can never be counted as GREEN.

## GREEN acceptance

GREEN requires all applicable deterministic tests to pass. Unresolved product failures and unresolved critical flakes block GREEN. For a permitted infrastructure retry, evidence must retain both the original failure and the successful exact-SHA retry.

## Ownership

25.07 owns controlled clock/time utilities. 25.09 owns critical-path coverage targets. 25.08 owns only flaky-test classification, retry, recurrence, quarantine, and GREEN semantics.
