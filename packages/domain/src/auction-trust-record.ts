export type VehicleActivityAudience = "public" | "participant" | "admin";

export type VehicleActivityVisibility = "public" | "participant" | "internal";

export type VehicleActivityKind =
  | "listing-created"
  | "listing-updated"
  | "inspection-published"
  | "qa-answered"
  | "auction-published"
  | "auction-started"
  | "bid-accepted"
  | "auction-extended"
  | "auction-closed"
  | "result-recorded"
  | "admin-exception";

export type VehicleActivityEvent = Readonly<{
  eventId: string;
  vehicleId: string;
  auctionId: string | null;
  kind: VehicleActivityKind;
  occurredAt: string;
  sequence: number;
  visibility: VehicleActivityVisibility;
  sourceRef: string;
  correlationId: string | null;
  summary: string;
}>;

export type VehicleActivityTimelineItem = VehicleActivityEvent & Readonly<{
  ordinal: number;
}>;

function assertNonBlank(value: string, field: string): void {
  if (!String(value || "").trim()) throw new Error(`${field} must be non-empty`);
}

function assertUtcIso(value: string): void {
  assertNonBlank(value, "occurredAt");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("occurredAt must be a valid ISO timestamp");
  if (!/Z$/.test(value)) throw new Error("occurredAt must be UTC and end with Z");
  if (new Date(parsed).toISOString() !== value) {
    throw new Error("occurredAt must use canonical ISO-8601 UTC form");
  }
}

function canSee(visibility: VehicleActivityVisibility, audience: VehicleActivityAudience): boolean {
  if (audience === "admin") return true;
  if (audience === "participant") return visibility !== "internal";
  return visibility === "public";
}

/**
 * Builds a deterministic, read-only chronology for one vehicle.
 *
 * Inputs are authoritative event records produced elsewhere in the system.
 * This function never invents events or mutates source records. It validates
 * scope, uniqueness and chronology, then applies audience visibility.
 */
export function buildVehicleActivityTimeline(
  vehicleId: string,
  events: readonly VehicleActivityEvent[],
  audience: VehicleActivityAudience,
): readonly VehicleActivityTimelineItem[] {
  assertNonBlank(vehicleId, "vehicleId");

  const seen = new Set<string>();
  for (const event of events) {
    assertNonBlank(event.eventId, "eventId");
    assertNonBlank(event.vehicleId, "event.vehicleId");
    assertNonBlank(event.sourceRef, "sourceRef");
    assertNonBlank(event.summary, "summary");
    if (event.vehicleId !== vehicleId) {
      throw new Error(`cross-vehicle activity is forbidden: expected ${vehicleId}, received ${event.vehicleId}`);
    }
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) {
      throw new Error(`sequence must be a non-negative safe integer for ${event.eventId}`);
    }
    assertUtcIso(event.occurredAt);
    if (seen.has(event.eventId)) throw new Error(`duplicate activity eventId: ${event.eventId}`);
    seen.add(event.eventId);
  }

  const visible = events
    .filter((event) => canSee(event.visibility, audience))
    .slice()
    .sort((a, b) => {
      const time = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
      if (time !== 0) return time;
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return a.eventId.localeCompare(b.eventId);
    });

  return Object.freeze(
    visible.map((event, index) =>
      Object.freeze({
        ...event,
        ordinal: index + 1,
      }),
    ),
  );
}


export type TrustRecordJson =
  | null
  | boolean
  | number
  | string
  | readonly TrustRecordJson[]
  | Readonly<{ [key: string]: TrustRecordJson }>;

export type AuctionRulesSnapshot = Readonly<{
  snapshotId: string;
  auctionId: string;
  rulesVersion: string;
  capturedAt: string;
  sourceRef: string;
  rules: Readonly<Record<string, TrustRecordJson>>;
}>;

export type AuctionLifecycleForTrustRecord =
  | "draft"
  | "published"
  | "live"
  | "closed"
  | "sold"
  | "unsold"
  | "void"
  | "seller-approval-pending";

export type VisibleAuctionRulesSnapshot = AuctionRulesSnapshot & Readonly<{
  visibleAfterClose: true;
  closedAt: string;
}>;

function isPostCloseState(state: AuctionLifecycleForTrustRecord): boolean {
  return state === "closed"
    || state === "sold"
    || state === "unsold"
    || state === "void"
    || state === "seller-approval-pending";
}

