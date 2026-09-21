# SYSTEM 24.12 — WebSocket event contract registry

Task: **24.12 WebSocket event contract registry**

Status: **YELLOW** — contract implementation is present on the task branch; GREEN requires applicable PASS CI, merge/post-merge verification and concrete evidence.

The canonical registry is `config/enchev-websocket-event-registry.json`. It defines a versioned, non-authoritative realtime envelope with event ID, type, source, auction subject, ISO time, per-auction sequence, schema version, correlation ID and data.

Sequence handling is fail-closed: contiguous events may apply, duplicates are ignored, and any sequence gap requires authoritative resynchronization before later incremental events are trusted. WebSocket delivery never determines accepted bids, winners or final results; PostgreSQL remains authoritative.

The registry currently defines snapshot, bid accepted/rejected, auction extended/closed and explicit resync-required contracts. The executable verifier checks registry uniqueness, envelope validation and negative cases for unknown event types, invalid source/subject/time, invalid sequence, schema mismatch and extra fields.
