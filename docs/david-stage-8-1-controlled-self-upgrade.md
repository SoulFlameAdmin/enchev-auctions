# DAVID Stage 8.1 — Controlled Self-Upgrade Controller

State path:
`thinker_ready → actor_queued → actor_processing → awaiting_test → testing → passed → promoted`

Failure paths end in `failed`, `rejected`, or `rolled_back`.

Promotion is blocked unless all of these exist:
- candidate status = passed;
- test run status = passed;
- backup reference;
- base revision and different candidate revision;
- artifact SHA-256;
- measurable benchmark PASS.

This module produces promotion/rollback plans only. It does not mutate protected runtime infrastructure or production by itself.
