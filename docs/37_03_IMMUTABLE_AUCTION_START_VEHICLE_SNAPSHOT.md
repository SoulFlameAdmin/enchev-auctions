# SYSTEM 37.03 — Immutable auction-start vehicle snapshot

Frozen task: **37.03 Immutable auction-start vehicle snapshot**.

## Contract

The trust record captures the authoritative vehicle payload exactly at `auctionStartedAt` and preserves that historical state independently of later listing or vehicle edits.

The snapshot contains:

- stable snapshot ID;
- auction ID;
- vehicle ID;
- authoritative source revision;
- authoritative source reference;
- canonical UTC auction-start timestamp;
- canonical UTC capture timestamp;
- JSON-safe vehicle payload.

The capture time must equal the auction start time exactly. The supplied vehicle payload is deep-cloned and deeply frozen, so later mutation of the source object cannot rewrite history.

This task deliberately does not invent or hardcode vehicle schema fields. The authoritative vehicle/listing path supplies the payload and revision; the trust-record layer guarantees immutability and provenance.

## Verification

`scripts/verify-auction-start-vehicle-snapshot-37-03.mjs` verifies frozen task identity, exact-start capture, provenance preservation, deep immutability, source-mutation isolation and negative cases.
