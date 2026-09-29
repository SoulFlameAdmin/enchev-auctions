# SYSTEM 40.01–40.10 — Production failure certification

These ten drills certify failure behavior using deterministic CI simulation. They do not crash live production services or inject faults into real providers.

Coverage:
- 40.01 realtime process crash during an active auction
- 40.02 worker crash during an active auction
- 40.03 worker crash during finalization
- 40.04 Redis connection loss
- 40.05 database connection interruption
- 40.06 object-storage outage
- 40.07 KYC provider outage
- 40.08 notification provider outage
- 40.09 client offline/reconnect during bidding
- 40.10 network partition simulation

Required behavior:
- unsafe bidding fails closed when realtime/cache/database authority is unavailable
- finalization never reports partial success
- cache/provider outages cannot become auction authority
- client/network recovery requires authoritative resynchronization
- recovery rejects authoritative sequence regression
- accepted bid and winner fixtures remain unchanged across these first ten drills

Run `node scripts/verify-production-failure-certification-40-01-10.mjs --self-test`.
