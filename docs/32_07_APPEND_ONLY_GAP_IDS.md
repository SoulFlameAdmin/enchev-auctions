# Enchev Auctions — 32.07 New discoveries use append-only GAP IDs

Status: GREEN — append-only GAP allocator/guard implemented, tested and production-verified
MASTER SYSTEM PLAN v1.0 FROZEN task: `32.07`
Execution wave: `WAVE 0 — Master plan governance`
Depends on: `32.01`–`32.06`

## Contract

The frozen task IDs never change. Discoveries made after the frozen baseline use permanent append-only GAP IDs.

`docs/GAP_AUDIT_02_APPEND_ONLY.md` permanently owns `GAP-001` through `GAP-094` and states that future discoveries start at `GAP-095`.

Required behavior:

- a new discovery receives the next `GAP-NNN` ID;
- an issued ID is never reused, even if its visible record is later removed;
- the allocator uses a persistent high-water mark;
- existing higher GAP IDs advance the high-water mark;
- duplicate or legacy non-canonical GAP IDs are reconciled to fresh append-only IDs;
- every new GAP starts RED because it is a newly discovered missing requirement;
- existing status/evidence attached to a migrated legacy GAP is preserved where possible.

## Runtime implementation

`app/components/GapAppendOnlyGuard.tsx` is mounted globally from `app/layout.tsx`.

It reserves `GAP-001`–`GAP-094`, persists the sequence in `enchev-system-gap-seq-v5`, allocates `GAP-095+`, and commits the high-water mark before the new GAP record so a crash/retry may skip an ID but cannot recycle one.

The current legacy `MasterSystemPlanV1` add handler still contains its old timestamp allocator. The guard intercepts the Command Center Add/Enter paths in capture phase before that handler executes, and it also listens to the realtime channel to normalize any legacy/duplicate GAP record that arrives from another path. This isolates the fix without renumbering or rewriting the frozen master task source.

## CI enforcement

`scripts/verify-gap-append-only.mjs` verifies:

1. exactly 94 permanent audit GAP IDs are seeded;
2. `GAP-001`…`GAP-094` are unique and contiguous;
3. the audit contract still declares `GAP-095` as the next discovery;
4. the persistent high-water allocator exists;
5. click and Enter creation paths are intercepted before the legacy timestamp allocator;
6. legacy/duplicate normalization remains active;
7. the guard is mounted globally.

Self-tests prove:

- `GAP-001..094` → next `GAP-095`;
- issued `GAP-095` → next `GAP-096`;
- deleted `GAP-095` with high-water 95 → `GAP-096`, not reuse;
- an existing higher GAP advances the allocator;
- a persisted high-water survives visible-record deletion.

## GREEN evidence

- Implementation commit: `fdd88ba2421ec5774d8cf7140d4c192d36a42873`.
- GitHub Actions workflow `Verify Enchev Web`, run `35214678819`: SUCCESS.
- Append-only GAP invariant: PASS.
- Append-only GAP self-tests: PASS.
- Earlier governance guards: PASS.
- TypeScript check: PASS.
- Production-mode Next.js build: PASS.
- Production verification descendant: `fa9de16de39b09a5075ee2db2205b182900fa380`, proven four commits ahead of and descending from the implementation commit.
- The descendant preserves the `GapAppendOnlyGuard` import and global mount; its layout change removes only `AiWorkerControl`.
- Vercel production deployment: `dpl_41a1wTGhRPiBPPvYo4aAczszLJqx`, state READY.
- Vercel build cloned commit `fa9de16`, compiled successfully, TypeScript completed, and static generation completed `9/9`.
- Canonical production `https://enchev-auctions.vercel.app/`: HTTP `200` during verification.
- Vercel runtime errors: none in the selected verification window.
- The intermediate retrigger commit `93ce695994d6dce66e49f40977eef5c5caace334` only added a verification comment and did not change allocator behavior.
- Supabase was not mutated and is not used as fake evidence for this client-side governance/runtime task.

All 32.07 GREEN gates are satisfied. No pricing/payment/finance scope is added by this task.
