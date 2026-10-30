/**
 * Enchev plan projection transport policy. This is client-only availability
 * logic, NOT a source of GREEN evidence and NOT an alternate cloud authority.
 */
export const CLOUD_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
export const CLOUD_QUOTA_BACKOFF_KEY = "enchev-plan-cloud-402-cooldown-v1";

export function classifyPlanEndpoint(status: number): "ok" | "quota-restricted" | "transient-error" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 402) return "quota-restricted";
  return "transient-error";
}

export function shouldBlockPlanEndpoint(storedAt: unknown, now: number): boolean {
  if (typeof storedAt !== "string" || !/^\d{13}$/.test(storedAt)) return false;
  const previous = Number(storedAt);
  return Number.isSafeInteger(now) &&
    Number.isSafeInteger(previous) &&
    previous > 0 && previous <= now &&
    now - previous < CLOUD_QUOTA_COOLDOWN_MS;
}

export function isFreshPlanRows(body: unknown): body is { rows: unknown[] } {
  return !!body && typeof body === "object" && !Array.isArray(body) &&
    "rows" in body && Array.isArray((body as { rows?: unknown }).rows);
}
