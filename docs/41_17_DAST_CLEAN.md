# SYSTEM 41.17 — DAST clean of Critical/High

41.17 adds a real dynamic application security test using OWASP ZAP against an **isolated local CI instance** of Enchev Auctions.

## Safety boundary

OWASP ZAP Full Scan performs an active scan and can submit forms / send attack payloads. The workflow therefore **must not target production, Vercel Preview, staging owned by another party, or any external hostname**.

The exact PR source is built in GitHub Actions, started locally on `0.0.0.0:3000`, health-checked, and then scanned through the Docker host bridge. No production secrets are injected into that application process.

## Scan flow

1. Checkout exact PR/main source.
2. Install dependencies with Node 24 and build the app.
3. Start the built application locally.
4. Require `/api/health/web` to answer before scanning.
5. Run the OWASP ZAP 2.17.0 Full Scan image against the local Docker-host address.
6. Produce both JSON and HTML reports.
7. Parse the real JSON report with `verify-dast-clean-41-17.mjs`.
8. Fail closed when an alert has ZAP risk code `>= 3` (High), or when an alert has no valid risk classification.
9. Archive the scan reports and application log even when the severity gate fails.
10. Require the exact task head's **DAST Scan** workflow to conclude `success` before GREEN.

ZAP has High/Medium/Low/Informational risk levels rather than a separate Critical category, so the 41.17 Critical/High requirement is represented by blocking the highest ZAP risk class (risk code 3) and any unclassified alert.

## Scope boundary

This task certifies the unauthenticated surface reachable from a local clean build. It does **not** claim authenticated DAST, production DAST, third-party infrastructure testing, or an external penetration test. Those claims require separate evidence.

Run:

```bash
node scripts/verify-dast-clean-41-17.mjs --self-test
node scripts/verify-dast-clean-41-17.mjs --report artifacts/zap/zap-report.json
```
