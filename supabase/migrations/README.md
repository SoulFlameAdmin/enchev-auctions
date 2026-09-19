# Enchev Auctions database migrations

This directory is the canonical PostgreSQL migration root for Enchev Auctions.

Task **02.09** establishes the migration structure only. It intentionally does not create the schema baseline, migration runner, or staging seed data; those belong to frozen tasks **03.01**, **03.02**, and **03.03**.

## File naming

Every SQL migration must use:

`YYYYMMDDHHMMSS_snake_case.sql`

Example shape only:

`20260919010101_example_description.sql`

Do not add an example SQL migration just to populate this directory.

## Rules

- PostgreSQL is the authoritative datastore.
- Migrations are append-only repository history.
- Existing applied migration files are not rewritten to change history.
- One timestamp prefix identifies one migration.
- Schema/runtime behavior is introduced only by the frozen task that owns it.
- Secrets and provider credentials never belong in migration files.
- This directory is structure, not proof that the schema baseline or migration runner exists.

The canonical structure contract is `config/enchev-database-migrations.json`.
