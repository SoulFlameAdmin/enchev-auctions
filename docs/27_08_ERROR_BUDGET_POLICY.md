# SYSTEM 27.08 — Error-budget policy

Status: **GREEN** — the policy contract, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define how the initial SLO targets from SYSTEM 27.07 translate into error budgets and how remaining budget constrains operational change risk.

This is a **policy contract**, not a claim about measured production performance.

## Error-budget definition

For each SLO:

- allowed bad fraction = `1 - SLO target ratio`;
- consumed budget fraction = `observed bad fraction / allowed bad fraction`;
- remaining budget fraction = `max(0, 1 - consumed budget fraction)`.

Budgets are evaluated over the same rolling 30-day window owned by SYSTEM 27.07.

The policy uses eligible events/samples. It does **not** invent absolute downtime minutes because the current SLIs are ratio/sample based and traffic volume is not fixed.

## Independent budgets

Each SLO owns its own error budget. Budget may not be transferred between SLOs.

A healthy low-risk journey cannot compensate for an exhausted bid, auction-finalization or API budget.

Manual resets, target relaxation, or widening exclusions solely to make a budget look healthy are forbidden.

## Budget states

- **healthy** — more than 50% budget remains: normal change policy.
- **watch** — 25–50% remains: explicit risk review and increased reliability attention.
- **restricted** — more than 0% but at most 25% remains: pause non-essential high-risk changes and prioritize reliability work.
- **exhausted** — 0% remains: freeze non-essential risk-increasing production changes.
- **not_evaluable** — insufficient eligible data: no compliance claim; use manual risk control.

## Latency SLO boundary

SYSTEM 27.07 defines a 99% compliance target for bid-acceptance latency and realtime-delivery latency, but numeric latency thresholds belong to SYSTEM 27.09.

Therefore their error-budget allowance is known (1% non-compliant samples), but actual budget consumption is **not evaluable until SYSTEM 27.09 defines the authoritative latency budgets**.

SYSTEM 27.08 must not invent milliseconds or timeout values.

## Exhausted-budget exceptions

Budget exhaustion does not block:

- security fixes;
- incident mitigation;
- explicitly approved emergency changes.

Emergency changes require explicit approval and a rollback plan. Error-budget policy never authorizes unsafe rollback, destructive data mutation, or bypass of production safeguards.

## Recovery

A budget may recover naturally as the rolling window advances or after an authoritative telemetry correction.

Manual budget reset is forbidden. Changing a target requires separate evidence and approval. Rewriting SLI semantics only to restore budget is forbidden.

## Authority

PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results. SLO/error-budget telemetry is observational only.

## GREEN evidence

- Implementation exact-head commit: `2c3754570b6edd6ca11e474f8d2b64b7d384e2fa`.
- Implementation PR #252 merged to `main` as `3c54537939381a347526ba953032deee4755215b`.
- Exact-head Verify Enchev Web run `36034346594`: SUCCESS; aggregate CI test suite (including 27.08 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36034346802`, Secret Scan `36034346623`, SBOM Generation `36034346837`, Build Provenance `36034346762`, SYSTEM 26.05 `36034346667`, SYSTEM 24.02 `36034346890`.
- Exact-head Vercel Preview `dpl_284sQzFZhvNxy7CVBrk7nHKkg1e6` for commit `2c3754570b6edd6ca11e474f8d2b64b7d384e2fa`: READY.
- This evidence branch is based directly on merged `main` commit `3c54537939381a347526ba953032deee4755215b`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Error budgets are derived directly from 27.07 targets using `1 - target`; no separate arbitrary allowance is invented.
- Latency error-budget consumption remains `not_evaluable_until_27.09` because numeric latency/timeout thresholds are owned by SYSTEM 27.09.
- No downtime minutes, retry budgets, capacity limits, or measured production performance are invented.
- PostgreSQL remains authoritative and error-budget telemetry remains observational only.
- Protected DAVID orchestrator files were not modified.
