import "server-only";
import type { NextRequest } from "next/server";
import { closedDemoBoundaryFromServer } from "./enchev-closed-demo-server";
import {
  authorizeClosedDemoTicket,
  type ClosedDemoAuthDecision,
  type ClosedDemoReadAuthority
} from "../../packages/domain/src/closed-demo-session-guard";
import type {
  ClosedDemoAction,
  ClosedDemoTarget
} from "../../packages/domain/src/closed-demo-roles";

/**
 * MISSION-003 — trust boundary for future preview-only API routes.
 *
 * No route currently calls this helper. Callers must supply a SERVER-ONLY
 * authoritative session+roster reader and must enforce origin/CSRF checks for
 * state-changing requests. Never trust a browser-supplied role or subjectId.
 */
export async function authorizeClosedDemoBrowserRequest(
  request: NextRequest,
  authority: ClosedDemoReadAuthority,
  action: ClosedDemoAction,
  target: ClosedDemoTarget
): Promise<ClosedDemoAuthDecision> {
  try {
    const boundary = closedDemoBoundaryFromServer(); // rejects production/unisolated deployments
    const encodedSecret = process.env.ENCHEV_CLOSED_DEMO_SESSION_SECRET_BASE64URL;
    if (!encodedSecret || !/^[A-Za-z0-9_-]+$/.test(encodedSecret)) {
      return { permitted: false, reason: "AUTHORITY_UNAVAILABLE" };
    }
    const secret = Buffer.from(encodedSecret, "base64url");
    if (secret.byteLength < 32 || secret.toString("base64url") !== encodedSecret) {
      return { permitted: false, reason: "AUTHORITY_UNAVAILABLE" };
    }
    const cookieName = process.env.VERCEL_ENV === "preview"
      ? "__Host-enchev-closed-demo"
      : "enchev-closed-demo-local";
    const ticket = request.cookies.get(cookieName)?.value || "";
    return await authorizeClosedDemoTicket(
      boundary, ticket, secret, Date.now(), authority, action, target
    );
  } catch {
    return { permitted: false, reason: "AUTHORITY_UNAVAILABLE" };
  }
}
