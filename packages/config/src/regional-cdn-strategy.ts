export const REGIONAL_CDN_STRATEGY_MODEL_VERSION = 1 as const;

export type RegionalCdnCacheClass =
  | "static-immutable"
  | "public-revalidate"
  | "realtime-no-store"
  | "health-no-store";

export type RegionalCdnPolicy = Readonly<{
  browserMaxAgeSeconds: number;
  sharedMaxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  immutable: boolean;
  noStore: boolean;
}>;

export const REGIONAL_CDN_STRATEGY = Object.freeze({
  deliveryScope: "global-edge",
  originSelection: "provider-managed",
  explicitCacheOptIn: true,
  dataResidencyClaim: false,
  policies: Object.freeze({
    "static-immutable": Object.freeze({
      browserMaxAgeSeconds: 31_536_000,
      sharedMaxAgeSeconds: 31_536_000,
      staleWhileRevalidateSeconds: 0,
      immutable: true,
      noStore: false
    }),
    "public-revalidate": Object.freeze({
      browserMaxAgeSeconds: 0,
      sharedMaxAgeSeconds: 60,
      staleWhileRevalidateSeconds: 300,
      immutable: false,
      noStore: false
    }),
    "realtime-no-store": Object.freeze({
      browserMaxAgeSeconds: 0,
      sharedMaxAgeSeconds: 0,
      staleWhileRevalidateSeconds: 0,
      immutable: false,
      noStore: true
    }),
    "health-no-store": Object.freeze({
      browserMaxAgeSeconds: 0,
      sharedMaxAgeSeconds: 0,
      staleWhileRevalidateSeconds: 0,
      immutable: false,
      noStore: true
    })
  })
} as const);

export type RegionalCdnHeaders = Readonly<Record<string, string>>;

export function buildRegionalCdnHeaders(
  cacheClass: RegionalCdnCacheClass
): RegionalCdnHeaders {
  const policy = REGIONAL_CDN_STRATEGY.policies[cacheClass];

  if (!policy) {
    throw new Error("Unknown regional CDN cache class");
  }

  if (policy.noStore) {
    return {
      "Cache-Control": "no-store, max-age=0"
    };
  }

  const directives = [
    "public",
    `max-age=${policy.browserMaxAgeSeconds}`,
    `s-maxage=${policy.sharedMaxAgeSeconds}`
  ];

  if (policy.staleWhileRevalidateSeconds > 0) {
    directives.push(
      `stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`
    );
  }

  if (policy.immutable) {
    directives.push("immutable");
  }

  return {
    "Cache-Control": directives.join(", ")
  };
}
