// ============================================================================
// Data-plane selector. OpenSlot is dual-DB by deliberate design (PRD §5):
//
//   • Aurora DSQL  — multi-region active-active strong-consistency seat ledger.
//                    The ONLY engine that gives zero-oversell cross-region
//                    writes. Reached via the postgres wire protocol + IAM token.
//   • Aurora PostgreSQL — discovery plane: PostGIS (radius) + pgvector (semantic).
//                    Extensions DSQL does not support → Postgres is forced.
//
// For the hackathon demo the default plane is a deterministic in-memory
// SIMULATION that reproduces DSQL's OCC / strong-consistency semantics exactly
// (see lib/sim/*). The real adapters activate automatically when the env vars
// below are present, with NO call-site changes — the ledger SQL is a 1:1
// translation of SeatLedger.commitClaim. The DSQL claim uses a single-statement
// conditional UPDATE (its own valid form of OCC): a lost race returns rowCount=0
// and is retried; OC000 is thrown only on same-row contention. withOccRetry
// (lib/occ.ts) is available for multi-statement transactions; the proof script
// (scripts/dsql-setup.mjs) exercises real OC000 under a barrier stampede.
// ============================================================================

export const DATA_PLANE: "aurora" | "simulation" =
  process.env.DSQL_ENDPOINT_US_EAST_1 ? "aurora" : "simulation";

// Multi-region is real ONLY when BOTH regional endpoints are configured. We
// never silently degrade: when only one endpoint is set, the app still works
// but every surface reports region_mode="single" honestly (FR-A1 / PRD §9 C-2).
export const MULTI_REGION: boolean = !!(
  process.env.DSQL_ENDPOINT_US_EAST_1 && process.env.DSQL_ENDPOINT_US_EAST_2
);
export const REGION_MODE: "multi" | "single" | "simulation" =
  DATA_PLANE !== "aurora" ? "simulation" : MULTI_REGION ? "multi" : "single";

export function activeRegions(): ("us-east-1" | "us-east-2")[] {
  const r: ("us-east-1" | "us-east-2")[] = [];
  if (process.env.DSQL_ENDPOINT_US_EAST_1) r.push("us-east-1");
  if (process.env.DSQL_ENDPOINT_US_EAST_2) r.push("us-east-2");
  return r.length ? r : ["us-east-1"];
}

export interface DsqlConfig {
  endpointEast1?: string; // us-east-1 regional endpoint
  endpointEast2?: string; // us-east-2 regional endpoint
  witnessRegion: string; // us-west-2 (no endpoint, quorum tiebreaker)
  database: string;
}

export const dsqlConfig: DsqlConfig = {
  endpointEast1: process.env.DSQL_ENDPOINT_US_EAST_1,
  endpointEast2: process.env.DSQL_ENDPOINT_US_EAST_2,
  witnessRegion: process.env.DSQL_WITNESS_REGION ?? "us-west-2",
  database: process.env.DSQL_DATABASE ?? "postgres",
};

/**
 * The production ledger claim, expressed as the exact DSQL statement the
 * simulation models. Kept here as living documentation + the seam the real
 * `pg` adapter fills. (Bind: $seat_id, $buyer, $version, $region.)
 */
export const DSQL_CLAIM_SQL = /* sql */ `
  UPDATE seats
     SET buyer_id        = $1,
         status          = 'held',
         version         = version + 1,
         region          = $2,
         hold_expires_at = now() + interval '120 seconds',
         claimed_at      = now()
   WHERE id        = $3
     AND version   = $4            -- read-set check-and-set → OC000 on conflict
     AND buyer_id  IS NULL
     AND status    = 'open'
     AND (reserved_for IS NULL OR reserved_for = $1 OR reserved_until < now())
  RETURNING seat_no;
`;
