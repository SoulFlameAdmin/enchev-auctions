# 21.13 — Regional CDN strategy

## Goal

Define a deterministic regional CDN/cache strategy for Enchev Auctions without hardcoding countries, Vercel POP identifiers, or data-residency claims into core runtime logic.

## Current provider evidence

The active Vercel project is `enchev-auctions`.

A read-only production probe of `/api/live-auction-clock` confirms:

- the application is served through Vercel;
- the endpoint returns `Cache-Control: no-store, max-age=0`;
- Vercel emits `x-vercel-cache` and `x-vercel-id` delivery metadata.

Those values are evidence of the current delivery platform only. They are **not** encoded as regional business logic and do not prove data residency.

Vercel's current CDN documentation supports shared caching with `s-maxage` and background refresh with `stale-while-revalidate`.

## Canonical strategy

The public `@enchev/config` boundary exports:

`packages/config/src/regional-cdn-strategy.ts`

The strategy is provider-neutral and defines four explicit cache classes:

- `static-immutable` — fingerprinted immutable public assets;
- `public-revalidate` — anonymous public content that explicitly opts into short shared caching;
- `realtime-no-store` — live/session-sensitive responses;
- `health-no-store` — operational health responses.

The helper is:

`buildRegionalCdnHeaders(cacheClass)`

## Policy values

### static-immutable

- browser/shared TTL: 31,536,000 seconds;
- `immutable`;
- intended only for fingerprinted static assets.

### public-revalidate

- browser TTL: 0;
- shared CDN TTL: 60 seconds;
- `stale-while-revalidate=300`;
- must be explicitly opted into by a public anonymous response.

### realtime-no-store / health-no-store

- `Cache-Control: no-store, max-age=0`;
- no shared-cache reuse.

## Safety rules

The strategy is fail-safe:

- dynamic/private/session-sensitive content is never assumed cacheable;
- realtime auction/session routes remain `no-store`;
- health routes remain `no-store`;
- the strategy does not encode country-specific branches;
- the strategy does not pin concrete edge POPs or compute regions;
- CDN locality is **not a data-residency guarantee**.

Data location, regional persistence, regulated storage, and residency assessment are owned by **21.14 Regional data/residency review**.

## Deployment boundary

21.13 does not require a manual Vercel deployment. The strategy, runtime header builder, existing no-store route contracts, production build, health smoke, and browser matrix can be proven in CI.

No Vercel create/update/redeploy operation is performed by this task.

## Scope exclusions

21.13 does not add:

- pricing, payment, finance, tax, currency, or accounting logic;
- provider credentials or secrets;
- manual region pinning;
- data-residency/legal conclusions;
- cache invalidation APIs or destructive cache purge operations.

## Acceptance

21.13 is GREEN only when the typed strategy, runtime header builder, existing realtime/health no-store guards, negative tests, no-country-hardcoding regression, aggregate CI, TypeScript, production build, health smoke, and Chrome/Edge regression all pass with concrete evidence.
