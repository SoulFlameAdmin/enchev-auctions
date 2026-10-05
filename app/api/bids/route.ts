import {
  IDEMPOTENCY_KEY_HEADER,
  assertContractResponse,
  createApiErrorEnvelope,
  isApiErrorEnvelope,
  isAuthoritativeBidAcceptedResponse,
  parseAuthoritativeBidRequest,
  requireIdempotencyKey,
} from "@enchev/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RpcBidResult = {
  accepted?: boolean;
  reason?: string;
  authority?: string;
  auctionId?: string;
  bidId?: string;
  bidderId?: string;
  amountCents?: number;
  currency?: string;
  sequence?: number;
  acceptedAt?: string;
  replayed?: boolean;
};

function error(status: number, code: string, message: string) {
  const body = assertContractResponse(
    "ErrorEnvelope",
    createApiErrorEnvelope(code, message),
    isApiErrorEnvelope,
  );
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length >= 20 && token.length <= 8192 ? token : null;
}

async function fingerprintBid(auctionId: string, amountCents: number) {
  const canonical = JSON.stringify({
    operation: "POST /api/bids",
    auctionId,
    amountCents,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const authUrl = process.env.ENCHEV_AUTH_SUPABASE_URL?.replace(/\/$/, "");
  const authPublishableKey = process.env.ENCHEV_AUTH_SUPABASE_PUBLISHABLE_KEY;
  const auctionUrl = process.env.ENCHEV_AUCTION_SUPABASE_URL?.replace(/\/$/, "");
  const auctionSecretKey = process.env.ENCHEV_AUCTION_SUPABASE_SECRET_KEY;

  if (!authUrl || !authPublishableKey || !auctionUrl || !auctionSecretKey) {
    return error(503, "AUCTION_AUTHORITY_NOT_CONFIGURED", "Auth and authoritative auction database bindings are required.");
  }

  let auctionHost: string;
  try {
    auctionHost = new URL(auctionUrl).hostname;
  } catch {
    return error(503, "AUCTION_AUTHORITY_NOT_CONFIGURED", "Authoritative auction database URL is invalid.");
  }

  if (auctionHost === "frhletkiuupgksmgxoxc.supabase.co") {
    return error(503, "AUCTION_AUTHORITY_MUST_BE_DEDICATED", "The shared development project cannot be used as auction authority.");
  }

  const token = bearerToken(request);
  if (!token) return error(401, "AUTHENTICATION_REQUIRED", "A valid buyer session is required.");

  let idempotencyKey: string;
  try {
    idempotencyKey = requireIdempotencyKey(request.headers.get(IDEMPOTENCY_KEY_HEADER));
  } catch {
    return error(400, "IDEMPOTENCY_KEY_INVALID", "A valid Idempotency-Key header is required.");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return error(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const body = parseAuthoritativeBidRequest(rawBody);
  if (!body) return error(400, "INVALID_BID_REQUEST", "auctionId and a positive integer amountCents are required.");

  const userResponse = await fetch(`${authUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: authPublishableKey,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-store",
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return error(401, "AUTHENTICATION_REQUIRED", "Buyer session is invalid or expired.");
  }

  const user = await userResponse.json() as { id?: unknown };
  if (typeof user.id !== "string") return error(401, "AUTHENTICATION_REQUIRED", "Buyer identity could not be verified.");

  const requestFingerprint = await fingerprintBid(body.auctionId, body.amountCents);
  const rpcResponse = await fetch(`${auctionUrl}/rest/v1/rpc/enchev_place_bid`, {
    method: "POST",
    headers: {
      apikey: auctionSecretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      p_auction_id: body.auctionId,
      p_bidder_id: user.id,
      p_amount_cents: body.amountCents,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: requestFingerprint,
    }),
    cache: "no-store",
  });

  if (!rpcResponse.ok) {
    return error(503, "AUCTION_AUTHORITY_UNAVAILABLE", "Authoritative bid transaction is unavailable.");
  }

  const result = await rpcResponse.json() as RpcBidResult;
  if (result.accepted !== true) {
    const reason = typeof result.reason === "string" ? result.reason : "bid-rejected";
    const status = reason === "idempotency-conflict" ? 409 : 422;
    return error(status, reason.toUpperCase().replaceAll("-", "_"), "Bid was rejected by the authoritative auction transaction.");
  }

  const response = assertContractResponse(
    "AuthoritativeBidAccepted",
    {
      ok: true as const,
      authority: "postgresql" as const,
      auctionId: result.auctionId,
      bidId: result.bidId,
      bidderId: result.bidderId,
      amountCents: result.amountCents,
      currency: result.currency,
      sequence: result.sequence,
      acceptedAt: result.acceptedAt,
      replayed: result.replayed,
    },
    isAuthoritativeBidAcceptedResponse,
  );

  return Response.json(response, {
    status: result.replayed ? 200 : 201,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
