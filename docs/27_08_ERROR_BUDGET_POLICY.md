# SYSTEM 27.08 — Error-budget policy

Status: **YELLOW** until exact-head CI and post-merge descendant verification pass.

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

Therefore their error-budget allowance is known (1% non-compliant samples), but their actual budget consumption is **not evaluable until SYSTEM 27.09 defines the authoritative latency budgets**.

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

## Acceptance

GREEN requires the executable fail-closed verifier and negative self-tests to pass on the exact implementation head, merge to `main`, and post-merge descendant verification. SYSTEM 27.08 does not claim live production burn data.
