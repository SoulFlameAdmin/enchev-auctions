# SYSTEM 24.12 — WebSocket event contract registry

Task: **24.12 WebSocket event contract registry**

Status: **YELLOW** — contract implementation is present on the task branch; GREEN requires applicable PASS CI, merge/post-merge verification and concrete evidence.

The canonical registry is `config/enchev-websocket-event-registry.json`. It defines a versioned, non-authoritative realtime envelope with event ID, type, source, auction subject, ISO time, per-auction sequence, schema version, correlation ID and data.

Sequence handling is fail-closed: contiguous events may apply, duplicates are ignored, and any sequence gap requires authoritative resynchronization before later incremental events are trusted. WebSocket delivery never determines accepted bids, winners or final results; PostgreSQL remains authoritative.

The registry currently defines snapshot, bid accepted/rejected, auction extended/closed and explicit resync-required contracts. The executable verifier checks registry uniqueness, envelope validation and negative cases for unknown event types, invalid source/subject/time, invalid sequence, schema mismatch and extra fields.


## GREEN evidence

- Implementation merged to `main` as `dd76ee358531d060048df70cf41e205bce870f9b` from PR #194.
- Exact-head implementation commit before merge: `52f212cbc58146f3919fc17028ac13c80c05655c`.
- Pre-merge dedicated SYSTEM 24.13 workflow run `35667866119`: SUCCESS.
- Post-merge SYSTEM 24.13 workflow run `35668127618`: SUCCESS; invariant and negative self-tests both PASS.
- Post-merge Verify Enchev Web run `35668127593`: CI test suite PASS, TypeScript PASS, production build PASS, built health smoke test PASS on the merged main commit.
- Pre-merge security/supply-chain checks on the exact implementation head: Secret Scan, Code Scan, SBOM Generation and Build Provenance PASS.
- Protected DAVID orchestrator files were not changed by PR #194.
- No manual Vercel deployment was required for this repository contract/test-only block.
