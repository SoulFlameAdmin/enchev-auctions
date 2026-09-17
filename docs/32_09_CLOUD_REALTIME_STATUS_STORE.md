# Enchev Auctions — 32.09 Cloud realtime status store

Status: GREEN — cloud plan state store, OIDC write path and SSE client implemented and verified
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.09`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`–`32.08`

## Contract
Master System Plan verification state must survive browser/device boundaries and be available from a cloud store. Cloud status is a governance projection only; it is never authoritative for auction state, bids, eligibility, vehicles, results, identities, or any business transaction.

## Supabase store
Dedicated table: `public.enchev_plan_state`.

Security properties:
- Row Level Security is enabled;
- `anon` and `authenticated` have no direct table privileges;
- there are no public write policies;
- service-role credentials remain inside Supabase Edge runtime and never enter browser, GitHub repository, or Vercel client code;
- table rows carry task ID, RED/YELLOW/GREEN status, evidence, blocker, update timestamp, source commit, source run and source workflow;
- GREEN rows require non-empty evidence at the Edge Function boundary.

Initial verified Wave 0 rows are seeded from the repository evidence mapping. The cloud table is separate from `enchev_development_events` and from all auction/business data.

## Cloud API and realtime path
Supabase Edge Function: `enchev-plan-state`.

- `GET` is read-only and returns the cloud plan projection;
- `GET ?stream=1` provides Server-Sent Events with state changes and keepalives;
- `POST` requires GitHub OIDC with audience `enchev-plan-state`;
- accepted writer identity is restricted to repository `SoulFlameAdmin/enchev-auctions`, owner/repository IDs, `refs/heads/main`, `push`, and exact workflow `verify-enchev-web.yml`;
- writes are bounded, schema-validated, evidence-gated and upserted by immutable task ID;
- no DELETE endpoint exists.

## Browser integration
`app/components/CloudPlanStateSync.tsx` is mounted globally.

Behavior:
- pulls cloud state on load;
- subscribes to the SSE stream for near-realtime updates;
- uses a 30-second read fallback if streaming is interrupted;
- reuses the existing BroadcastChannel so the local audit trail records cloud-driven changes as realtime state transitions;
- refuses to silently overwrite a newer local manual evidence/blocker decision;
- contains no Supabase service-role credential or other secret.

## CI write path
A separate `sync-plan-cloud` GitHub Actions job runs only after `verify-web` succeeds on `push` to `main`.

The job has `id-token: write`, requests a short-lived GitHub OIDC token for audience `enchev-plan-state`, sends the current verified evidence map to the Edge Function, then reads the cloud projection back and verifies status/evidence/source commit. No static Supabase secret is stored in GitHub.

## GREEN evidence
- Supabase migration: `create_enchev_plan_state_store` — applied successfully;
- `public.enchev_plan_state`: RLS enabled; direct `anon`/`authenticated` table grants: none;
- Supabase Edge Function `enchev-plan-state`: id `bebf7130-4473-4db0-bc24-a97c05c6bb98`, version `1`, status `ACTIVE`;
- browser cloud client: `cc2d21fbeaa2ab2fc77317821c134ac56c459bc4`;
- global client mount: `244c02f77c51faf2fbc9c531c82c752885ae7776`;
- workflow/cloud verification implementation: `78bf6ce3eb197b73b489664421587ec2d43e1955`;
- GitHub Actions run `35246234986`: `verify-web` SUCCESS and `sync-plan-cloud` SUCCESS;
- cloud invariant + self-tests: PASS;
- all previous Wave 0 governance guards: PASS;
- TypeScript check: PASS;
- production build: PASS;
- sync job read-back: `CLOUD_PLAN_STATE_SYNC PASS rows=18 commit=78bf6ce3eb197b73b489664421587ec2d43e1955`;
- Supabase read-back after OIDC sync: `row_count=18`, `exact_commit_rows=18`, and every GREEN row has non-empty evidence;
- exact Vercel production deployment: `dpl_5AAojnTphZbr5ZySixWUtQ4wRgyU` — READY for commit `78bf6ce3eb197b73b489664421587ec2d43e1955`;
- Vercel build: compile PASS, TypeScript PASS, static generation `9/9` PASS;
- canonical production URL: HTTP `200`;
- Vercel runtime errors in verification window: `0`.

The GREEN claim is limited to the Master Plan cloud status projection and synchronization path. PostgreSQL auction state, bids, results and other business truth remain outside this store and must use their separately defined authoritative components.

No pricing/payment/finance scope is added.
