# SYSTEM 27.09 — Latency/timeout budgets

Status: **GREEN** — the engineering-budget policy, fail-closed verifier, exact-head CI, merge, and post-merge descendant verification are complete.

## Purpose

Define the first numeric latency thresholds and attempt timeout ceilings required by the already-GREEN 27.03–27.08 SLI/SLO/error-budget contracts.

These values are **initial provisional engineering budgets**, not measured production performance. They must be reviewed after representative production evidence exists.

## Latency budgets

| SLI | Compliance target | Initial threshold |
| --- | ---: | ---: |
| Bid acceptance latency | 99% | <= 750 ms |
| Realtime delivery latency | 99% | <= 250 ms |

The compliance ratios come from SYSTEM 27.07. SYSTEM 27.09 owns only the numeric thresholds.

Both measurements continue to use the exact sample populations and monotonic server-side clocks defined by their source SLIs. This task does not widen exclusions, change start/end events or use browser/client clocks.

## Timeout budgets

| Attempt | Initial timeout |
| --- | ---: |
| Authoritative bid acceptance attempt | 3,000 ms |
| Realtime delivery attempt | 1,000 ms |
| Reconnect recovery to authoritative baseline | 10,000 ms |
| Auction finalization attempt | 30,000 ms |

A timeout is a terminal deadline for that attempt. It does **not** define how many retries are allowed; retry budgets remain owned by SYSTEM 27.10.

A bid timeout cannot be converted into an accepted-bid latency sample. A realtime timeout cannot be converted into a successful delivery sample. Reconnect still requires an authoritative baseline, and finalization still requires a durable authoritative PostgreSQL commit.

## Error-budget integration

SYSTEM 27.08 already reserves a 1% allowed-bad fraction for each 99% latency SLO. With 27.09 thresholds defined, latency compliance/error-budget consumption becomes evaluable whenever enough eligible samples exist.

Insufficient eligible data remains `not_evaluable`; zero traffic does not imply compliance.

## Ownership boundaries

SYSTEM 27.09 does not define retry counts, retry backoff, capacity limits, degradation rules or load-shedding thresholds.

- retry budgets: SYSTEM 27.10;
- capacity model: SYSTEM 27.11;
- graceful degradation: SYSTEM 27.12;
- load shedding: SYSTEM 27.13.

## Authority

PostgreSQL remains authoritative for auction state, accepted bids, winner selection and final results. Timeout/latency telemetry is observational only. A timeout may never create an accepted bid, choose a winner or mutate authoritative auction state.

## Review rule

The budgets may be tightened or relaxed only with representative operational evidence and explicit approval. Changing a budget must not rewrite the underlying 27.03–27.06 SLI semantics merely to improve compliance.

## GREEN evidence

- Implementation exact-head commit: `a880324e01d5b1148b99a5c5169ee1745ab529ba`.
- Implementation PR #255 merged to `main` as `109ae55079a993eea84deb797077e4167c316e86`.
- Exact-head Verify Enchev Web run `36044807882`: SUCCESS; aggregate CI test suite (including 27.09 verifier/self-test), TypeScript, production build, built health smoke, Chrome/Edge visual regression and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36044808047`, Secret Scan `36044807819`, SBOM Generation `36044807974`, Build Provenance `36044807967`, SYSTEM 26.05 `36044807876`, SYSTEM 24.02 `36044807928`.
- Exact-head Vercel Preview `dpl_9436bmHbACEu4WaxuAS4N4rhMMAM` for commit `a880324e01d5b1148b99a5c5169ee1745ab529ba`: READY.
- This evidence branch is based directly on merged `main` commit `109ae55079a993eea84deb797077e4167c316e86`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- Latency thresholds are initial engineering policy values, not measured production results.
- Retry budgets remain owned by SYSTEM 27.10; capacity remains owned by SYSTEM 27.11.
- PostgreSQL remains authoritative; timeouts cannot create accepted bids, winners or authoritative success.
- Protected DAVID orchestrator files were not modified.
