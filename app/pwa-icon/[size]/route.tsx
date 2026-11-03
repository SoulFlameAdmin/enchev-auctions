import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: rawSize } = await params;
  if (rawSize !== "192" && rawSize !== "512") {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const size = Number(rawSize);
  return new ImageResponse(
    <div style={{
      display: "flex", position: "relative", width: "100%", height: "100%",
      alignItems: "center", justifyContent: "center", flexDirection: "column",
      background: "linear-gradient(148deg,#203327 0%,#080b0a 49%,#040605 100%)",
      color: "#f4dc9d", borderRadius: size * 0.19,
    }}>
      <div style={{
        position: "absolute", top: size * .0625, left: size * .0625, right: size * .0625,
        bottom: size * .0625, borderRadius: size * .16,
        border: Math.max(2,Math.round(size*.012)) + "px solid #c9a160", display: "flex",
      }} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", 
        fontSize: size * .32, fontWeight: 900, letterSpacing: "-0.06em",
        textShadow: "0 3px 12px rgba(0,0,0,.6)", lineHeight: 1,
      }}>E&amp;A</div>
      <div style={{
        display: "flex", fontSize: size * .045, fontWeight: 800,
        letterSpacing: size * .004, marginTop: size * .04, color: "#e6e9e4",
      }}>AUCTIONS</div>
      <div style={{
        position: "absolute", bottom: size * .14, left: size * .25, right: size * .25,
        height: size * .006, background: "#3ed47c", borderRadius: 999, display: "flex",
      }} />
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
