# SYSTEM 34.01–34.20 — Vehicle inspection intelligence

Status: YELLOW until exact-head CI, READY Vercel preview, implementation merge and descendant GREEN evidence are proven.

## Frozen identities
This package implements all twenty frozen Phase 34 tasks without renumbering: structured inspection schema, seller declaration, inspector provenance, cold-start/walk-around/undercarriage video, engine audio, damage map, OBD, paint, tire and component condition data, photo checklist, media ordering/angle validation, playback pipeline state, integrity metadata, immutable versions, moderation, non-authoritative AI suggestions and completeness tests.

## Authority boundaries
- Inspection records are deterministic domain records and do not become auction winner/bid authority.
- AI damage suggestions are stored separately from the authoritative inspector/seller damage map and can never mutate it implicitly.
- The connected Supabase project is development-governance only and is not used as auction/inspection business authority.
- The transcoding implementation in this phase is the provider-neutral queue/readiness/playback-manifest state machine. Actual codec execution is performed by a later bound media worker/provider and is not falsely claimed here.

## Acceptance
The verifier exercises every frozen task identity plus positive and negative runtime cases: schema/provenance validation, all required media kinds, damage coordinates, OBD format, paint/tire/component fields, photo and angle checks, deterministic ordering, transcode readiness, hash/byte integrity, immutable version increments, moderation, AI separation, and complete/incomplete inspection outcomes.
