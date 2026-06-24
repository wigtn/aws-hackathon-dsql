import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { REGION_MODE } from "@/lib/db";

// GET /api/org/metrics?eventId=  → B2B operator metrics for one drop:
// revenue, sell-through, region split, and the MODELED "revenue defended"
// (oversell + resale). Defended figures are labeled as estimates in the UI.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const m = await getData().metrics(eventId);
  if (!m) return NextResponse.json({ error: "unknown event" }, { status: 404 });
  // FR-A1: report the real topology so the console never claims active-active
  // multi-region when only one endpoint (or the simulation) is live.
  return NextResponse.json({ ...m, region_mode: REGION_MODE });
}
