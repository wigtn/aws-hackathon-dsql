// ============================================================================
// Aurora PostgreSQL pool — the DISCOVERY plane (PostGIS + pgvector). This is the
// second, deliberately-distinct engine of OpenSlot's dual-DB design: geo radius
// (ST_DWithin) and semantic ranking (vector <=> cosine) are extensions Aurora
// DSQL does NOT support, so a real Postgres is forced (CLAUDE.md §4, PRD §5).
//
// Activates automatically when AURORA_PG_URL is set; otherwise discovery stays
// on the deterministic in-memory model (lib/discovery.ts). We NEVER claim the
// real plane when it isn't wired — DISCOVERY_PLANE is keyed on the same env var
// that selects the adapter, so the displayed plane can't disagree (FR-A1 honesty
// discipline, applied to the discovery surface).
// ============================================================================
import { Pool } from "pg";

export const DISCOVERY_PLANE: "aurora-postgresql" | "simulation" =
  process.env.AURORA_PG_URL ? "aurora-postgresql" : "simulation";

// One pool per server process, stashed on globalThis so HMR / multiple route
// modules share it (mirrors the DSQL adapter's pooling discipline).
const g = globalThis as unknown as { __openslot_pg?: Pool };

export function pgPool(): Pool {
  if (!process.env.AURORA_PG_URL) {
    throw new Error("AURORA_PG_URL not set — discovery is on the simulation plane");
  }
  if (!g.__openslot_pg) {
    g.__openslot_pg = new Pool({
      connectionString: process.env.AURORA_PG_URL,
      // Aurora endpoints terminate TLS with the AWS RDS CA; for the demo we
      // accept the chain without bundling the cert (same posture as the DSQL
      // adapter). Tighten with `ssl: { ca }` for production.
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return g.__openslot_pg;
}
