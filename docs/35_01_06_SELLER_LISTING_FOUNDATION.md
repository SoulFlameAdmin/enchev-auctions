# SYSTEM 35.01–35.06 — Seller listing foundation

Status: YELLOW until exact-head CI, READY Vercel preview, implementation merge and descendant GREEN evidence are proven.

## Frozen identities
- 35.01 Seller listing wizard
- 35.02 Draft autosave
- 35.03 Required-field readiness checklist
- 35.04 Required-media readiness checklist
- 35.05 Seller preview before submit
- 35.06 Vehicle public Q&A thread

## Contract
The seller workflow is deterministic and seller-scoped. Wizard advancement is blocked by the readiness rules for the current step. Autosave uses optimistic revisions and mutation IDs so retries are idempotent and stale/cross-seller writes fail closed.

Preview output intentionally excludes seller identity and mutation history. Submission readiness requires the complete field and media checklists. Public Q&A exposes only published questions for the requested vehicle, with bounded body length and deterministic chronology.

## Acceptance
The verifier exercises all six frozen task identities, wizard gates, idempotent autosave/revision conflicts, field and media readiness, preview privacy/readiness, public/hidden Q&A filtering, duplicate IDs and bounds.
