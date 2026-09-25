# SYSTEM 27.11 — Capacity model

Status: **YELLOW** until fail-closed verification, exact-head CI, merge, and post-merge descendant verification pass.

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

## Acceptance

GREEN requires:

1. fail-closed config verifier and negative self-tests;
2. package scripts and SYSTEM pre-gate wiring;
3. exact-head CI/security/build checks;
4. READY exact-head Vercel preview;
5. merge to `main`;
6. post-merge descendant verification;
7. GREEN evidence recorded here.

Until those conditions pass, status remains YELLOW.
