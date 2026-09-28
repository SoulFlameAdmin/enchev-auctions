# SYSTEM 37.02 — Auction rules snapshot visible after close

Frozen task: **37.02 Auction rules snapshot visible after close**.

## Contract

The trust record exposes the exact versioned auction-rules snapshot only after the auction has reached a post-close state.

The snapshot envelope contains:

- stable snapshot ID;
- auction ID;
- rules version;
- canonical UTC capture time;
- authoritative source reference;
- JSON-safe rule payload.

This task does **not** invent auction, pricing, reserve, legal or country policy. The rule payload is supplied by the authoritative/versioned auction configuration path established elsewhere in the system.

Before close (`draft`, `published`, `live`) the public trust-record projection returns no rules snapshot. After close (`closed`, `sold`, `unsold`, `void`, `seller-approval-pending`) the exact snapshot becomes visible only when a canonical `closedAt` exists and the snapshot was captured no later than close.

The returned structure is deeply read-only so UI/reconstruction code cannot mutate the historical rule record.

## Verification

`scripts/verify-auction-rules-snapshot-37-02.mjs` verifies frozen task identity, pre-close non-disclosure, all supported post-close states, provenance preservation, deep immutability, canonical chronology and negative cases.
