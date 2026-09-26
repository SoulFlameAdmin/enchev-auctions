export type WorkspaceId = string;

export type WatchlistEntry = Readonly<{
  userId: WorkspaceId;
  vehicleId: WorkspaceId;
  auctionId: WorkspaceId | null;
  createdAt: string;
}>;

export type RecentlyViewedVehicle = Readonly<{
  userId: WorkspaceId;
  vehicleId: WorkspaceId;
  auctionId: WorkspaceId | null;
  viewedAt: string;
}>;

export type SavedSearch = Readonly<{
  id: WorkspaceId;
  userId: WorkspaceId;
  name: string;
  query: Readonly<Record<string, unknown>>;
  queryFingerprint: string;
  createdAt: string;
  updatedAt: string;
}>;

export type SavedSearchAlert = Readonly<{
  id: WorkspaceId;
  userId: WorkspaceId;
  savedSearchId: WorkspaceId;
  enabled: boolean;
  cooldownSeconds: number;
  lastDeliveredAt: string | null;
}>;

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stableObject(nested)]),
    );
  }
  return value;
}

export function savedSearchFingerprint(query: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(stableObject(query));
}

export function addToWatchlist(
  entries: readonly WatchlistEntry[],
  input: WatchlistEntry,
): readonly WatchlistEntry[] {
  const userId = required(input.userId, "WATCHLIST_USER_REQUIRED");
  const vehicleId = required(input.vehicleId, "WATCHLIST_VEHICLE_REQUIRED");
  if (entries.some((x) => x.userId === userId && x.vehicleId === vehicleId)) return entries;
  return Object.freeze([...entries, Object.freeze({ ...input, userId, vehicleId })]);
}

export function removeFromWatchlist(
  entries: readonly WatchlistEntry[],
  args: Readonly<{userId: WorkspaceId; vehicleId: WorkspaceId}>,
): readonly WatchlistEntry[] {
  const userId = required(args.userId, "WATCHLIST_USER_REQUIRED");
  const vehicleId = required(args.vehicleId, "WATCHLIST_VEHICLE_REQUIRED");
  return Object.freeze(entries.filter((x) => !(x.userId === userId && x.vehicleId === vehicleId)));
}

export function recordRecentlyViewed(
  entries: readonly RecentlyViewedVehicle[],
  input: RecentlyViewedVehicle,
  maxPerUser = 100,
): readonly RecentlyViewedVehicle[] {
  const userId = required(input.userId, "RECENT_USER_REQUIRED");
  const vehicleId = required(input.vehicleId, "RECENT_VEHICLE_REQUIRED");
  if (!Number.isInteger(maxPerUser) || maxPerUser < 1) throw new Error("RECENT_LIMIT_INVALID");

  const others = entries.filter((x) => !(x.userId === userId && x.vehicleId === vehicleId));
  const userEntries = [
    Object.freeze({ ...input, userId, vehicleId }),
    ...others.filter((x) => x.userId === userId),
  ]
    .sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt))
    .slice(0, maxPerUser);
  const foreignEntries = others.filter((x) => x.userId !== userId);
  return Object.freeze([...foreignEntries, ...userEntries]);
}

export function createSavedSearch(input: Omit<SavedSearch, "queryFingerprint">): SavedSearch {
  const userId = required(input.userId, "SAVED_SEARCH_USER_REQUIRED");
  const name = required(input.name, "SAVED_SEARCH_NAME_REQUIRED");
  if (name.length > 120) throw new Error("SAVED_SEARCH_NAME_TOO_LONG");
  const fingerprint = savedSearchFingerprint(input.query);
  return Object.freeze({ ...input, userId, name, queryFingerprint: fingerprint });
}

export function createSavedSearchAlert(input: SavedSearchAlert): SavedSearchAlert {
  required(input.id, "ALERT_ID_REQUIRED");
  required(input.userId, "ALERT_USER_REQUIRED");
  required(input.savedSearchId, "ALERT_SEARCH_REQUIRED");
  if (!Number.isInteger(input.cooldownSeconds) || input.cooldownSeconds < 60) {
    throw new Error("ALERT_COOLDOWN_TOO_LOW");
  }
  return Object.freeze({ ...input });
}

export function canDeliverSavedSearchAlert(
  alert: SavedSearchAlert,
  nowIso: string,
): boolean {
  if (!alert.enabled) return false;
  if (!alert.lastDeliveredAt) return true;
  const elapsed = Date.parse(nowIso) - Date.parse(alert.lastDeliveredAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return false;
  return elapsed >= alert.cooldownSeconds * 1000;
}

export function watchingAuctionsForUser(
  entries: readonly WatchlistEntry[],
  userIdInput: WorkspaceId,
): readonly WorkspaceId[] {
  const userId = required(userIdInput, "WATCHING_USER_REQUIRED");
  return Object.freeze(
    [...new Set(
      entries
        .filter((x) => x.userId === userId && x.auctionId)
        .map((x) => x.auctionId as WorkspaceId),
    )].sort(),
  );
}
