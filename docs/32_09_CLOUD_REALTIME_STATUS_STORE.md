# Enchev Auctions — 32.09 Cloud realtime status store

Status: YELLOW — cloud store, secure write path and realtime client implemented; production verification pending
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

## GREEN gate
GREEN requires:
- Supabase table exists with RLS enabled and only Enchev governance rows;
- Edge Function ACTIVE and public read / OIDC-only write behavior proven;
- cloud invariant + self-tests PASS;
- all previous Wave 0 governance guards PASS;
- TypeScript PASS;
- production build PASS;
- cloud sync job PASS with read-back evidence;
- Vercel production deployment containing `CloudPlanStateSync` READY;
- production HTTP healthy and runtime errors clean;
- exact evidence recorded here and in `VerifiedPlanEvidenceSync`.

No pricing/payment/finance scope is added.
