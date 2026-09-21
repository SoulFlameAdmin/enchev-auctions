const HEALTH_COMPONENTS = ["web", "api", "realtime", "worker"] as const;
const HEALTH_STATUSES = ["healthy", "service-pending"] as const;
const REDIS_STATUSES = ["pong", "redis-binding-ping-failed", "missing-redis-binding"] as const;
const REDIS_BINDINGS = ["tcp-url", "upstash-rest", "vercel-kv-rest"] as const;
const BID_FEEDBACK = ["accepted", "leading", "outbid", "rejected"] as const;

export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];
export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export type BidFeedback = (typeof BID_FEEDBACK)[number];

export type ComponentHealthResponse = {
  ok: boolean;
  component: HealthComponent;
  ready: boolean;
  status: HealthStatus;
  schemaVersion: 1;
  valuesExposed: false;
};

export type LiveAuctionActionRequest = { action: "bid" };

export type LiveAuctionDemoClockResponse = {
  serverNow: number;
  roundEndsAt: number;
  durationMs: number;
  lotIndex: number;
  lotId: string;
  scope: "server-issued-browser-session-demo";
  auctionAuthority: false;
  bidFeedback: BidFeedback | null;
  priceDelta: number;
};

export type ApiErrorEnvelope = { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

export function isComponentHealthResponse(value: unknown): value is ComponentHealthResponse {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ["ok", "component", "ready", "status", "schemaVersion", "valuesExposed"])) return false;
  if (typeof value.ok !== "boolean" || typeof value.ready !== "boolean") return false;
  if (!HEALTH_COMPONENTS.includes(value.component as HealthComponent)) return false;
  if (!HEALTH_STATUSES.includes(value.status as HealthStatus)) return false;
  if (value.schemaVersion !== 1 || value.valuesExposed !== false) return false;
  if (value.ok !== value.ready) return false;
  if (value.ready && value.status !== "healthy") return false;
  if (!value.ready && value.status !== "service-pending") return false;
  return true;
}

export function isRedisHealthResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (typeof value.ok !== "boolean" || typeof value.configured !== "boolean") return false;
  if (!REDIS_STATUSES.includes(value.status as (typeof REDIS_STATUSES)[number])) return false;
  if (value.binding !== undefined && !REDIS_BINDINGS.includes(value.binding as (typeof REDIS_BINDINGS)[number])) return false;
  if (value.tls !== undefined && typeof value.tls !== "boolean") return false;
  if (value.latencyMs !== undefined && (!isInteger(value.latencyMs) || value.latencyMs < 0)) return false;
  return true;
}

export function isRedisEnvironmentHealthResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ["ok", "candidateKeyCount", "candidateKeys", "valuesExposed"])) return false;
  if (value.ok !== true || value.valuesExposed !== false) return false;
  if (!isInteger(value.candidateKeyCount) || value.candidateKeyCount < 0) return false;
  if (!Array.isArray(value.candidateKeys) || !value.candidateKeys.every((key) => typeof key === "string")) return false;
  return value.candidateKeyCount === value.candidateKeys.length;
}

export function parseLiveAuctionActionRequest(value: unknown): LiveAuctionActionRequest | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["action"])) return null;
  return value.action === "bid" ? { action: "bid" } : null;
}

export function isLiveAuctionDemoClockResponse(value: unknown): value is LiveAuctionDemoClockResponse {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [
    "serverNow", "roundEndsAt", "durationMs", "lotIndex", "lotId",
    "scope", "auctionAuthority", "bidFeedback", "priceDelta"
  ])) return false;
  if (!isInteger(value.serverNow) || !isInteger(value.roundEndsAt)) return false;
  if (!isInteger(value.durationMs) || value.durationMs < 1) return false;
  if (!isInteger(value.lotIndex) || value.lotIndex < 0) return false;
  if (typeof value.lotId !== "string" || value.lotId.length === 0) return false;
  if (value.scope !== "server-issued-browser-session-demo" || value.auctionAuthority !== false) return false;
  if (value.bidFeedback !== null && !BID_FEEDBACK.includes(value.bidFeedback as BidFeedback)) return false;
  return isFiniteNumber(value.priceDelta);
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return isRecord(value)
    && hasOnlyKeys(value, ["error"])
    && typeof value.error === "string"
    && value.error.length > 0;
}

export function assertContractResponse<T>(
  schemaName: string,
  value: T,
  validate: (candidate: unknown) => boolean,
): T {
  if (!validate(value)) throw new Error(`API_SCHEMA_VALIDATION_FAIL: ${schemaName}`);
  return value;
}
