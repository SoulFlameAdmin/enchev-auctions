# SYSTEM 37.05–37.15 — Auction reconstruction completion

This closes the remaining frozen Phase 37 trust-record tasks on top of the already merged 37.01–37.04 foundation.

## Contracts

- **37.05 Extension-event chronology** validates auction/vehicle scope, unique IDs/sequences, UTC timestamps, monotonic deadlines and real end-time extension.
- **37.06 Final-result chronology** preserves provisional/approval/final transitions and rejects any record after a terminal sold/unsold/void result.
- **37.07 Seller listing-change chronology** preserves immutable before/after values, exact listing scope and contiguous revisions.
- **37.08 Inspection-version chronology** preserves report versions, provenance and SHA-256 payload fingerprints with contiguous versions.
- **37.09 Q&A history preserved** retains published and hidden questions plus their replies; orphan replies and time regressions fail closed.
- **37.10 Admin exceptional-action chronology** records actor, reason, before/after state, source and correlation provenance.
- **37.11 Internal immutable audit export** canonicalizes all reconstruction entries, freezes the export and produces a deterministic SHA-256 digest.
- **37.12 Dispute evidence bundle** binds rules snapshot, vehicle snapshot, accepted bids and every remaining chronology to the audit digest.
- **37.13 Correlation IDs in reconstruction** indexes correlations and requires them for accepted bids, extensions, final results and admin exceptions.
- **37.14 Tamper-evident critical-event hash chain** hashes each critical event and rolls the previous chain hash into the next SHA-256 link.
- **37.15 Complete auction reconstruction test** proves one complete closed-auction reconstruction across the 37.01–37.14 data model.

## Boundary

The reconstruction layer does not invent auction events or replace authoritative storage. It validates and composes provenance-bearing records supplied by authoritative system paths. Missing critical provenance, cross-scope records, chronology regressions and tampering indicators fail closed.

## Verification

Run:

`node scripts/verify-auction-reconstruction-37-05-15.mjs --self-test`

The verifier derives all eleven task identities from the immutable master plan, compiles the TypeScript domain, executes a complete reconstruction, checks deterministic SHA-256 output and performs negative failure tests.
