# DAVID Stage 7.3 — Skill Retrieval & Strategy Selection

Before planning a new task, DAVID can now retrieve previously learned skills and decide whether to reuse one or plan from scratch.

Decision flow:

`goal → eligible skills → relevance score → confidence/reliability weighting → reuse_skill | plan_fresh`

Safety rules:
- disabled skills are ignored;
- high/blocked-risk skills are excluded by default;
- low-confidence skills are excluded;
- confirmation-required skills can be gated when the caller requires pre-confirmed procedures;
- no skill is executed by this module; it only selects a strategy.

The selector remains deterministic and auditable. It does not modify protected `tools/david/*` runtime files.

Verification:
`node scripts/verify-david-skill-retrieval.mjs`
