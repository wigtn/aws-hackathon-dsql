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
    // Real geo+semantic ranking from Aurora PG, then join live stock by event id.
    const ranked = await pgDiscover(params);
    const stock = await getData().discover({ limit: 10_000 });
    const byId = new Map(stock.map((r) => [r.event.id, r]));
    results = ranked
      .map((pr) => {
        const base = byId.get(pr.id);
        return base ? { ...base, distance_km: pr.distance_km, score: pr.score } : null;
      })
      .filter((r): r is DiscoveryResult => r !== null);
    plane = "aurora-postgresql · postgis + pgvector";
  } else {
    results = await getData().discover(params);
    plane = "simulation · models postgis + pgvector";
  }

  return NextResponse.json({ plane, count: results.length, results });
}
