// ============================================================================
// Discovery plane (Aurora PostgreSQL: PostGIS + pgvector). Models exactly what
// DSQL CANNOT do — geo radius + semantic vector search — which is precisely why
// the second database is forced (PRD §5, CLAUDE.md §4). Live availability is
// then JOINed from the DSQL ledger, with the top-K=20 / short-TTL discipline of
// PRD §4.2 M-2 (never a synchronous fan-out per card).
// ============================================================================

import { store } from "./sim/store";
import { embedQuery } from "./sim/store";
import { EventRow } from "./sim/types";

// PostGIS ST_DWithin analog — great-circle distance in km.
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both are unit vectors
}

export interface DiscoveryResult {
  event: EventRow;
  distance_km: number | null;
  score: number; // semantic similarity 0..1 (when a query is present)
  remaining_open: number;
  status: "live" | "soon" | "ended";
}

export interface DiscoveryParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  query?: string;
  limit?: number;
}

export function discover(p: DiscoveryParams): DiscoveryResult[] {
  const s = store();
  const now = Date.now();
  const qvec = p.query?.trim() ? embedQuery(p.query) : null;
  const limit = p.limit ?? 20; // top-K cap (PRD §4.2 M-2)

  let rows = s.events.map((event) => {
    const distance_km =
      p.lat != null && p.lng != null
        ? haversineKm(p.lat, p.lng, event.lat, event.lng)
        : null;
    const score = qvec ? cosine(qvec, event.embedding) : 0;
    return { event, distance_km, score };
  });

  // PostGIS radius predicate
  if (p.lat != null && p.lng != null && p.radiusKm) {
    rows = rows.filter(
      (r) => r.distance_km != null && r.distance_km <= p.radiusKm!,
    );
  }

  // rank: semantic first when a query is present, else by proximity, else by time
  rows.sort((a, b) => {
    if (qvec) return b.score - a.score;
    if (a.distance_km != null && b.distance_km != null)
      return a.distance_km - b.distance_km;
    return a.event.sale_opens_at - b.event.sale_opens_at;
  });

  // top-K, THEN join live availability from the DSQL ledger (bounded fan-out)
  return rows.slice(0, limit).map((r) => {
    const slot = s.slots.get(r.event.id);
    const remaining_open = slot ? s.ledger.remainingOpen(slot.id, now) : 0;
    const status: DiscoveryResult["status"] =
      r.event.sale_opens_at <= now
        ? remaining_open > 0
          ? "live"
          : "ended"
        : "soon";
    return { ...r, remaining_open, status };
  });
}
