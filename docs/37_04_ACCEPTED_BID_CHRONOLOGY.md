# SYSTEM 37.04 — Accepted bid chronology

This task adds a deterministic, read-only reconstruction of accepted bids for one auction and vehicle.

## Contract

- Authoritative bid event `sequence` is the primary chronology key.
- Bid IDs and event sequences are unique within the supplied auction scope.
- Cross-auction and cross-vehicle records fail closed.
- Rejected bid attempts may exist in the source set but are excluded from the accepted chronology.
- Accepted bid timestamps are canonical UTC ISO-8601 and may not regress as authoritative sequence advances.
- Accepted bid amounts must strictly increase and retain a single currency.
- Every returned item carries immutable provenance through `sourceRef`, optional `correlationId`, original event `sequence`, and a 1-based chronology `ordinal`.

## Evidence

`scripts/verify-accepted-bid-chronology-37-04.mjs --self-test` derives the frozen task identity from the immutable master plan, compiles the domain module, verifies deterministic accepted-only reconstruction, provenance, immutability, and negative rejection cases.
