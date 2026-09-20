# 26.06 — Deployment concurrency control

Status target: GREEN after exact-head and post-merge CI verification.

The repository uses one shared Supabase/PostgreSQL deployment lease for Enchev Vercel operations. The canonical lease owner is ENCHEV_SYSTEM, the project key is enchev-auctions, and the lease duration is 900 seconds.

A deployment may proceed only after a granted global claim. One grant covers one intended deployment and every granted attempt must be terminally released. Provider quota blocking records only provider-supplied retry timestamps.

Live evidence on 2026-09-21: the linked Supabase project frhletkiuupgksmgxoxc reports the deployment lease table and deployment-events table with RLS enabled. PostgreSQL catalog inspection reports the four required deployment coordination functions as executable SECURITY DEFINER functions. The events table contains historical coordination records, so the mechanism is live rather than a repository-only mock.

Repository verification is implemented by scripts/verify-deployment-concurrency-control.mjs and reuses the 26.04 staging policy as the canonical checked contract so lease rules cannot drift between CI/CD tasks.