function assertJsonValue(value: unknown, path: string): asserts value is TrustRecordJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain only finite JSON numbers`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && value) {
    for (const [key, item] of Object.entries(value)) {
      assertNonBlank(key, `${path} key`);
      assertJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} must be JSON-safe`);
}

function cloneAndFreezeJson(value: TrustRecordJson): TrustRecordJson {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreezeJson(item)));
  }
  if (value && typeof value === "object") {
    const clone: Record<string, TrustRecordJson> = {};
    for (const [key, item] of Object.entries(value)) clone[key] = cloneAndFreezeJson(item);
    return Object.freeze(clone);
  }
  return value;
}

/**
 * Exposes the exact versioned auction-rules snapshot only after auction close.
 *
 * The function does not author rules. It accepts a provenance-bearing snapshot
 * captured by the authoritative auction configuration path and returns a
 * read-only view after a terminal/post-close state is reached.
 */
export function visibleAuctionRulesSnapshotAfterClose(
  snapshot: AuctionRulesSnapshot,
  lifecycleState: AuctionLifecycleForTrustRecord,
  closedAt: string | null,
): VisibleAuctionRulesSnapshot | null {
  assertNonBlank(snapshot.snapshotId, "snapshotId");
  assertNonBlank(snapshot.auctionId, "auctionId");
  assertNonBlank(snapshot.rulesVersion, "rulesVersion");
  assertNonBlank(snapshot.sourceRef, "sourceRef");
  assertUtcIso(snapshot.capturedAt);
  assertJsonValue(snapshot.rules, "rules");

  if (!isPostCloseState(lifecycleState)) {
    if (closedAt !== null) throw new Error("closedAt must be null before auction close");
    return null;
  }

  if (closedAt === null) throw new Error("closedAt is required after auction close");
  assertUtcIso(closedAt);
  if (Date.parse(snapshot.capturedAt) > Date.parse(closedAt)) {
    throw new Error("auction rules snapshot cannot be captured after close");
  }

  const rules = cloneAndFreezeJson(snapshot.rules) as Readonly<Record<string, TrustRecordJson>>;
  return Object.freeze({
    ...snapshot,
    rules,
    visibleAfterClose: true,
    closedAt,
  });
}



export type VehicleTrustSnapshot = Readonly<{
  snapshotId: string;
  auctionId: string;
  vehicleId: string;
  sourceRevision: string;
  sourceRef: string;
  capturedAt: string;
  vehicle: Readonly<Record<string, TrustRecordJson>>;
}>;

export type VisibleVehicleSnapshot = VehicleTrustSnapshot & Readonly<{
  visibleAfterClose: true;
  closedAt: string;
}>;

/**
 * Exposes an immutable authoritative vehicle snapshot only after auction close.
 *
 * The function never invents vehicle fields. It validates provenance and
 * chronology, deep-clones/freezes the supplied authoritative payload, and
 * withholds it until a post-close lifecycle state exists.
 */
export function visibleVehicleSnapshotAfterClose(
  snapshot: VehicleTrustSnapshot,
  lifecycleState: AuctionLifecycleForTrustRecord,
  closedAt: string | null,
): VisibleVehicleSnapshot | null {
  assertNonBlank(snapshot.snapshotId, "snapshotId");
  assertNonBlank(snapshot.auctionId, "auctionId");
  assertNonBlank(snapshot.vehicleId, "vehicleId");
  assertNonBlank(snapshot.sourceRevision, "sourceRevision");
  assertNonBlank(snapshot.sourceRef, "sourceRef");
  assertUtcIso(snapshot.capturedAt);
  assertJsonValue(snapshot.vehicle, "vehicle");

  if (!isPostCloseState(lifecycleState)) {
    if (closedAt !== null) throw new Error("closedAt must be null before auction close");
    return null;
  }

  if (closedAt === null) throw new Error("closedAt is required after auction close");
  assertUtcIso(closedAt);
  if (Date.parse(snapshot.capturedAt) > Date.parse(closedAt)) {
    throw new Error("vehicle snapshot cannot be captured after close");
  }

  const vehicle = cloneAndFreezeJson(snapshot.vehicle) as Readonly<Record<string, TrustRecordJson>>;
  return Object.freeze({
    ...snapshot,
    vehicle,
    visibleAfterClose: true,
    closedAt,
  });
}
