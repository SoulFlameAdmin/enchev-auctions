# SYSTEM 41.02–41.06 — Security and abuse certification

This block implements deterministic security controls and abuse tests for API authorization and authentication boundaries.

Baseline:
- OWASP API Security Top 10 — 2023 edition
- API1 Broken Object Level Authorization
- API2 Broken Authentication
- API5 Broken Function Level Authorization
- the remaining API Top 10 risks are mapped to existing or future frozen controls without claiming full OWASP certification

Coverage:
- 41.02 OWASP API Security Top 10 mapping
- 41.03 object-level authorization abuse test
- 41.04 function-level authorization abuse test
- 41.05 authentication brute-force test
- 41.06 session fixation/revocation test

Security behavior:
- protected object access defaults to deny and requires explicit owner/assignment/organization scope
- unknown or unauthorized capabilities fail closed
- repeated authentication failures trigger temporary lockout and successful authentication clears the failure budget
- authentication rotates the pre-authentication session identifier
- pre-authentication, revoked, unknown and wrong-subject sessions are rejected

The OWASP mapping is a control map, not a claim that Enchev is fully OWASP-certified.

Run `node scripts/verify-security-abuse-certification-41-02-06.mjs --self-test`.
