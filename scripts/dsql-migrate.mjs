// ============================================================================
// One-time DSQL migration (run BEFORE the app seeds). FR-A3.1.
// The proof script (dsql-setup.mjs) creates a `seats` table with uuid columns;
// the app (lib/db/dsql-data.ts) expects TEXT columns. The app no longer DROPs
// seats on init (that caused a cold-start race), so any pre-existing uuid table
// must be cleared once, here, before the app's CREATE TABLE IF NOT EXISTS runs.
//
// Run:  node scripts/dsql-migrate.mjs
// Idempotent: safe to run repeatedly (drops only if present).
// ============================================================================
import pg from "pg";
import { execFileSync } from "node:child_process";

const HOST = process.env.DSQL_ENDPOINT_US_EAST_1 || "fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws";
const REGION = "us-east-1";

function token() {
  return execFileSync(
    "aws",
    ["dsql", "generate-db-connect-admin-auth-token", "--hostname", HOST, "--region", REGION, "--expires-in", "3600", "--output", "text"],
    { encoding: "utf8" },
  ).trim();
}

const pool = new pg.Pool({
  host: HOST, port: 5432, user: "admin", database: "postgres",
  password: token(), ssl: { rejectUnauthorized: false }, max: 2,
});

try {
  console.log(`→ migrating ${HOST} …`);
  // drop the app-owned tables so the app re-creates them with the correct
  // (text) schema and re-seeds cleanly. Catalog/discovery data is re-seeded.
  for (const t of ["seats", "drop_slots", "waitlist", "events", "seed_marker"]) {
    await pool.query(`DROP TABLE IF EXISTS ${t}`);
    console.log(`   dropped ${t} (if existed)`);
  }
  console.log("✓ migration complete — app will re-create + seed on next start.");
} finally {
  await pool.end();
}
