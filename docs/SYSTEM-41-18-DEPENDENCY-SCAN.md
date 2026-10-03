# SYSTEM 41.18 — Dependency scan clean of Critical/High

The exact pull-request/main lockfile is audited with npm's registry advisory data. The JSON report is archived and parsed by a fail-closed gate.

GREEN requires the exact-head **Dependency Security Scan** workflow to complete successfully with zero High and zero Critical dependency vulnerabilities. Medium/Low findings remain visible in the archived evidence but do not satisfy the blocking threshold for this frozen task.
