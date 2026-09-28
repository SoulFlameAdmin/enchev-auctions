# SYSTEM 37.01 — Vehicle activity timeline

Frozen task: **37.01 Vehicle activity timeline**.

## Contract

The vehicle activity timeline is a deterministic projection over authoritative event records. It does not invent history and it is not itself an auction authority.

Each timeline event carries an immutable event ID, vehicle scope, optional auction scope, canonical UTC timestamp, deterministic sequence, source reference, optional correlation ID, visibility class and human-readable summary.

The projection:

- rejects cross-vehicle records;
- rejects duplicate event IDs;
- rejects invalid or non-canonical UTC timestamps;
- rejects invalid sequence values;
- preserves stable chronological ordering using timestamp → sequence → event ID;
- filters visibility for public, participant and admin audiences;
- returns frozen read-only timeline data.

Later Phase 37 tasks may add richer reconstruction sources, but they must feed this chronology with authoritative records rather than bypassing these invariants.

## Verification

`scripts/verify-vehicle-activity-timeline-37-01.mjs` compiles and executes the domain contract, validates frozen task identity, deterministic ordering, visibility filtering, immutability and negative cases.
