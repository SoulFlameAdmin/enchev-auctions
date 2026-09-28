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
