# SYSTEM 41.20–41.21 — External penetration-test evidence boundary

## 41.20 External penetration test completed

Current status: **YELLOW — external evidence required**.

Internal CodeQL, OWASP ZAP, dependency scans, abuse tests and CI are valuable security controls, but none of them is an independent external penetration test. 41.20 therefore cannot be truthfully promoted by repository automation alone.

The completion contract requires a report from an independent third party with:

- identifiable provider and independence statement;
- report date;
- explicit scope;
- methodology;
- integrity hash / immutable report reference;
- severity summary;
- coverage of web, API, authentication, authorization, auction bidding, realtime/WebSocket, upload-content and SSRF/outbound surfaces.

The repository's internal SAST/DAST results **cannot substitute** for this report.

## 41.21 All Critical/High findings resolved

Current status: **YELLOW — blocked by 41.20**.

After the external report exists, 41.21 requires:

- zero unresolved Critical findings;
- zero unresolved High findings;
- remediation evidence for every Critical/High finding;
- retest evidence for any Critical/High finding that existed in the external report.

If the independent report finds zero Critical/High issues, its signed/immutable report is still required as the source evidence.

## Verification modes

Contract-only verification is safe for CI while the external dependency is pending:

```bash
node scripts/verify-external-pentest-contract-41-20-21.mjs --self-test
```

Once an external report has been supplied and the config is updated, completion can be required explicitly:

```bash
node scripts/verify-external-pentest-contract-41-20-21.mjs --require-41-20-completed
node scripts/verify-external-pentest-contract-41-20-21.mjs --require-41-21-completed
```

Those completion modes intentionally fail while the current external evidence is absent.
