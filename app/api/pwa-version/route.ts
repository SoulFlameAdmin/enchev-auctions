export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "unversioned";
  return Response.json(
    { version, channel: process.env.VERCEL_ENV || "local", app: "E&A Auctions" },
    { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" } },
  );
}
