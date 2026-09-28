# SYSTEM 37.03 — Vehicle snapshot visible after close

Frozen task: **37.03 Vehicle snapshot visible after close**.

The trust-record layer accepts an authoritative, revisioned vehicle snapshot and withholds it while the auction is draft, published, or live. Once the auction reaches a post-close state, the snapshot becomes visible with its original vehicle ID, auction ID, source revision, source reference, capture timestamp, and JSON-safe vehicle payload.

The layer does not invent vehicle fields or legal/business data. It deep-clones and freezes the supplied authoritative payload so later source edits cannot rewrite historical reconstruction. A snapshot captured after the auction close is rejected.

Verification: `scripts/verify-vehicle-snapshot-37-03.mjs` checks frozen task identity, pre-close non-disclosure, post-close visibility, provenance, chronology, deep immutability, source-mutation isolation, and negative cases.
