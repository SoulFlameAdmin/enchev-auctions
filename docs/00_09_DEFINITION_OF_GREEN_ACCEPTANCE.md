# Enchev Auctions — 00.09 Definition of GREEN Acceptance

Status: GREEN — acceptance contract implemented and verified
MASTER SYSTEM PLAN v1.0 FROZEN task: `00.09`
Execution wave: `WAVE 0 — Definition & governance`
Depends on: `00.01`–`00.08`

This document defines what **GREEN** means for every task in MASTER SYSTEM PLAN v1.0 FROZEN. It is the common acceptance contract for the Command Center, implementation work, testing, security, operations and later final acceptance.

This task does not add pricing, payment or finance scope.

## 1. Status semantics

### RED

RED means the required capability/artifact is missing, not started, or known to violate the task requirement.

### YELLOW

YELLOW means one or more of the following:

- implementation is partial;
- implementation exists but verification is pending;
- a test failed;
- evidence is incomplete, stale, ambiguous or for the wrong environment;
- a dependency/blocker prevents completion;
- the implementation is present only in a branch/preview and the task requires stronger proof;
- infrastructure prevented verification, but no code failure has been proven.

YELLOW must not be presented as production-ready.

### GREEN

GREEN means the task statement has been implemented to its defined scope **and** the applicable verification evidence proves it.

GREEN is not a visual/manual label. It is an evidence-backed conclusion.

## 2. Universal GREEN gate

A task may be GREEN only when all applicable conditions are true:

1. **Scope satisfied** — the actual task requirement is implemented, not merely discussed.
2. **Dependencies satisfied** — required predecessor tasks are GREEN or the FROZEN plan explicitly permits independent execution.
3. **No unresolved blocker** — no known blocker contradicts completion.
4. **Concrete evidence exists** — evidence identifies the implementation and verification artifacts.
5. **Correct environment** — proof comes from the environment relevant to the claim.
6. **Applicable tests pass** — code, schema, security, load, recovery or other tests required by the task pass.
7. **No contradictory evidence** — a known failing test/security finding/unfinished migration that invalidates the task keeps it YELLOW/RED.
8. **Traceability exists** — commit SHA, migration, deployment, run ID, report, provider record or equivalent can be traced.
9. **Regression boundary is respected** — a later change that invalidates the proof can revoke GREEN.
10. **Evidence is recorded** — the task/Command Center can point to the proof instead of relying on memory.

## 3. Evidence hierarchy

Evidence strength depends on the task. Valid evidence can include:

- immutable Git commit SHA;
- GitHub Actions/CI run and job IDs;
- Vercel deployment ID/URL and exact commit metadata;
- build/typecheck/test logs;
- Supabase migration/version/schema inspection;
- database query proving a property;
- automated integration/e2e test report;
- concurrency/load/chaos test report;
- security scan/penetration-test report;
- backup/restore/failover drill record;
- telemetry/alert/log evidence;
- authenticated provider sandbox/production verification;
- legal/compliance approval record when explicitly required by the owning task.

The evidence must prove the task, not merely be related to it.

## 4. What is never sufficient by itself

The following cannot independently make a task GREEN:

- file existence;
- localStorage state;
- BroadcastChannel state;
- a green badge/color in the UI;
- an assistant statement that something is complete;
- a plan or architecture document for a runtime capability;
- a successful unrelated deployment;
- a test against an older commit that does not contain the implementation;
- screenshots without traceable underlying state where machine evidence is required;
- `public.enchev_development_events` rows that refer to a different commit/test;
- a browser countdown/demo bid animation for authoritative auction correctness.

## 5. Descendant evidence rule

Verification may use a descendant commit when all of the following are proven:

1. Git history proves the verification commit descends from the implementation commit;
2. the descendant still contains the implementation;
3. no intervening change invalidates the tested property;
4. the verification environment/test actually exercised the relevant repository state;
5. exact implementation and verification SHAs are recorded.

A later successful commit on an unrelated/diverged history is not evidence.

## 6. Documentation/governance GREEN rule

For Phase 00-style governance/documentation tasks, GREEN requires:

- the required contract/document is complete and internally consistent with the FROZEN plan;
- it does not claim runtime capability that has not been built;
- a proven commit/descendant passes repository TypeScript + production-mode build regression checks when the document lives in the application repository;
- the currently deployed application remains reachable and has no relevant runtime regression;
- evidence is recorded.

An exact Vercel build is preferred when available. If Vercel is independently rate-limited and the change is documentation-only, an independent CI production `next build` plus Vercel HTTP/runtime-health proof is valid **only** when the evidence explicitly states that Vercel did not build that exact commit. Runtime-feature tasks do not inherit this exception.

## 7. Application/runtime GREEN rule

A runtime application feature requires, where applicable:

- implementation commit;
- TypeScript/lint/build PASS;
- relevant unit/integration/e2e PASS;
- deployment containing the implementation;
- HTTP/runtime verification of the deployed behavior;
- no known blocking runtime error.

A successful local or CI build alone does not prove a deployed runtime feature.

## 8. Authoritative auction-core GREEN rule

Winner-affecting tasks require stronger evidence. GREEN requires proof of the relevant invariants, including where applicable:

- authoritative PostgreSQL-backed state;
- atomic bid acceptance;
- server-side eligibility/rule validation;
- deterministic durable ordering;
- private max/proxy bid handling;
- server-time deadline behavior;
- idempotent ambiguous-outcome retry;
- concurrent-bid tests;
- finalizer retry/exactly-once logical result;
- stale-writer/split-brain protection;
- audit/reconstruction evidence.

