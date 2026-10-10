import assert from "node:assert/strict";
import fs from "node:fs";

// Structural guard only: NEVER infer live RLS or customer auth from this test.
// Must be followed by isolated DB integration tests with two real test users.
const migrationPath="supabase/migrations/20261010143000_enchev_isolated_buyer_profiles.sql";
const sql=fs.readFileSync(migrationPath,"utf8");
const auth=fs.readFileSync("app/lib/enchev-auth-server.ts","utf8");
const docs=fs.readFileSync("docs/ENCHEV_P0_AUTH_IMPLEMENTATION_2026_10_10.md","utf8");

function verify(source) {
  const required=[
    /references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i,
    /alter\s+table\s+public\.enchev_buyer_profiles\s+enable\s+row\s+level\s+security/i,
    /alter\s+table\s+public\.enchev_buyer_profiles\s+force\s+row\s+level\s+security/i,
    /to\s+authenticated\s+using\s*\(\(select\s+auth\.uid\(\)\)\s*=\s*id\)/i,
    /with\s+check\s*\(\(select\s+auth\.uid\(\)\)\s*=\s*id\)/i,
    /grant\s+update\s*\(display_name,\s*phone_e164,\s*locale\)\s+on\s+public\.enchev_buyer_profiles\s+to\s+authenticated/i,
    /revoke\s+all\s+on\s+table\s+public\.enchev_buyer_profiles\s+from\s+public,\s*anon,\s*authenticated/i,
    /security\s+definer\s+set\s+search_path\s*=\s*''/i,
    /after\s+insert\s+on\s+auth\.users/i,
  ];
  for (const pattern of required) assert.match(source,pattern,`Buyer DB contract drift: ${pattern}`);
  const sqlStatementsOnly = source.replace(/--[^\n]*/g, "");
  assert.equal((sqlStatementsOnly.match(/^commit;/gm)||[]).length,1,"One atomic migration transaction required");
  assert.equal((sqlStatementsOnly.match(/create table public\.enchev_buyer_profiles/g)||[]).length,1,"Only one buyer table definition allowed");
  assert.ok(sqlStatementsOnly.includes("phone_e164 ~ '^[+][1-9][0-9]{6,14}$'"),"E.164 constraint must be complete");
  for(const forbidden of [
    /grant\s+all\s+on\s+public\.enchev_buyer_profiles/i,
    /grant\s+(?:insert|delete)\s+on\s+public\.enchev_buyer_profiles\s+to\s+(?:authenticated|anon)/i,
    /create\s+policy\s+[^;]*\busing\s*\(\s*true\s*\)/i,
    /\b(?:is_admin|role\s+text|account_balance|wallet_balance)\b/i,
  ])assert.doesNotMatch(sqlStatementsOnly,forbidden,`Unsafe buyer profile privileges: ${forbidden}`);
}

verify(sql);
assert.match(auth,/ENCHEV_AUTH_ENABLED\s*!==\s*"true"/);
assert.match(auth,/expectedRef\s*===\s*SHARED_GOVERNANCE_REF/);
assert.match(docs,/separate ENCHEV Supabase project/);
assert.match(sql,/dedicated ENCHEV Supabase database/i);

if(process.argv.includes("--self-test")){
  const missing=sql.replace("alter table public.enchev_buyer_profiles enable row level security;", "alter table public.enchev_buyer_profiles disable row level security;");
  assert.throws(()=>verify(missing));
  const open=sql+"\ngrant delete on public.enchev_buyer_profiles to authenticated;\n";
  assert.throws(()=>verify(open));
  const crossTenant=sql.replaceAll("((select auth.uid()) = id)","(true)");
  assert.throws(()=>verify(crossTenant));
}
console.log("ENCHEV_BUYER_IDENTITY_SCHEMA_GUARD PASS (source only, no DB touched)");
