import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { DISCOVERY_PLANE } from "@/lib/db/pg";
import { pgDiscover } from "@/lib/db/pg-discovery";
import type { DiscoveryResult } from "@/lib/discovery";

// GET /api/discover?lat=&lng=&radiusKm=&q=
// Geo radius (PostGIS ST_DWithin) + semantic rank (pgvector <=>) on Aurora
// PostgreSQL when AURORA_PG_URL is set; otherwise the deterministic model. Live
// seat stock is JOINed from the seat plane (DSQL/sim). The `plane` field reports
// what actually ran — never a real-plane claim when on the simulation (FR-A1).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) =>
    sp.get(k) != null && sp.get(k) !== "" ? Number(sp.get(k)) : undefined;

  const params = {
    lat: num("lat"),
    lng: num("lng"),
    radiusKm: num("radiusKm"),
    query: sp.get("q") ?? undefined,
    limit: num("limit") ?? 20,
  };

  let results: DiscoveryResult[];
  let plane: string;

  if (DISCOVERY_PLANE === "aurora-postgresql") {
    // Real geo+semantic ranking from Aurora PG; join live stock for the ranked
    // top-K only (bounded — never the whole catalog). Events with no seat-plane
    // row surface as 0 open rather than being silently dropped (review M2/m1).
    const ranked = await pgDiscover(params);
    const stock = await getData().remainingFor(ranked.map((r) => r.event.id));
    const now = Date.now();
    results = ranked.map((r) => {
      const remaining_open = stock[r.event.id] ?? 0;
      const status: DiscoveryResult["status"] =
        r.event.sale_opens_at <= now ? (remaining_open > 0 ? "live" : "ended") : "soon";
      return { event: r.event, distance_km: r.distance_km, score: r.score, remaining_open, status };
    });
    plane = "aurora-postgresql · postgis + pgvector";
  } else {
    results = await getData().discover(params);
    plane = "simulation · models postgis + pgvector";
  }

  return NextResponse.json({ plane, count: results.length, results });
}