UI behavior, WebSocket messages or cache state can never substitute for this proof.

## 9. Database/schema GREEN rule

A database task requires the applicable combination of:

- migration committed/versioned;
- migration applied to the intended environment;
- resulting schema/functions/policies inspected;
- RLS/authorization verified where applicable;
- representative positive and negative queries/tests;
- rollback/forward-fix strategy when the change is risky;
- no unrelated shared-project mutation used as fake completion.

Schema text in a document without an applied/tested migration remains YELLOW for implementation tasks.

## 10. Security/privacy GREEN rule

Security/privacy tasks require evidence proportional to risk, such as:

- server-side authorization tests;
- RLS/policy tests;
- secret exposure checks;
- dependency/security scans;
- abuse/rate-limit tests;
- audit evidence;
- penetration testing for tasks that explicitly require it.

A known critical/high finding that directly invalidates the task prevents GREEN until remediated or formally handled by the owning security task. Unrelated findings must be surfaced but must not be silently changed in a shared system.

## 11. Reliability/operations GREEN rule

Reliability, backup, restore, failover, SLO and incident-response tasks require executable operational evidence. A runbook/document alone cannot prove that recovery works.

Examples include:

- restore drill;
- failover drill;
- retry/replay test;
- alert firing/notification proof;
- RPO/RTO measurement;
- load/chaos run;
- production telemetry over the defined window.

## 12. External-provider GREEN rule

Provider-dependent tasks require proof from the relevant provider/environment. A mocked response is useful test evidence but is not sufficient when the task explicitly requires real sandbox/production integration.

Human login, MFA, CAPTCHA, provider approval, paid-resource decisions or legal sign-off remain explicit blockers when unavoidable; they must never be bypassed or fabricated.

## 13. Infrastructure failure vs code failure

Verification systems are themselves fallible.

Examples:

- Vercel `build-rate-limit` without compiler output is an infrastructure verification blocker, not evidence of a code failure;
- a Vercel log containing a TypeScript/module/build error is real failing evidence and keeps the task YELLOW/RED;
- GitHub Actions outage/queueing is not proof that code fails;
- network timeout is not proof that an operation did not commit.

The evidence record must distinguish these cases explicitly.

## 14. Supabase evidence boundary

The currently connected shared Supabase project is not Enchev production auction authority.

`public.enchev_development_events` may provide development-test evidence only when its exact commit/test identity matches the claim. Missing rows must be reported as missing evidence, never inferred.

Unrelated SoulFlame/DAVID/Zorbas/other tables and functions are not Enchev evidence merely because they live in the same project.

## 15. Manual state protection

Automation that syncs verified evidence into the Command Center must not overwrite a human-entered blocker/evidence decision silently.

Automatic GREEN migration is allowed only for untouched legacy/default state with a concrete verified evidence mapping. A manually touched task requires explicit reconciliation.

## 16. GREEN revocation

GREEN is not permanent if its proven property later becomes false.

Examples:

- regression test begins failing;
- deployed feature is removed/broken;
- security control is bypassed;
- migration drift invalidates schema proof;
- operational drill expires under an explicit freshness requirement;
- new evidence proves the previous claim incorrect.

Revocation must preserve evidence/history; it must not erase the previous GREEN record as though it never happened.

## 17. Phase 47 interaction

`47 — FINAL SYSTEM ACCEPTANCE` cannot be GREEN while any required system point remains non-GREEN. Phase 47 cannot be used to waive missing evidence from earlier tasks.

## 18. 00.09 acceptance criteria

`00.09` may be GREEN only when:

1. RED/YELLOW/GREEN meanings are explicit;
2. universal GREEN gates are defined;
3. evidence hierarchy and invalid evidence are defined;
4. descendant evidence rules are defined;
5. documentation, runtime, auction-core, database, security, operations and provider task classes have appropriate proof requirements;
6. infrastructure failure is distinguished from code failure;
7. Supabase evidence boundaries are explicit;
8. manual evidence/blocker state is protected;
9. GREEN revocation/regression behavior is defined;
10. Phase 47 cannot bypass incomplete tasks;
11. no pricing/payment/finance scope is added;
12. the implementation commit or a proven descendant passes the applicable repository build/typecheck regression verification and production HTTP/runtime health check;
13. exact evidence is recorded before GREEN.

## 19. Evidence

- Implementation commit: `b0b6cc2585a610ad4fb443c729f7100bac727b77`.
- The direct CI run for the implementation commit was superseded/cancelled by the configured concurrency policy after a newer `main` commit arrived; this is not treated as a test failure.
- Verified descendant: `22fd06835fb9f45e55600ab0e0fff976671efa2d`; GitHub history proves it is one commit ahead of and directly descends from the implementation commit.
- GitHub Actions workflow: `Verify Enchev Web`, run `35181246608`, job `105073644768`, conclusion `success`.
- Dependency installation: PASS.
- Explicit TypeScript check `npx tsc --noEmit`: PASS.
- Production-mode `npm run build` / `next build`: PASS.
- Vercel canonical production alias `https://enchev-auctions.vercel.app/`: HTTP `200` during verification.
- Vercel runtime errors: none in the selected verification window.
- Vercel was still affected by build-rate-limit for Git-triggered exact builds; this evidence does not claim an exact Vercel build of `b0b6cc2...`.
- Supabase is not used as fake proof for this documentation task.

The implementation is a governance/documentation-only change and satisfies the documentation GREEN rule defined above: a proven descendant passed TypeScript + production-mode build regression checks while the deployed production application remained healthy.
