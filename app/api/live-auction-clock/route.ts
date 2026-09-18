import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "enchev_live_demo_v1";
const LOT_DURATION_MS = 10_000;
const LOT_IDS = ["EA-10511", "EA-10539", "EA-10603", "EA-10627"] as const;
const LOT_BASE_BIDS = [18400, 21900, 16250, 15100] as const;

type SessionClockState = {
  lotIndex: number;
  roundEndsAt: number;
  currentBid: number;
  bidSequence: number;
};

function decodeState(value?: string): SessionClockState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<SessionClockState>;
    if (!Number.isInteger(parsed.lotIndex) || typeof parsed.roundEndsAt !== "number") return null;
    const lotIndex = Number(parsed.lotIndex);
    if (lotIndex < 0 || lotIndex >= LOT_IDS.length) return null;
    return {
      lotIndex,
      roundEndsAt: parsed.roundEndsAt,
      currentBid: typeof parsed.currentBid === "number" && Number.isFinite(parsed.currentBid)
        ? parsed.currentBid
        : LOT_BASE_BIDS[lotIndex],
      bidSequence: Number.isInteger(parsed.bidSequence) && Number(parsed.bidSequence) >= 0
        ? Number(parsed.bidSequence)
        : 0,
    };
  } catch {
    return null;
  }
}

function normalizeState(input: SessionClockState | null, serverNow: number): SessionClockState {
  let state =
    input && input.lotIndex >= 0 && input.lotIndex < LOT_IDS.length && Number.isFinite(input.roundEndsAt)
      ? { ...input }
      : {
          lotIndex: 0,
          roundEndsAt: serverNow + LOT_DURATION_MS,
          currentBid: LOT_BASE_BIDS[0],
          bidSequence: 0,
        };

  while (state.roundEndsAt <= serverNow) {
    const nextIndex = (state.lotIndex + 1) % LOT_IDS.length;
    state = {
      lotIndex: nextIndex,
      roundEndsAt: state.roundEndsAt + LOT_DURATION_MS,
      currentBid: LOT_BASE_BIDS[nextIndex],
      bidSequence: 0,
    };
  }

  return state;
}

function payload(
  state: SessionClockState,
  serverNow: number,
  extra: Record<string, unknown> = {},
) {
  return {
    serverNow,
    roundEndsAt: state.roundEndsAt,
    durationMs: LOT_DURATION_MS,
    lotIndex: state.lotIndex,
    lotId: LOT_IDS[state.lotIndex],
    currentBid: state.currentBid,
    bidSequence: state.bidSequence,
    minimumBid: state.currentBid + 100,
    scope: "server-issued-browser-session-demo",
    ...extra,
  };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};

export async function GET() {
  const store = await cookies();
  const serverNow = Date.now();
  const state = normalizeState(decodeState(store.get(COOKIE_NAME)?.value), serverNow);

  store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(state)), cookieOptions);

  return Response.json(payload(state, serverNow), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  let body: { action?: string; lotId?: string; bidAmount?: number };
  try {
    body = (await request.json()) as { action?: string; lotId?: string; bidAmount?: number };
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  if (body.action !== "bid") {
    return Response.json({ error: "unsupported-action" }, { status: 400 });
  }

  const store = await cookies();
  const serverNow = Date.now();
  const current = normalizeState(decodeState(store.get(COOKIE_NAME)?.value), serverNow);
  const currentLotId = LOT_IDS[current.lotIndex];

  if (body.lotId !== currentLotId) {
    store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(current)), cookieOptions);
    return Response.json(
      payload(current, serverNow, { outcome: "rejected", reason: "stale-lot" }),
      { status: 409, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const bidAmount = Number(body.bidAmount);
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return Response.json(
      payload(current, serverNow, { outcome: "rejected", reason: "invalid-bid" }),
      { status: 422, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const minimumBid = current.currentBid + 100;
  if (bidAmount < minimumBid) {
    store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(current)), cookieOptions);
    return Response.json(
      payload(current, serverNow, { outcome: "rejected", reason: "bid-too-low" }),
      { status: 409, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const state: SessionClockState = {
    ...current,
    currentBid: bidAmount,
    bidSequence: current.bidSequence + 1,
    roundEndsAt: serverNow + LOT_DURATION_MS,
  };

  store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(state)), cookieOptions);

  return Response.json(payload(state, serverNow, { outcome: "accepted" }), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
