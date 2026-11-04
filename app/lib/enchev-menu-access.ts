import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Validates the exact HttpOnly token issued by /api/menu-access. */
export function hasEnchevMenuAccess(cookieValue: string | undefined): boolean {
  const password = process.env.ENCHEV_MENU_PASSWORD || "";
  if (!password || !cookieValue) return false;

  const [expiry, signature, ...extra] = cookieValue.split(".");
  if (
    extra.length !== 0 ||
    !expiry ||
    !signature ||
    !/^[0-9]+$/.test(expiry) ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) return false;

  const now = Date.now();
  const expiration = Number(expiry);
  if (!Number.isSafeInteger(expiration) || expiration < now || expiration > now + 12 * 60 * 60 * 1000) {
    return false;
  }

  const expected = createHmac("sha256", password)
    .update("enchev-sidebar-v1:" + expiry)
    .digest("hex");

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
