import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA = {
  heroDesktop: "https://forgeautomotive.co.uk/videos/hero-intro.af",
  heroMobile: "https://forgeautomotive.co.uk/videos/hero-mobile.af",
  introScroll: "https://forgeautomotive.co.uk/videos/intro-scroll.af",
  lineup: "https://forgeautomotive.co.uk/images/hero-depth/lineup.webp",
} as const;

type MediaKey = keyof typeof MEDIA;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("asset") as MediaKey | null;
  if (!key || !(key in MEDIA)) {
    return Response.json({ error: "Unknown media asset" }, { status: 404 });
  }

  const upstream = await fetch(MEDIA[key], {
    headers: { "User-Agent": "ENCHEV-Cinematic-Media/1.0" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return Response.json(
      { error: "Media upstream unavailable", status: upstream.status },
      { status: 502 }
    );
  }

  const bytes = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type") ||
    (key === "lineup" ? "image/webp" : "application/octet-stream");

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
