export type RealtimeAuctionStatus = "scheduled" | "live" | "closed" | "cancelled";
export type RealtimeActionState = "watch" | "bid" | "leading" | "ended";

export type MultiAuctionRealtimeState = Readonly<{
  userId: string;
  auctionId: string;
  sequence: number;
  status: RealtimeAuctionStatus;
  actionState: RealtimeActionState;
  currentBidCents: number | null;
  updatedAt: string;
  stale: boolean;
  recentEventIds: readonly string[];
}>;

export type MultiAuctionRealtimeEvent = Readonly<{
  eventId: string;
  userId: string;
  auctionId: string;
  sequence: number;
  occurredAt: string;
  kind: "snapshot" | "bid-accepted" | "outbid" | "leading" | "closed" | "cancelled";
  currentBidCents?: number | null;
}>;

export type MultiAuctionConsistencyResult = Readonly<{
  states: readonly MultiAuctionRealtimeState[];
  duplicateEventIds: readonly string[];
  staleAuctionIds: readonly string[];
}>;

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function date(value: string, code: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(code);
  return new Date(ms).toISOString();
}

function cents(value: number | null | undefined, code: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) throw new Error(code);
  return value;
}

function normalizeState(input: MultiAuctionRealtimeState, historyLimit: number): MultiAuctionRealtimeState {
  const userId = required(input.userId, "REALTIME_USER_REQUIRED");
  const auctionId = required(input.auctionId, "REALTIME_AUCTION_REQUIRED");
  if (!Number.isInteger(input.sequence) || input.sequence < 0) throw new Error("REALTIME_SEQUENCE_INVALID");
  const updatedAt = date(input.updatedAt, "REALTIME_UPDATED_AT_INVALID");
  const ids = [...new Set(input.recentEventIds.map(x => required(x, "REALTIME_EVENT_ID_REQUIRED")))].slice(-historyLimit);
  return Object.freeze({
    ...input,
    userId,
    auctionId,
    updatedAt,
    currentBidCents: cents(input.currentBidCents, "REALTIME_BID_INVALID"),
    recentEventIds: Object.freeze(ids),
  });
}

export function applyMultiAuctionRealtimeEvents(
  current: readonly MultiAuctionRealtimeState[],
  authenticatedUserIdInput: string,
  events: readonly MultiAuctionRealtimeEvent[],
  limits: Readonly<{ maxAuctions?: number; maxEvents?: number; eventHistory?: number }> = {},
): MultiAuctionConsistencyResult {
  const authenticatedUserId = required(authenticatedUserIdInput, "REALTIME_AUTH_USER_REQUIRED");
  const maxAuctions = limits.maxAuctions ?? 100;
  const maxEvents = limits.maxEvents ?? 1000;
  const eventHistory = limits.eventHistory ?? 128;
  if (!Number.isInteger(maxAuctions) || maxAuctions < 1 || maxAuctions > 1000) throw new Error("REALTIME_MAX_AUCTIONS_INVALID");
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 10000) throw new Error("REALTIME_MAX_EVENTS_INVALID");
  if (!Number.isInteger(eventHistory) || eventHistory < 1 || eventHistory > 2048) throw new Error("REALTIME_HISTORY_INVALID");
  if (current.length > maxAuctions) throw new Error("REALTIME_AUCTION_LIMIT");
  if (events.length > maxEvents) throw new Error("REALTIME_EVENT_LIMIT");

  const byAuction = new Map<string, MultiAuctionRealtimeState>();
  for (const input of current) {
    const state = normalizeState(input, eventHistory);
    if (state.userId !== authenticatedUserId) throw new Error("REALTIME_CROSS_USER_STATE");
    if (byAuction.has(state.auctionId)) throw new Error("REALTIME_DUPLICATE_AUCTION_STATE");
    byAuction.set(state.auctionId, state);
  }

  const duplicates: string[] = [];
  const stale = new Set<string>();

  for (const raw of events) {
    const eventId = required(raw.eventId, "REALTIME_EVENT_ID_REQUIRED");
    const userId = required(raw.userId, "REALTIME_EVENT_USER_REQUIRED");
    const auctionId = required(raw.auctionId, "REALTIME_EVENT_AUCTION_REQUIRED");
    const occurredAt = date(raw.occurredAt, "REALTIME_EVENT_TIME_INVALID");
    if (userId !== authenticatedUserId) throw new Error("REALTIME_CROSS_USER_EVENT");
    if (!Number.isInteger(raw.sequence) || raw.sequence < 1) throw new Error("REALTIME_EVENT_SEQUENCE_INVALID");

    const existing = byAuction.get(auctionId) ?? Object.freeze({
      userId,
      auctionId,
      sequence: 0,
      status: "scheduled" as const,
      actionState: "watch" as const,
      currentBidCents: null,
      updatedAt: occurredAt,
      stale: false,
      recentEventIds: Object.freeze([] as string[]),
    });

    if (existing.recentEventIds.includes(eventId)) {
      duplicates.push(eventId);
      continue;
    }

    if (raw.sequence <= existing.sequence) {
      duplicates.push(eventId);
      continue;
    }

    if (raw.sequence !== existing.sequence + 1) {
      stale.add(auctionId);
      byAuction.set(auctionId, Object.freeze({...existing, stale: true}));
      continue;
    }

    const incomingBid = cents(raw.currentBidCents, "REALTIME_EVENT_BID_INVALID");
    if (incomingBid !== null && existing.currentBidCents !== null && incomingBid < existing.currentBidCents) {
      throw new Error("REALTIME_BID_REGRESSION");
    }

    let status = existing.status;
    let actionState = existing.actionState;
    if (raw.kind === "snapshot") {
      status = existing.status;
    } else if (raw.kind === "bid-accepted") {
      status = "live";
      actionState = "bid";
    } else if (raw.kind === "outbid") {
      status = "live";
      actionState = "bid";
    } else if (raw.kind === "leading") {
      status = "live";
      actionState = "leading";
    } else if (raw.kind === "closed") {
      status = "closed";
      actionState = "ended";
    } else if (raw.kind === "cancelled") {
      status = "cancelled";
      actionState = "ended";
    }

    const recentEventIds = [...existing.recentEventIds, eventId].slice(-eventHistory);
    byAuction.set(auctionId, Object.freeze({
      userId,
      auctionId,
      sequence: raw.sequence,
      status,
      actionState,
      currentBidCents: incomingBid ?? existing.currentBidCents,
      updatedAt: occurredAt,
      stale: false,
      recentEventIds: Object.freeze(recentEventIds),
    }));
  }

  if (byAuction.size > maxAuctions) throw new Error("REALTIME_AUCTION_LIMIT");
  const states = Object.freeze([...byAuction.values()].sort((a,b) => a.auctionId.localeCompare(b.auctionId)));
  for (const state of states) if (state.stale) stale.add(state.auctionId);
  return Object.freeze({
    states,
    duplicateEventIds: Object.freeze([...new Set(duplicates)].sort()),
    staleAuctionIds: Object.freeze([...stale].sort()),
  });
}
