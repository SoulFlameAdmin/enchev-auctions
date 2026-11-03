-- Run with psql separately on each operator-confirmed environment:
-- psql -X -v ON_ERROR_STOP=1 -v relation='schema.table' -v app_role='role' \
--      -f scripts/sql/d003-role-boundary.sql
-- Supply connection settings through the approved secret store. Run once for
-- each intended application role, using an account allowed to inspect metadata.
-- Compare the private output with the role's expected access policy. No rows
-- from the named relation are read. Database names alone cannot prove that
-- environments are isolated. Verify project identities separately.
BEGIN READ ONLY;

SELECT c.oid IS NOT NULL AS relation_found,
       r.oid IS NOT NULL AS role_found,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS table_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS table_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS table_update,
       has_any_column_privilege(r.oid, c.oid, 'UPDATE') AS any_column_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS table_delete
FROM (VALUES (to_regclass(:'relation'), :'app_role'::text)) AS input(rel, role_name)
LEFT JOIN pg_catalog.pg_class c ON c.oid = input.rel AND c.relkind IN ('r', 'p')
LEFT JOIN pg_catalog.pg_roles r ON r.rolname = input.role_name;

ROLLBACK;
