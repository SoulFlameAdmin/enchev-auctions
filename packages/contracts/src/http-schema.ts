const HEALTH_COMPONENTS = ["web", "api", "realtime", "worker"] as const;
const HEALTH_STATUSES = ["healthy", "service-pending"] as const;
const REDIS_STATUSES = ["pong", "redis-binding-ping-failed", "missing-redis-binding"] as const;
const REDIS_BINDINGS = ["tcp-url", "upstash-rest", "vercel-kv-rest"] as const;
const BID_FEEDBACK = ["accepted", "leading", "outbid", "rejected"] as const;

export const REQUEST_CORRELATION_HEADER = "x-request-id" as const;
const REQUEST_CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

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

export type ApiError = {
  code: string;
  message: string;
};

export type ApiErrorEnvelope = {
  error: ApiError;
};

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

export function createApiErrorEnvelope(code: string, message: string): ApiErrorEnvelope {
  const value: ApiErrorEnvelope = { error: { code, message } };
  if (!isApiErrorEnvelope(value)) {
    throw new Error("API_ERROR_ENVELOPE_INVALID");
  }
  return value;
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!isRecord(value) || !hasOnlyKeys(value, ["error"]) || !isRecord(value.error)) return false;
  if (!hasOnlyKeys(value.error, ["code", "message"])) return false;
  return typeof value.error.code === "string"
    && value.error.code.length > 0
    && typeof value.error.message === "string"
    && value.error.message.length > 0;
}

export function isRequestCorrelationId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_CORRELATION_ID_PATTERN.test(value);
}

export function resolveRequestCorrelationId(
  candidate: string | null | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string {
  if (isRequestCorrelationId(candidate)) return candidate;
  const generated = generate();
  if (!isRequestCorrelationId(generated)) {
    throw new Error("REQUEST_CORRELATION_ID_GENERATOR_INVALID");
  }
  return generated;
}

export function assertContractResponse<T>(
  schemaName: string,
  value: T,
  validate: (candidate: unknown) => boolean,
): T {
  if (!validate(value)) throw new Error(`API_SCHEMA_VALIDATION_FAIL: ${schemaName}`);
  return value;
}


export const API_QUERY_MAX_PAGE_SIZE = 100 as const;
const API_QUERY_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export type ApiListQuery = {
  page: number;
  pageSize: number;
  filters: Readonly<Record<string, string>>;
  sort: ReadonlyArray<{ field: string; direction: "asc" | "desc" }>;
};

export function parseApiListQuery(
  input: URLSearchParams | string,
  options: { allowedFilters?: readonly string[]; allowedSorts?: readonly string[] } = {},
): ApiListQuery {
  const params = typeof input === "string"
    ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
    : input;
  const allowedFilters = new Set(options.allowedFilters ?? []);
  const allowedSorts = new Set(options.allowedSorts ?? []);
  const allowedKeys = new Set(["page", "pageSize", "filter", "sort"]);

  for (const key of params.keys()) {
    if (!allowedKeys.has(key)) throw new Error("API_QUERY_UNKNOWN_PARAMETER");
  }

  const parsePositiveInteger = (name: string, fallback: number, max?: number) => {
    const values = params.getAll(name);
    if (values.length > 1) throw new Error("API_QUERY_DUPLICATE_PARAMETER");
    if (values.length === 0) return fallback;
    if (!/^[1-9][0-9]*$/.test(values[0])) throw new Error("API_QUERY_INVALID_PAGINATION");
    const value = Number(values[0]);
    if (!Number.isSafeInteger(value) || (max !== undefined && value > max)) {
      throw new Error("API_QUERY_INVALID_PAGINATION");
    }
    return value;
  };

  const page = parsePositiveInteger("page", 1);
  const pageSize = parsePositiveInteger("pageSize", 20, API_QUERY_MAX_PAGE_SIZE);
  const filters: Record<string, string> = {};
  for (const entry of params.getAll("filter")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error("API_QUERY_INVALID_FILTER");
    const field = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (!API_QUERY_FIELD_PATTERN.test(field) || !value || value.length > 256) {
      throw new Error("API_QUERY_INVALID_FILTER");
    }
    if (allowedFilters.size > 0 && !allowedFilters.has(field)) throw new Error("API_QUERY_FILTER_NOT_ALLOWED");
    if (Object.hasOwn(filters, field)) throw new Error("API_QUERY_DUPLICATE_FILTER");
    filters[field] = value;
  }

  const sort = params.getAll("sort").map((entry) => {
    const [field, direction, ...rest] = entry.split(":");
    if (rest.length || !API_QUERY_FIELD_PATTERN.test(field ?? "") || !["asc", "desc"].includes(direction ?? "")) {
      throw new Error("API_QUERY_INVALID_SORT");
    }
    if (allowedSorts.size > 0 && !allowedSorts.has(field)) throw new Error("API_QUERY_SORT_NOT_ALLOWED");
    return { field, direction: direction as "asc" | "desc" };
  });
  if (new Set(sort.map((item) => item.field)).size !== sort.length) throw new Error("API_QUERY_DUPLICATE_SORT");

  return { page, pageSize, filters, sort };
}


export const IDEMPOTENCY_KEY_HEADER = "idempotency-key" as const;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128 as const;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type IdempotencyRecordState = "in-progress" | "completed";
export type IdempotencyDecision =
  | { action: "execute" }
  | { action: "replay" }
  | { action: "conflict"; code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST" }
  | { action: "in-progress"; code: "IDEMPOTENCY_REQUEST_IN_PROGRESS" };

export type IdempotencyRecord = {
  requestFingerprint: string;
  state: IdempotencyRecordState;
};

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= IDEMPOTENCY_KEY_MAX_LENGTH
    && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function requireIdempotencyKey(value: string | null | undefined): string {
  if (!isIdempotencyKey(value)) throw new Error("IDEMPOTENCY_KEY_INVALID");
  return value;
}

export function decideIdempotencyAction(
  existing: IdempotencyRecord | null | undefined,
  requestFingerprint: string,
): IdempotencyDecision {
  if (!requestFingerprint) throw new Error("IDEMPOTENCY_FINGERPRINT_REQUIRED");
  if (!existing) return { action: "execute" };
  if (existing.requestFingerprint !== requestFingerprint) {
    return { action: "conflict", code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST" };
  }
  if (existing.state === "in-progress") {
    return { action: "in-progress", code: "IDEMPOTENCY_REQUEST_IN_PROGRESS" };
  }
  return { action: "replay" };
}
