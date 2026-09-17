# ENCHEV AUCTIONS — GAP AUDIT 02 (APPEND-ONLY)

Date: 2026-09-17
Status: Added after `MASTER SYSTEM PLAN v1.0 FROZEN`

These items do **not** renumber or redefine the frozen baseline. They are append-only discoveries with permanent IDs `GAP-001` … `GAP-094` and are seeded into the existing Command Center GAP store.

## Why this audit exists

The frozen plan already covers the primary architecture, auction engine, realtime, security, recovery, internationalization, testing and production certification layers. This second audit targeted edge cases that often remain hidden until real production operation:

- auction fairness at exact close boundaries and ambiguous network outcomes;
- Buy Now concurrency and race behavior;
- safe deployment while live auctions are running;
- resource isolation so search/AI/media cannot starve bidding/finalization;
- object-storage recovery, timezone-database lifecycle and restore/privacy edge cases;
- identity/eligibility expiry and re-verification;
- vehicle-history provenance, EV/high-voltage safety and physical exceptions after auction;
- security vulnerability disclosure and third-party browser JavaScript governance;
- AI lifecycle governance;
- conditional EU Consumer Rights / DSA / GPSR / P2B / NIS2 applicability gates.

## Gap groups

- `GAP-001`–`GAP-010` — Security disclosure, browser third-party code and security logging
- `GAP-011`–`GAP-020` — AI governance, AI security and EU AI applicability
- `GAP-021`–`GAP-038` — Authoritative bid receipts, close-boundary fairness and outage fairness
- `GAP-039`–`GAP-044` — Atomic Buy Now correctness
- `GAP-045`–`GAP-056` — Pre-auction readiness, safe deploy, realtime draining, bulkheads and overload
- `GAP-057`–`GAP-066` — tzdb lifecycle, object recovery, backup isolation, webhook replay and test-data isolation
- `GAP-067`–`GAP-074` — Identity/eligibility lifecycle and privileged support access
- `GAP-075`–`GAP-086` — Vehicle identity/history, odometer provenance, Run & Drive, EV safety and physical exceptions
- `GAP-087`–`GAP-094` — EU online-auction / marketplace applicability and country sign-off evidence

## Research anchors used for this audit

Primary/authoritative references reviewed included:

- RFC 9116 — `security.txt` vulnerability disclosure mechanism.
- OWASP WebSocket Security Cheat Sheet — Origin validation, abuse resistance and security logging.
- OWASP Third Party JavaScript Management Cheat Sheet — supply-chain and data-leak risks from browser scripts.
- IANA Time Zone Database — current timezone-rule updates, showing why future auction schedules need tzdb lifecycle management.
- EU Consumer Rights Directive 2011/83/EU — online auction platforms are not automatically treated as `public auctions`; country/legal applicability must be assessed.
- Digital Services Act (EU) 2022/2065, Articles 30–32 — trader traceability, compliance-by-design and illegal-product consumer information for applicable marketplaces.
- General Product Safety Regulation (EU) 2023/988, Article 22 — specific online marketplace product-safety duties where applicable.
- Platform-to-Business Regulation (EU) 2019/1150 — ranking transparency and restriction/suspension/termination redress where applicable.
- NIS2 Directive (EU) 2022/2555 and Implementing Regulation (EU) 2024/2690 — applicability and cybersecurity incident requirements for covered online marketplaces.
- EU AI Act (EU) 2024/1689 — transparency/applicability review for AI features.
- NHTSA EV / HEV safety and emergency-response guidance — high-voltage, flood, towing and storage hazards.
- NHTSA VIN recall resources — recall provenance/freshness concepts.

## Governance rule

A GAP becomes GREEN only with real implementation and evidence. If a requirement is legally conditional, GREEN requires a documented applicability decision and, when applicable, the implemented control plus proof.

No future audit may recycle these IDs. New discoveries start at `GAP-095`.
