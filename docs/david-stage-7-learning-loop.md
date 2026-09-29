# DAVID Stage 7 — Learning Loop v1

This layer is intentionally outside the protected `tools/david/*` runtime infrastructure.

## Purpose

Turn a completed autonomy run into a deterministic learning record:

`run → normalize → classify → lesson → confidence → optional skill promotion`

## Safety

- Failed runs never auto-promote into skills.
- A skill requires reusable evidence, confidence >= 0.70, and at least two successful examples.
- Promotion remains a decision signal only; this module does not mutate runtime code.
- No production deployment or self-modification occurs here.

## Verification

Run:

`node scripts/verify-david-learning-loop.mjs`

Expected output:

`PASS david learning loop v1`

## Next integration

Wire completed `david_autonomy_runs` + `david_autonomy_steps` + `david_autonomy_observations` into `david_learning_cycles`, then persist promoted procedures into `david_skills` only after verification.
