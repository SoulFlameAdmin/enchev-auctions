# SYSTEM 41.01 — OWASP ASVS control mapping

Enchev Auctions maps its security-control families to **OWASP ASVS 5.0.0**. OWASP describes ASVS as a basis for testing web-application technical security controls, and its current 5.0 taxonomy contains 17 chapters.

This artifact is deliberately fail-closed about its claim:
- GREEN for 41.01 means the ASVS 5.0.0 control-family mapping exists, is version-pinned, covers every ASVS chapter, and is CI-verified against the frozen Enchev plan.
- It does **not** mean every individual ASVS requirement already passes.
- It does **not** claim an external ASVS certification or penetration-test completion.
- Individual Phase 41 tasks remain responsible for the concrete abuse/security certifications that follow.

The machine-readable mapping is in `config/enchev-owasp-asvs-41-01.json`.

Official reference: https://owasp.org/projects/asvs

Run `node scripts/verify-owasp-asvs-mapping-41-01.mjs --self-test`.
