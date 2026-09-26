# SYSTEM 33.11 — Starting-soon reminders

Status: **YELLOW** until exact-head CI/security/build checks, READY exact-head Vercel preview, merge, and post-merge descendant verification pass.

## Purpose

Implement the next frozen Phase 33 task: **33.11 Starting-soon reminders**.

The task defines deterministic reminder eligibility for an authenticated buyer without creating a second source of truth for auction schedule state.

## Rules

- PostgreSQL remains authoritative for auction schedule/state.
- Only rows owned by the authenticated user are considered.
- Only `scheduled` auctions can produce a starting-soon reminder.
- Past auctions and auctions outside the configured lead window are excluded.
- The default lead window is 15 minutes; the validated upper bound is 24 hours.
- Reminder candidates are sorted by authoritative start time and bounded.
- Every candidate receives a deterministic reminder key derived from user, auction, normalized start time, and lead window.
- **33.14 Duplicate notification suppression** owns persisted duplicate suppression; 33.11 does not pre-empt that task.
- Delivery-provider integration is not invented here.

## Persistence boundary

No business table is added to the connected governance-only Supabase project. This task is a deterministic domain projection over authoritative schedule data.

## Acceptance

GREEN requires frozen task identity verification, fail-closed domain/self-tests, aggregate CI integration, exact-head CI/security/build success, READY exact-head Vercel preview, merge, and post-merge descendant evidence.

No protected DAVID orchestrator file is modified.
