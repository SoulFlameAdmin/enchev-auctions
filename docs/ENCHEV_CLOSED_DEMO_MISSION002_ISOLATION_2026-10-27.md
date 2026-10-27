# ENCHEV MASTER SYSTEM P0 — MISSION-002 safe DEMO boundary

Date: 2026-10-27. **DRAFT / YELLOW: no release or GREEN claim**.

Parent source of truth: original MASTER v1.0 FROZEN (1,054) plus MASTER EXPANSION v2 (3,226) plus 94 historical GAP items, total 4,374. Active closed demo overlay is docs/URGENT_DAVID_AGI_ENCHEV_CLOSED_DEMO_V1.md. No SYSTEM task identity, color or dependency changed.

## What is implemented

1. Pure, deterministic MISSION-002 domain gate in packages/domain/src/closed-demo-isolation.ts.
2. Explicit required environment opt-in flags:
   - ENCHEV_CLOSED_DEMO_ENABLED=true
   - ENCHEV_CLOSED_DEMO_PAYMENT_MODE=simulated-only
   - ENCHEV_CLOSED_DEMO_DOCUMENT_MODE=watermarked-nonlegal
   - ENCHEV_CLOSED_DEMO_STORAGE_MODE=memory-only
   - ENCHEV_CLOSED_DEMO_NAMESPACE=enchev_closed_demo_local_unique or enchev_closed_demo_preview_unique
3. Allowed only in local development/test (without Vercel runtime) or in Vercel Preview tied to its own *separate* demo project ID: VERCEL_PROJECT_ID must exactly match ENCHEV_CLOSED_DEMO_PROJECT_ID, never the verified auction production project ID. A production Vercel deployment, unknown runtime, mismatched project, or wrong namespace fails closed.
4. Trusted server-only adapter at app/lib/enchev-closed-demo-server.ts reads process.env, never browser-selected scope or parameters.
5. Payment provider integration, live payments, provider secrets and database writer credentials all block demo activation.
6. All returned draft demo document and payment metadata is immutable, in memory only, non-legal, NOT PAYABLE, and unable to charge or settle. No real documents are generated. Transaction IDs require the demo- prefix. Pure module has no HTTP, database or payment I/O.
7. Read-only CI compiles the pure module, checks TypeScript, runs local/preview positive tests and 24 negative security fixtures.

## Important limitation

This is a safe **offline boundary foundation**, not a certified real or demo payment service. It prevents this module from performing external side effects, but cannot prove that independently written future routes will invoke it. A persistent test database, endpoint authorization, negative bypass tests and human approval are required before any future database-backed demo is activated. Never write demo money/documents into real auction payment/legal paths or into unrelated DPP/DAVID/calendar tables.

## Acceptance and continuation

- Verify MISSION-002 test on the exact PR head.
- Review CI checks, TypeScript and the blocked real-world modes. No Vercel production deploy, schema changes, auth enablement or modifications of DAVID orchestration.
- Remain YELLOW pending dedicated staging/runtime integration and explicit reviewer approval.
- Next: MISSION-003 roles (Seller/Admin, Mitko and Borko), then MISSION-004 persistent test vehicle.
- Separate preexisting blockers (Forge media HTTP 404, Next.js critical dependency audit) are not waived.
- This PR stacks on MISSION-001 #384 and must not merge until its base is reviewed.
