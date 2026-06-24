// ============================================================================
// Real discovery ranking on Aurora PostgreSQL. Runs the two operations DSQL
// cannot: PostGIS ST_DWithin (radius filter + great-circle distance) and
// pgvector cosine ranking (embedding <=> query, HNSW-indexed). Returns the
// top-K event ids in rank order; live seat stock is then JOINed from the seat
// plane by the route (PRD §4.2 M-2 bounded fan-out). This file owns geo+meaning;
// the seat ledger owns availability — the dual-DB split made literal.
// ============================================================================
import { pgPool } from "./pg";
import { embedQuery } from "@/lib/sim/store";
import type { DiscoveryParams } from "@/lib/discovery";

export interface PgRanked {
  id: string;
  distance_km: number | null;
  score: number;
}

const toVector = (v: number[]) => `[${v.join(",")}]`;

// Ranked, radius-filtered, top-K — computed entirely in Aurora PostgreSQL.
export async function pgDiscover(p: DiscoveryParams): Promise<PgRanked[]> {
  const limit = p.limit ?? 20;
  const hasGeo = p.lat != null && p.lng != null;
  const qvec = p.query?.trim() ? embedQuery(p.query) : null;

  const params: unknown[] = [];
  const bind = (val: unknown) => `$${params.push(val)}`;

  // geography point for the user's location (SRID 4326 = WGS84)
  const pt = hasGeo
    ? `ST_SetSRID(ST_MakePoint(${bind(p.lng)}, ${bind(p.lat)}), 4326)::geography`
    : null;
  const vec = qvec ? `${bind(toVector(qvec))}::vector` : null;

  const distanceSel = pt ? `ST_Distance(venue_geom, ${pt}) / 1000.0` : "NULL";
  const scoreSel = vec ? `1 - (embedding <=> ${vec})` : "0";

  const where: string[] = ["venue_geom IS NOT NULL"];
  if (pt && p.radiusKm) where.push(`ST_DWithin(venue_geom, ${pt}, ${bind(p.radiusKm * 1000)})`);

  // rank: semantic when a query is present, else proximity, else sale time
  const orderBy = vec
    ? `embedding <=> ${vec} ASC`
    : pt
      ? `ST_Distance(venue_geom, ${pt}) ASC`
      : `sale_opens_at ASC`;

  const sql = `
    SELECT id,
           ${distanceSel} AS distance_km,
           ${scoreSel}    AS score
      FROM events
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT ${bind(limit)}`;

  const r = await pgPool().query(sql, params);
  return r.rows.map((row) => ({
    id: String(row.id),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    score: Number(row.score),
  }));
}
