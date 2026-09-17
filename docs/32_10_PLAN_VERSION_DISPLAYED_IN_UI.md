# Enchev Auctions — 32.10 Plan version displayed in UI

Status: YELLOW — production UI display already observed; automated invariant and final evidence verification pending
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.10`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`–`32.09`

## Contract
The active Master System Plan version must be visibly displayed in the Command Center UI and must come from one canonical source in code. The current frozen version is exactly `1.0 FROZEN`.

## Existing UI behavior
`app/components/MasterSystemPlanV1.tsx` defines:

`const PLAN_VERSION = "1.0 FROZEN";`

The same constant is rendered in at least two visible Command Center surfaces:
- the compact side-menu entry: `Master System Plan v{PLAN_VERSION}`;
- the full Command Center header: `MASTER SYSTEM PLAN v{PLAN_VERSION}`.

This prevents separate hard-coded version strings from drifting independently.

## Automated invariant
`scripts/verify-plan-version-ui.mjs` must verify:
- `PLAN_VERSION` exists;
- its exact value is `1.0 FROZEN`;
- the frozen task label `Plan version displayed in UI` still exists;
- the compact UI surface is bound to `PLAN_VERSION`;
- the full Command Center surface is bound to `PLAN_VERSION`;
- at least two visible UI bindings use the canonical constant.

Negative self-tests must reject:
- a changed/draft version;
- removal of the compact version display;
- removal of the full Command Center version display;
- removal/renaming of the frozen 32.10 task label.

## GREEN gate
GREEN requires:
- invariant PASS;
- negative self-tests PASS;
- all prior Wave 0 governance checks PASS;
- TypeScript PASS;
- production build PASS;
- production HTML returns HTTP 200 and visibly contains `Master System Plan v1.0 FROZEN`;
- Vercel runtime errors clean in the verification window;
- exact evidence recorded here and in `VerifiedPlanEvidenceSync`;
- cloud evidence sync includes `32.10` after GREEN evidence is committed.

No pricing/payment/finance scope is added.
