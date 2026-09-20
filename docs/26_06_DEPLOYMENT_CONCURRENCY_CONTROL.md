# 26.06 — Deployment concurrency control

## Goal

Prevent overlapping Enchev Auctions Vercel deployment actions and make deploy ownership explicit, fail-closed, and auditable.

## Authoritative deployment lease

All manual or connector-driven Vercel deploy mutations for this project are serialized through the shared Supabase PostgreSQL lease in `public.david_vercel_deploy_lease`.

The required control flow is:

1. Claim with `public.david_claim_vercel_deploy(owner, project_key, commit_sha, 900)`.
2. If `granted=false`, perform no Vercel create/update/redeploy action.
3. If granted, call `public.david_mark_vercel_deploying(...)`.
4. Perform exactly one intended deployment.
5. Always release with `public.david_release_vercel_deploy(owner, success, detail_json)`.
6. When Vercel returns a concrete quota/rate-limit retry time, persist that exact time with `public.david_block_vercel_deploys(...)`; never invent a retry timestamp.

Preview and production manual deploy mutations share the same global lease.

## CI concurrency

The canonical `Verify Enchev Web` workflow keeps GitHub Actions concurrency enabled with a ref-scoped group and `cancel-in-progress: true`. This avoids redundant verification work for superseded commits while the database lease protects deployment mutation itself.

## Verification

`node scripts/verify-deployment-concurrency-control.mjs`

Self-tests:

`node scripts/verify-deployment-concurrency-control.mjs --self-test`

GREEN requires:
- repository contract verifier PASS;
- exact-head CI PASS;
- live Supabase evidence that the four lease functions and the lease table exist with the expected contract.
