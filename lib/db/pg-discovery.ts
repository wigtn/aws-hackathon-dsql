// ============================================================================
// Real discovery ranking on Aurora PostgreSQL. Runs the two operations DSQL
// cannot: PostGIS ST_DWithin (radius filter + great-circle distance) and
// pgvector cosine ranking (embedding <=> query, HNSW-indexed). Returns the
// ranked top-K events; live seat stock is JOINed for exactly those ids by the
// route (bounded fan-out, PRD §4.2 M-2). This file owns geo+meaning; the seat
// ledger owns availability — the dual-DB split made literal.
// ============================================================================
import { pgPool } from "./pg";
import { embedQuery } from "@/lib/sim/store";
import type { DiscoveryParams } from "@/lib/discovery";
import type { EventCategory, EventRow } from "@/lib/sim/types";

export interface PgRanked {
  event: EventRow;
  distance_km: number | null;
  score: number;
}

const toVector = (v: number[]) => `[${v.join(",")}]`;

function pgRowToEvent(r: Record<string, unknown>): EventRow {
  return {
    id: String(r.id),
    organizer_id: String(r.organizer_id ?? ""),
    organizer_name: String(r.organizer_name ?? ""),
    title: String(r.title ?? ""),
    subtitle: String(r.subtitle ?? ""),
    category: String(r.category ?? "concert") as EventCategory,
    venue: String(r.venue ?? ""),
    city: String(r.city ?? ""),
    country: String(r.country ?? ""),
    lat: Number(r.lat),
    lng: Number(r.lng),
    sale_opens_at: Number(r.sale_opens_at), // PG bigint arrives as string
    embedding: [], // not needed downstream; PG owns ranking, app never re-scores
    price: Number(r.price),
    resale_markup: Number(r.resale_markup),
  };
}

// Ranked, radius-filtered, top-K — computed entirely in Aurora PostgreSQL.
export async function pgDiscover(p: DiscoveryParams): Promise<PgRanked[]> {
  const limit = p.limit ?? 20;
  const hasGeo = p.lat != null && p.lng != null;
  const qvec = p.query?.trim() ? embedQuery(p.query) : null;

  const params: unknown[] = [];
  const bind = (val: unknown) => `$${params.push(val)}`;

  // SAFETY: every ${…} fragment spliced into the SQL below MUST be either a
  // bind() placeholder or a fixed literal. No raw user value is ever
  // interpolated — lat/lng/radius/vector/limit all go through bind() into
  // params[]. Keep it that way: new predicates must use bind(), never a
  // template of a user value (review M1).
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
    SELECT *,
           ${distanceSel} AS distance_km,
           ${scoreSel}    AS score
      FROM events
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT ${bind(limit)}`;

  const r = await pgPool().query(sql, params);
  return r.rows.map((row) => ({
    event: pgRowToEvent(row),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    score: Number(row.score),
  }));
}
