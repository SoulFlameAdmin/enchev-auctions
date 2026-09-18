import { healthResponse } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return healthResponse("web", true, "healthy");
}
