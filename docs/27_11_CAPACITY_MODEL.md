# SYSTEM 27.11 — Capacity model

Status: **GREEN** — capacity-model contract, fail-closed verification, exact-head CI, merge, READY preview, and post-merge descendant verification are complete.

## Purpose

Define the capacity dimensions, formulas, headroom semantics, and certification rules that Enchev Auctions will use to reason about load safely.

This task defines a **capacity model**, not a claim that production currently sustains any particular traffic level. Concrete production limits remain **uncertified** until representative load evidence exists.

## Capacity dimensions

The model tracks capacity independently for:

- authoritative bid commands per second;
- realtime deliveries per second;
- concurrent authenticated realtime connections;
- reconnect recoveries per second;
- auction finalizations per minute;
- concurrent live auctions.

Each dimension has its own validated-capacity value. Capacity from one dimension may not be substituted for another.

## Derived demand

For a certified dimension:

`utilization = observed_demand / validated_capacity`

`headroom = 1 - utilization`

Realtime fanout demand is modeled from room-level event rate and active subscribers:

`realtime_fanout_demand = sum(event_rate_per_room * active_subscribers_per_room)`

Missing validated capacity means the dimension is **uncertified**. Division by zero, negative demand, and cross-dimension capacity substitution are forbidden.

## Initial planning thresholds

These are provisional engineering planning signals, not measured production results:

| Signal | Utilization |
| --- | ---: |
| Scale review | 60% |
| Capacity watch | 70% |
| Capacity critical | 85% |

The target planning headroom floor is 30%.

These thresholds do **not** authorize dropping traffic or disabling features. Graceful degradation belongs to SYSTEM 27.12, load shedding to SYSTEM 27.13, and the scaling runbook to SYSTEM 27.14.

## Certification

A concrete capacity value may become certified only after representative load evidence exists and all relevant reliability invariants remain satisfied.

Certification requires:

- representative load evidence for the exact dimension;
- relevant SLO behavior remains within the policy defined by SYSTEM 27.07;
- error-budget semantics from SYSTEM 27.08 remain intact;
- latency/timeout semantics from SYSTEM 27.09 remain intact;
- retry semantics from SYSTEM 27.10 remain intact;
- PostgreSQL authority is preserved;
- no accepted-bid or winner corruption occurs under load.

The load/concurrency test family is owned by Phase 18. SYSTEM 27.11 consumes that evidence; it does not invent it.

## Authority

PostgreSQL remains authoritative for accepted bids, auction state, winner selection, and final results.

Capacity telemetry and this model are advisory engineering inputs. They may not manufacture an accepted bid, choose a winner, or rewrite authoritative auction state.

## Review rule

Capacity values and thresholds may change only with evidence and explicit approval. A temporary incident, provider limit, or billing constraint must not be silently rewritten into a certified platform capacity.

## Ownership boundaries

SYSTEM 27.11 owns capacity dimensions, utilization/headroom formulas, and certification semantics only.

- graceful degradation: SYSTEM 27.12;
- load shedding: SYSTEM 27.13;
- scaling runbook: SYSTEM 27.14.

## GREEN evidence

- Implementation exact-head commit: `b0e5c875b30ca3f7290b0dd32de49f89ac968da0`.
- Implementation PR #259 merged to `main` as `bd6c54de3c235a50d44fb2289d48c47f40c5ad4d`.
- Exact-head Verify Enchev Web run `36108334640`: SUCCESS; SYSTEM pre-gates including the 27.11 fail-closed verifier/self-tests, aggregate CI suite, TypeScript, production build, built health smoke, Chrome/Edge visual regression, and artifact upload all PASS.
- Exact-head security/supply-chain checks PASS: Code Scan `36108334504`, Secret Scan `36108334603`, SBOM Generation `36108334511`, Build Provenance `36108334594`, SYSTEM 26.05 `36108334852`, SYSTEM 24.02 `36108334583`.
- Exact-head Vercel Preview `dpl_CCq51LXubDWVGQKyt21z5pUyt1e5` for commit `b0e5c875b30ca3f7290b0dd32de49f89ac968da0`: READY; root route returned HTTP 200.
- This evidence branch is based directly on merged `main` commit `bd6c54de3c235a50d44fb2289d48c47f40c5ad4d`; its exact-head CI provides the required post-merge descendant verification before evidence merge.
- All concrete production capacity values remain `uncertified`; 27.11 does not claim measured production throughput.
- The provisional planning signals remain engineering policy values: 30% target headroom, 60% scale-review utilization, 70% capacity-watch utilization, and 85% capacity-critical utilization.
- Graceful degradation remains owned by SYSTEM 27.12, load shedding by 27.13, and scaling runbook by 27.14.
- PostgreSQL remains authoritative; capacity telemetry cannot manufacture accepted bids, winners, or final auction state.
- Protected DAVID orchestrator files were not modified.
