# 21.14 — Regional data/residency review

## Goal

Complete a factual regional data/residency review for the current Enchev Auctions architecture without converting provider metadata into legal or compliance guarantees.

The canonical machine-readable review is:

`config/enchev-regional-data-residency-review.json`

## Review meaning

**GREEN for 21.14 means the current data planes, verified facts, unknowns, and unresolved residency requirements are explicitly inventoried and CI-guarded.**

It does **not** mean:

- a jurisdiction has approved Enchev for launch;
- legal/compliance sign-off exists;
- all production data is resident in one region;
- the current shared Supabase project is production auction authority;
- Redis, object storage, logging retention, or Vercel compute region are production-ready.

The review therefore keeps:

- `legal_conclusion=false`;
- `residency_compliance_approved=false`;
- `market_activation_approval=false`;
- `residency_claim=false` on every data plane.

## Verified provider facts — 2026-09-19

### Supabase development/governance

Read-only provider inspection reported the bound Supabase project:

- project ref: `frhletkiuupgksmgxoxc`;
- project name: `soulflame-twins`;
- provider status: `ACTIVE_HEALTHY`;
- provider region: `eu-west-1`.

The repository binding independently records the same region and explicitly limits Enchev usage to `development-governance` with `auction_authority=false`.

Therefore the review marks only this existing development/governance plane as `verified-region`. This is **not** a production auction database residency approval.

### Vercel runtime compute

The current Enchev Vercel project is `enchev-auctions`.

Current Vercel documentation supports project/function execution-region configuration through a `regions` setting. The repository's current `vercel.json` contains no `regions` or `functionFailoverRegions` configuration.

Therefore current runtime compute is classified as `region-unpinned`. No default region is guessed and no residency claim is made.

### Vercel CDN delivery

21.13 established a global-edge CDN/cache strategy with `dataResidencyClaim=false`.

CDN delivery locality is **not** treated as persistent-data residency. Public edge caching can distribute explicitly cacheable public content and must not be used as evidence that regulated or private data remains in a specific jurisdiction.

### Redis / Valkey support

The canonical Redis contract still records:

- `binding_status=pending-live-provider`;
- `provider=null`;
- Redis is non-authoritative support only.

Because no real provider is bound, Redis region is unresolved and remains `provider-pending`.

### Object/document storage

21.10 intentionally did not implement upload/object storage or choose a storage provider.

The review therefore records object storage as `not-configured`. No provider region, retention period, or residency conclusion is invented.

### Runtime observability

The project can produce platform runtime/build observability data, but the repository currently contains no approved regional observability/retention policy for Enchev.

The review records this plane as `unverified` and keeps its regional/retention requirement unresolved.

## Unresolved requirements

Before claiming production residency/compliance, the following remain explicit:

- legal/compliance sign-off for the intended market;
- production authoritative database region;
- Redis provider and region;
- object storage provider and region;
- Vercel runtime-compute region policy;
- runtime observability region and retention policy.

External legal/provider approval can remain unresolved without blocking completion of this architecture review. It must not be silently converted into GREEN provider readiness.

## Relationship to neighboring tasks

- **21.13 Regional CDN strategy** owns CDN/cache behavior.
- **21.14** owns the current data-plane residency review and gap inventory.
- **21.15 Unicode normalization** is the next independent globalization task.

No country-specific legal rule is introduced here.

## Deployment boundary

21.14 is governance/configuration review work. It does not require a Vercel create/update/redeploy operation, region mutation, database migration, storage provisioning, or Redis provisioning.

## Scope exclusions

No pricing, payment, finance, tax, currency, or accounting scope is added.

## Acceptance

21.14 is GREEN only when:

1. every current/future data plane in the review has an explicit status;
2. verified-region claims match canonical provider binding data;
3. unknown/unconfigured planes do not fabricate regions;
4. every data plane keeps `residency_claim=false`;
5. legal/compliance and market-activation approval stay false;
6. unresolved production requirements remain non-empty and deterministic;
7. 21.13 CDN residency boundary remains intact;
8. repository invariants, aggregate CI, TypeScript, production build, health smoke, and Chrome/Edge regression all pass with evidence.
