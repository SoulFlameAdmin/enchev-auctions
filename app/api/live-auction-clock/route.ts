import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "enchev_live_demo_v2";
const LOT_DURATION_MS = 10_000;
const LOT_IDS = ["EA-10511", "EA-10539", "EA-10603", "EA-10627"] as const;
const BID_FEEDBACK_SEQUENCE = ["accepted", "leading", "outbid", "rejected"] as const;

type BidFeedback = (typeof BID_FEEDBACK_SEQUENCE)[number];

type SessionClockState = {
  lotIndex: number;
  roundEndsAt: number;
  bidSequence: number;
};

function decodeState(value?: string): SessionClockState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<SessionClockState>;
    if (!Number.isInteger(parsed.lotIndex) || typeof parsed.roundEndsAt !== "number") return null;
    const lotIndex = Number(parsed.lotIndex);
    if (lotIndex < 0 || lotIndex >= LOT_IDS.length || !Number.isFinite(parsed.roundEndsAt)) return null;
    const bidSequence = Number.isInteger(parsed.bidSequence) && Number(parsed.bidSequence) >= 0
      ? Number(parsed.bidSequence)
      : 0;
    return { lotIndex, roundEndsAt: parsed.roundEndsAt, bidSequence };
  } catch {
    return null;
  }
}

function normalizeState(input: SessionClockState | null, serverNow: number): SessionClockState {
  let state = input ?? { lotIndex: 0, roundEndsAt: serverNow + LOT_DURATION_MS, bidSequence: 0 };

  while (state.roundEndsAt <= serverNow) {
    state = {
      lotIndex: (state.lotIndex + 1) % LOT_IDS.length,
      roundEndsAt: state.roundEndsAt + LOT_DURATION_MS,
      bidSequence: 0,
    };
  }

  return state;
}

function payload(
  state: SessionClockState,
  serverNow: number,
  bidFeedback: BidFeedback | null = null,
  priceDelta = 0,
) {
  return {
    serverNow,
    roundEndsAt: state.roundEndsAt,
    durationMs: LOT_DURATION_MS,
    lotIndex: state.lotIndex,
    lotId: LOT_IDS[state.lotIndex],
    scope: "server-issued-browser-session-demo",
    auctionAuthority: false,
    bidFeedback,
    priceDelta,
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
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  if (body.action !== "bid") {
    return Response.json({ error: "unsupported-action" }, { status: 400 });
  }

  const store = await cookies();
  const serverNow = Date.now();
  const current = normalizeState(decodeState(store.get(COOKIE_NAME)?.value), serverNow);
  const feedback = BID_FEEDBACK_SEQUENCE[current.bidSequence % BID_FEEDBACK_SEQUENCE.length];
  const priceDelta = feedback === "rejected" ? 0 : 100;
  const state: SessionClockState = {
    ...current,
    roundEndsAt: serverNow + LOT_DURATION_MS,
    bidSequence: current.bidSequence + 1,
  };

  store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(state)), cookieOptions);

  return Response.json(payload(state, serverNow, feedback, priceDelta), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
