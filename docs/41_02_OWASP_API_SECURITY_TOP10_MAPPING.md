# SYSTEM 41.02 — OWASP API Security Top 10 mapping

Enchev Auctions maps its API security-control coverage to the **OWASP API Security Top 10 — 2023 edition**, the current API Security Project edition published by OWASP.

This artifact is intentionally conservative about its claim:
- GREEN for 41.02 means all ten 2023 API risks are explicitly mapped to concrete Enchev frozen-plan controls and future Phase 41 abuse tests.
- It does **not** mean every mapped control already passes.
- It does **not** claim external certification or penetration-test completion.
- The remaining Phase 41 security tasks still provide the concrete runtime abuse evidence.
- A future OWASP API Security Top 10 edition requires an explicit remap; the version is not silently advanced.

Machine-readable mapping: `config/enchev-owasp-api-top10-41-02.json`

Official reference: https://api-security.owasp.org/editions/2023/en/0x11-t10/

Run `node scripts/verify-owasp-api-top10-mapping-41-02.mjs --self-test`.
