# Enchev Auctions — 32.07 New discoveries use append-only GAP IDs

Status: YELLOW — runtime allocator/guard and CI enforcement implemented; verification pending
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

## GREEN gate

Because this task changes Command Center runtime behavior, GREEN requires:

- append-only GAP invariant PASS;
- append-only GAP self-tests PASS;
- all earlier governance guards PASS;
- TypeScript PASS;
- production build PASS;
- a Vercel READY deployment containing this implementation (exact commit or proven descendant);
- production HTTP/runtime verification with no relevant error;
- exact evidence recorded before GREEN.

No pricing/payment/finance scope is added by this task.
