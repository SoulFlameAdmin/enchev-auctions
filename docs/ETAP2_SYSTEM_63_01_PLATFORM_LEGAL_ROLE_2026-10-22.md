# ENCHEV — Етап 2 / SYSTEM 63.01: Platform legal role model

Status: **YELLOW — implementation proposal, not activated**.
Date: 2026-10-22.

## Transition from the closed LIVE demo

The product owner has accepted Етап 1 as GREEN for the demo handoff. This is a business milestone acknowledgement, not automatic technical proof of every frozen SYSTEM task. The 4,374-point immutable MASTER plan and GREEN-evidence rules remain unchanged.

## First Stage 2 implementation slice

The expansion plan defines SYSTEM 63.01 as **"platform legal role — Canonical schema/entity model"** inside Phase 63 (Commercial roles, marketplace model & contract architecture). This is a prerequisite for designing roles, commercial quotes, platform fees, auctions with sellers of record, financial flows, and international onboarding without hardcoding legal conclusions into the UI.

Code: `packages/domain/src/platform-legal-role.ts`.

The model records:
- Operator legal-entity ID, market-country code and configurable role code
- Evidence references for contract and legal review
- Draft/review/approved/suspended status
- UTC start/end of effect and immutable revision
- A read-only, fail-closed lookup keyed by entity + country + role + time

**Important:** a record's `approved` status alone does not establish legal approval. The cited documents must be verified independently. This model cannot authorize payment processing, real-money bidding, country activation or contracting.

## Scope and explicit exclusions

- No Supabase migrations, writes, tables or Auth changes
- No Vercel production deployment or production configuration changes
- No changes to the existing LIVE demo, pricing or auction winner selection
- No real money, Stripe connection, commissions calculation or AI responses
- No silent GREEN status changes or changes to frozen master task IDs

## Acceptance gates for this slice

1. TypeScript module compiles in isolation.
2. Positive case returns a market/role-specific approved record for the effective interval.
3. Under-review, other entity/market/role and expired records never resolve.
4. Invalid contract/review evidence, malformed country/time/revision are rejected.
5. Overlapping approved records and duplicate IDs fail closed.
6. Pull-request CI runs all cases successfully.
7. Review, merge, and evidence recording before **SYSTEM 63.01** can be evaluated for GREEN.

Test: `node scripts/verify-etap2-platform-legal-role-63-01.mjs`.

## Next Stage 2 steps

- SYSTEM 63.02/63.03: lifecycle and validation with immutable/auditable transition rules
- SYSTEM 63.05+: seller-of-record and counterparty model, authorization review
- Phase 64 after Phase 63 dependencies: fee schedule and commission calculation, with currency-safe integer minor units
- Phase 65 after 64/67/69 dependencies: payment intent, deposits, refunds and payouts in a sandbox
- Vehicle inventory/seller operations integration using existing seller listing foundation (SYSTEM 35) and search domain; replace static demo fixtures only after approved storage/security boundaries
- ENCHEV AI assistant is a separate, non-authoritative capability and must not determine bids, pricing obligations or legal compliance

Full evidence and dependency-gated system execution are controlled by `docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md` and `docs/MASTER_SYSTEM_EXPANSION_V2.md`.


## SYSTEM 63.02 — lifecycle transitions (added in follow-up)

Status: **YELLOW until CI exact-head and evidence gates pass**.

- Domain implementation: `packages/domain/src/platform-legal-role-lifecycle.ts`
- Test: `node scripts/verify-etap2-platform-legal-role-lifecycle-63-02.mjs`
- Authorized transitions: draft → under-review → approved → suspended → under-review; under-review → draft for changes.
- Every transition checks the expected revision and records immutable audit metadata (actor ID, action, reason, time, old/new states).
- Approval requires contract and legal-review references, with no cross-market implicit permissions.
- The record's status is never a substitute for verifying actor authorization and legal documents via the server.
- No production database or LIVE bidding changes.
