# DAVID Stage 8.2 — Weakness Detector

DAVID can now inspect:
- repeated failure signatures;
- unreliable learned skills;
- success-rate regressions;
- performance regressions.

It ranks weaknesses by severity and creates a concrete upgrade proposal only when the weakness passes a configurable materiality threshold.

The proposal includes a hypothesis, explicit safety constraints, and measurable acceptance criteria. It does not modify runtime code by itself; Stage 8.1 remains the promotion/rollback authority.

Verification:
`node scripts/verify-david-weakness-detector.mjs`
