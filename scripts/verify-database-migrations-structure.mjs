import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = "config/enchev-database-migrations.json";
const MIGRATION_ROOT = "supabase/migrations";
const README_PATH = path.join(MIGRATION_ROOT, "README.md");
const SQL_NAME = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

function fail(message) {
  throw new Error(`DATABASE_MIGRATIONS_STRUCTURE FAIL: ${message}`);
}

function validTimestamp14(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  return year >= 2020 && year <= 2999 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    hour >= 0 && hour <= 23 &&
    minute >= 0 && minute <= 59 &&
    second >= 0 && second <= 59;
}

export function validateMigrationStructure(config, entries) {
  if (config.task !== "02.09") fail("task must be 02.09");
  if (config.engine !== "postgresql") fail("engine must be postgresql");
  if (config.provider !== "supabase") fail("provider must be supabase");
  if (config.migration_root !== MIGRATION_ROOT) fail("canonical migration root drift");
  if (config.naming !== "YYYYMMDDHHMMSS_snake_case.sql") fail("migration naming contract drift");
  if (config.implementation_state !== "structure-established") fail("implementation_state drift");
  if (config.append_only !== true) fail("migration history must remain append-only");
  if (config.schema_baseline_task !== "03.01") fail("schema baseline must stay owned by 03.01");
  if (config.migration_runner_task !== "03.02") fail("migration runner must stay owned by 03.02");
  if (config.staging_seed_task !== "03.03") fail("staging seed must stay owned by 03.03");
  if (config.schema_baseline_state !== "deferred") fail("02.09 must not claim schema baseline");
  if (config.migration_runner_state !== "deferred") fail("02.09 must not claim migration runner");
  if (config.staging_seed_state !== "deferred") fail("02.09 must not claim staging seed data");

  const timestamps = new Set();
  for (const entry of entries) {
    if (entry === "README.md") continue;
    if (!entry.endsWith(".sql")) fail(`unexpected file in migration root: ${entry}`);
    const match = SQL_NAME.exec(entry);
    if (!match) fail(`invalid migration filename: ${entry}`);
    if (!validTimestamp14(match[1])) fail(`invalid migration timestamp: ${entry}`);
    if (timestamps.has(match[1])) fail(`duplicate migration timestamp prefix: ${match[1]}`);
    timestamps.add(match[1]);
  }

  return true;
}

function loadActual() {
  if (!fs.existsSync(CONFIG_PATH)) fail(`missing ${CONFIG_PATH}`);
  if (!fs.existsSync(MIGRATION_ROOT) || !fs.statSync(MIGRATION_ROOT).isDirectory()) fail(`missing ${MIGRATION_ROOT}`);
  if (!fs.existsSync(README_PATH)) fail(`missing ${README_PATH}`);

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const entries = fs.readdirSync(MIGRATION_ROOT).sort();

  const readme = fs.readFileSync(README_PATH, "utf8");
  for (const marker of ["03.01", "03.02", "03.03", "append-only", "YYYYMMDDHHMMSS_snake_case.sql"]) {
    if (!readme.includes(marker)) fail(`README missing migration structure marker: ${marker}`);
  }

  return { config, entries };
}

function expectRejected(label, mutate) {
  const actual = loadActual();
  let rejected = false;
  try {
    const changed = mutate({
      config: structuredClone(actual.config),
      entries: [...actual.entries]
    });
    validateMigrationStructure(changed.config, changed.entries);
  } catch {
    rejected = true;
  }
  if (!rejected) fail(`negative self-test was not rejected: ${label}`);
}

const actual = loadActual();
validateMigrationStructure(actual.config, actual.entries);

if (process.argv.includes("--self-test")) {
  expectRejected("wrong frozen task", (x) => ({ ...x, config: { ...x.config, task: "02.10" } }));
  expectRejected("migration root drift", (x) => ({ ...x, config: { ...x.config, migration_root: "database/migrations" } }));
  expectRejected("append-only disabled", (x) => ({ ...x, config: { ...x.config, append_only: false } }));
  expectRejected("false schema baseline claim", (x) => ({ ...x, config: { ...x.config, schema_baseline_state: "implemented" } }));
  expectRejected("bad migration filename", (x) => ({ ...x, entries: [...x.entries, "001_initial.sql"] }));
  expectRejected("bad migration timestamp", (x) => ({ ...x, entries: [...x.entries, "20261301000000_bad_month.sql"] }));
  expectRejected("duplicate migration timestamp", (x) => ({
    ...x,
    entries: [...x.entries, "20260919010101_first.sql", "20260919010101_second.sql"]
  }));
  expectRejected("unexpected migration-root file", (x) => ({ ...x, entries: [...x.entries, "notes.txt"] }));
  console.log("DATABASE_MIGRATIONS_STRUCTURE_SELF_TEST PASS negative_cases=8");
} else {
  console.log(`DATABASE_MIGRATIONS_STRUCTURE PASS root=${MIGRATION_ROOT} sql_migrations=${actual.entries.filter((x) => x.endsWith(".sql")).length} baseline_owner=03.01 runner_owner=03.02 seed_owner=03.03`);
}
