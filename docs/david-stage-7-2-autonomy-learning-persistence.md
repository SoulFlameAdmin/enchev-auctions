# DAVID Stage 7.2 — Autonomy Learning Persistence

The existing `david_learning_cycles` table belongs to the Soul learning queue and human-review workflow. Stage 7.2 therefore does not overload that table.

The autonomy path is:

`david_autonomy_runs + david_autonomy_steps + david_autonomy_observations → deterministic lesson → optional david_skills candidate`

Rules:
- source execution evidence is read-only;
- failed runs cannot create skill candidates;
- skill persistence is opt-in via `persistSkill`;
- every learned skill defaults to `requires_confirmation=true`;
- this layer never edits `tools/david/*` or runtime supervisor files.

Verification:
`node scripts/verify-david-autonomy-learning-persistence.mjs`
