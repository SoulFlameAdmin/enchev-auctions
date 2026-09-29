# SYSTEM 40.11–40.15 — Production failure certification

These five drills extend the deterministic Phase 40 failure-certification harness. They do not mutate production systems.

- 40.11 duplicate event delivery must apply the event once and idempotently ignore the duplicate.
- 40.12 out-of-order delivery must not apply an event across a missing sequence; bidding pauses and authoritative resync is required.
- 40.13 sequence-gap recovery must recover from an authoritative snapshot, never by inventing missing events.
- 40.14 stale-cache recovery must discard stale cache state and rebuild it from an authoritative snapshot before bidding resumes.
- 40.15 clock-skew simulation must prove that client/browser time never decides bid validity; authoritative server time decides.

Across all five drills, accepted-bid history and winner fixtures remain unchanged.

Run `node scripts/verify-production-failure-certification-40-11-15.mjs --self-test`.
