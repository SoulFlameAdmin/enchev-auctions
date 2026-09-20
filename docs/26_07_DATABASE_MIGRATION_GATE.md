# 26.07 — Database migration gate

## Goal

Block unsafe migration-history changes in CI without performing a live database mutation.

## Gate

The canonical migration root remains `supabase/migrations` from task 02.09. The gate enforces:

- append-only SQL migration history;
- canonical timestamped snake_case filenames;
- no duplicate timestamp prefixes;
- no deletion or modification of already committed SQL migrations;
- every new SQL migration must still pass the existing structural verifier;
- a failing gate blocks GREEN.

The gate is executed through the stable system pre-gate runner, before the legacy aggregate test suite.

## Safety boundary

26.07 does not run migrations against Supabase and does not claim migration-runner ownership. Live migration execution remains owned by 03.02. This task only creates the CI acceptance barrier that rejects unsafe repository migration changes.
