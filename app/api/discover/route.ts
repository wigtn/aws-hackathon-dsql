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
    plane: "aurora-postgresql · postgis + pgvector",
    count: results.length,
    results,
  });
}
