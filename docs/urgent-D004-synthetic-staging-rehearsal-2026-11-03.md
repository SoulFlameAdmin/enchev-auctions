# ENCHEV AUCTIONS — D004: isolated staging DB / synthetic vehicle seed

**Date:** 3 Nov 2026 · **Due:** 6 Nov 2026 · **Task state:** BLOCKED — D003 required role/environment proof incomplete
**Original criterion:** "Един тестов автомобил в staging, нула production writes" / dependency D003.

## 1. What has been implemented

A safe offline rehearsal that uses a single, deterministic, **nonexistent vehicle** from `test/fixtures/canonical-v1.json`. There is no network client, no Supabase API invocation, no production DB connection and no permanent local database.

- `test/fixtures/urgent-D004-synthetic-vehicle.json` adds a test-only seller identity `seller-d004@example.test`, the existing canonical synthetic car ID/VIN/lot, fictitious make/model, unapproved title status, `XXX` currency, and a hard `canPublish:false` flag.
- `config/urgent-D004-staging-seed-v1.json` retains four real provider acceptance gates and accurately describes staging project/role/seed as **not verified**.
- `scripts/verify-urgent-d004-staging-seed.mjs` first validates the frozen D004 criterion, dependency D003, identity, fictional fields, secret-free data and no cloud authorization; then seeds an **in-memory Node.js SQLite** table with exactly one fake car. A second insert is idempotently ignored. The table is disposed on exit.
- The script runs 16 deliberate **negative tests**, rejecting fake staging authority, invented role verification, invented zero-production-write evidence, changed synthetic car identity, real-money flags, publishable fake car or real customer email.
- `scripts/run-ci-tests.mjs` includes the verifier. A green offline test is **not** an accepted real staging seed.

Run:

```sh
node scripts/verify-urgent-d004-staging-seed.mjs
node scripts/verify-urgent-d004-staging-seed.mjs --self-test
```

Expected success evidence (only for local rehearsal):

```text
URGENT_D004_OFFLINE_REHEARSAL PASS synthetic_cars=1 sqlite_in_memory=true external_connections=0 actual_supabase_staging=NOT_VERIFIED task_acceptance=BLOCKED
URGENT_D004_OFFLINE_REHEARSAL_SELF_TEST PASS negative_cases=16 no_network_calls=true
```

**The offline SQLite rehearsal is deliberately not a real Supabase staging database.** It demonstrates the deterministic vehicle fixture and the security boundary, but does not satisfy the D004 acceptance test.

## 2. Why a real staging seed is blocked

D003's read-only audit (main: `config/urgent-D003-db-binding-audit.json`) shows:
- The accessible Enchev Supabase project (`ejfrnjhlggebzmpmxajl`) is a Frankfurt demo/shared deployment, not established as a production transaction authority.
- The source-configured `soulflame-twins` governance project (`frhletkiuupgksmgxoxc`) was inaccessible through the connected account.
- Vercel environment metadata returned HTTP 403; production/preview binding identity cannot be verified.
- No independent staging Supabase project or branch has been proven.
- A Vercel Preview build is **not** proof of a separate staging database.

Therefore, D004's actual integration remains **BLOCKED**. This repository PR does **not** create a paid project/branch, apply a database migration, mutate Supabase rows, change secrets, or use the reachable production-like demo database as staging.

## 3. Acceptance gates to close D004

| Gate | Required evidence | Current |
|---|---|---|
| D004-G1 | Unique staging project/branch ID, distinct from any production target | BLOCKED |
| D004-G2 | Verified staging-only DB role/keys and separated runtime binding | BLOCKED |
| D004-G3 | **Exactly one synthetic car** actually inserted/read back on isolated Supabase staging | BLOCKED |
| D004-G4 | Database audit or other trustworthy provider evidence of **zero production writes** during seed | BLOCKED |

Additionally, D003 must be independently completed.

## 4. Safe path after owner approval

1. Owner specifies which Supabase organization owns the staging service, obtains quoted recurring cost, and explicitly approves any charge. This report does not authorize spend.
2. Create a dedicated persistent staging project or branch according to Supabase's current documented workflow, keeping production and staging DB identities **different**.
3. Confirm bindings by **metadata only**; never paste secret keys into GitHub, ChatGPT or artifacts. Apply least-privilege permissions and verify that the runtime's Vercel Preview is bound to staging.
4. Deploy the same reviewed schema via a migration in staging only; avoid exposing the staging seed table to `anon` or `authenticated` without a specifically reviewed RLS policy.
5. Apply the deterministic single-car synthetic fixture and read it back with least-privilege staging credentials. Never copy live user data.
6. Independently inspect production audit logs or provider metrics to confirm there were no writes attributable to staging.
7. Update D003/D004 gate evidence with exact refs and check results; only then remove the fail-closed status and mark accepted.

Supabase's current <https://supabase.com/docs/guides/deployment/branching> documentation notes that branches use separate instances/API credentials and **do not inherit production data**. A persistent staging branch is suited to this purpose; confirm any branch-related cost before creation.

## 5. Scope separation

This PR is an **implementation of the safe preparatory portion of D004**, not the completion of staging database provisioning. No paid service, production secret, real buyer, seller, auction, title document, payment, or payout has been created or activated. Original D001 and D002 proof, D003 BLOCKED, 119-day baseline and DAVID infrastructure remain unchanged.
