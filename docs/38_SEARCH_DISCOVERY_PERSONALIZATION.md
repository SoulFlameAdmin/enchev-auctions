# SYSTEM Phase 38 — Search, discovery & personalization

Phase 38 adds a deterministic search/discovery contract on top of the existing inventory UI and the already verified BG/EN cross-script search profile.

## Search behavior

- Exact VIN and LOT lookups use canonical ASCII identifiers and do not transliterate identifiers.
- Human-readable full-text search uses the existing cross-script fold model, plus explicit make/model aliases and bounded typo tolerance.
- Facets are conjunctive across facet groups and inclusive within each group.
- Every sort mode has a deterministic LOT tie-breaker.
- The inventory remains the presentation surface; search never owns auction authority.

## Index lifecycle

- Search index snapshots carry a monotonic revision, source revision and canonical UTC build time.
- Freshness checks fail closed on source-revision mismatch or age expiry.
- Rebuild produces a new monotonic index revision with duplicate ID/LOT/VIN rejection.
- If the index is unavailable or stale, read-only search can fall back to the current source catalog. The fallback cannot accept bids, finalize auctions or mutate auction state.

## Discovery and personalization

- Similar-vehicle recommendations use deterministic make/model/year/price/region similarity.
- Recently viewed recommendations preserve most-recent order and de-duplicate IDs.
- Saved filter presets are immutable user-scoped search requests.
- Search URL state is serialized deterministically.
- Analytics records contain event metadata, query length, result count, facet presence, sort and source. They do not include VIN, bidder identity, payment data or raw vehicle payloads.

## Verification

`node scripts/verify-search-discovery-38.mjs --self-test`

The verifier derives all 19 frozen task identities from the immutable master plan, compiles the framework-independent search module, checks the real inventory integration, runs negative cases, records a search baseline and executes a deterministic 20,000-document load test.
