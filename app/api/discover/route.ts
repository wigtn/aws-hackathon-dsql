import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";

// GET /api/discover?lat=&lng=&radiusKm=&q=
// PostGIS radius + pgvector semantic rank → top-K joined with live DSQL stock.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) =>
    sp.get(k) != null && sp.get(k) !== "" ? Number(sp.get(k)) : undefined;

  const results = await getData().discover({
    lat: num("lat"),
    lng: num("lng"),
    radiusKm: num("radiusKm"),
    query: sp.get("q") ?? undefined,
    limit: num("limit") ?? 20,
  });

  return NextResponse.json({
    // honest: real Aurora PG (PostGIS/pgvector) only when AURORA_PG_URL is set;
    // otherwise this is the in-app discovery model (geo radius + semantic).
    plane: process.env.AURORA_PG_URL
      ? "aurora-postgresql · postgis + pgvector"
      : "discovery model · geo radius + semantic (Aurora PG pending)",
    count: results.length,
    results,
  });
}
