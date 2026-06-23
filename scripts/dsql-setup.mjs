// ============================================================================
// Real Aurora DSQL multi-region setup + cross-region OCC proof (LAB-38 / LAB-42).
// Applies the seat-ledger schema, then fires a worldwide rush at the LAST seat
// from BOTH regional endpoints at once. Proves on real infrastructure what the
// simulation models: exactly one winner, the rest get OC000, zero double-sell,
// and the result is strong-consistent across regions instantly.
//
// Run:  node scripts/dsql-setup.mjs
// Auth: IAM admin token via aws CLI (no static password).
// ============================================================================
import pg from "pg";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const REGIONS = {
  "us-east-1": "fjt32vzqea4jm366gb2ssonbiq.dsql.us-east-1.on.aws",
  "us-east-2": "5rt32vy2c7qvvcptxzxsjjwiji.dsql.us-east-2.on.aws",
};

function authToken(region, host) {
  return execFileSync(
    "aws",
    ["dsql", "generate-db-connect-admin-auth-token", "--hostname", host,
      "--region", region, "--expires-in", "3600", "--output", "text"],
    { encoding: "utf8" },
  ).trim();
}

function makePool(region) {
  const host = REGIONS[region];
  return new pg.Pool({
    host, port: 5432, user: "admin", database: "postgres",
    password: authToken(region, host),
    ssl: { rejectUnauthorized: false },
    max: 30,
    connectionTimeoutMillis: 10000,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const e1 = makePool("us-east-1");
const e2 = makePool("us-east-2");

try {
  // ---- 1. schema (one logical DB; written via us-east-1, visible in both) ----
  console.log("→ applying schema on us-east-1 …");
  await e1.query(`
    CREATE TABLE IF NOT EXISTS seats (
      id              uuid PRIMARY KEY,
      slot_id         uuid NOT NULL,
      seat_no         int  NOT NULL,
      section         text,
      row_label       text,
      buyer_id        uuid,
      status          text NOT NULL DEFAULT 'open',
      version         int  NOT NULL DEFAULT 1,
      region          text,
      reserved_for    uuid,
      reserved_until  timestamptz,
      hold_expires_at timestamptz,
      claimed_at      timestamptz
    )`);
  // DSQL secondary indexes are async; create then wait for ACTIVE via sys.jobs
  try {
    await e1.query(`CREATE UNIQUE INDEX ASYNC ux_seat ON seats (slot_id, seat_no)`);
    console.log("→ ux_seat ASYNC index requested");
  } catch (e) {
    if (/already exists/i.test(e.message)) console.log("→ ux_seat already exists");
    else throw e;
  }

  // best-effort: poll sys.jobs until the index job is no longer pending
  for (let i = 0; i < 15; i++) {
    try {
      const j = await e1.query(
        `SELECT status FROM sys.jobs WHERE job_type LIKE '%INDEX%' ORDER BY start_time DESC LIMIT 1`,
      );
      const st = j.rows[0]?.status ?? "(none)";
      if (i === 0 || st !== "(none)") console.log(`   sys.jobs index status: ${st}`);
      if (/ACTIVE|COMPLETED|SUCCEED/i.test(st) || st === "(none)") break;
    } catch {
      break; // sys.jobs shape varies; don't block the proof on it
    }
    await sleep(2000);
  }

  // ---- 2. seed a fresh LAST seat (capacity = 1) ----
  const slot = randomUUID();
  const seatId = randomUUID();
  await e1.query(
    `INSERT INTO seats (id, slot_id, seat_no, section, row_label, status, version)
     VALUES ($1, $2, 1, 'GA', 'A', 'open', 1)`,
    [seatId, slot],
  );
  console.log(`→ seeded 1 open seat (slot ${slot.slice(0, 8)}…)`);

  // verify strong-consistent visibility from the OTHER region before the rush
  const pre = await e2.query(`SELECT status FROM seats WHERE id=$1`, [seatId]);
  console.log(`→ us-east-2 sees the new seat immediately: status=${pre.rows[0]?.status}`);

  // ---- 3. cross-region stampede at the single seat ----
  const K = 24; // buyers, split across both regional endpoints
  console.log(`\n→ firing ${K} concurrent claims across us-east-1 + us-east-2 …`);

  // Two-phase barrier so the contention is REAL, not timing luck:
  //   phase 1 — every buyer opens a txn and reads the seat at version=1
  //             (all snapshots taken before anyone writes)
  //   phase 2 — everyone commits an UPDATE guarded by that version at once
  // OCC then detects the overlapping read-set and throws OC000 for all but the
  // first to commit. Mirrors the app's probe-then-claim under a stampede.
  const buyers = Array.from({ length: K }, (_, i) => ({
    region: i % 2 ? "us-east-2" : "us-east-1",
    pool: i % 2 ? e2 : e1,
    buyer: randomUUID(),
  }));

  // phase 1: open txn + snapshot read (hold the connection)
  const ctx = await Promise.all(
    buyers.map(async (b) => {
      const c = await b.pool.connect();
      await c.query("BEGIN");
      const snap = await c.query(`SELECT version FROM seats WHERE id=$1`, [seatId]);
      return { ...b, c, v: snap.rows[0]?.version };
    }),
  );

  // phase 2: all commit concurrently → first wins, rest OC000
  const results = await Promise.all(
    ctx.map(async ({ region, buyer, c, v }) => {
      const t0 = Date.now();
      try {
        const r = await c.query(
          `UPDATE seats
              SET buyer_id=$1, status='held', version=version+1, region=$2,
                  claimed_at=now(), hold_expires_at=now()+interval '120 seconds'
            WHERE id=$3 AND version=$4 AND status='open' AND buyer_id IS NULL`,
          [buyer, region, seatId, v],
        );
        await c.query("COMMIT"); // OC000 surfaces here for losers
        return { region, won: r.rowCount === 1, ms: Date.now() - t0 };
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        return {
          region, won: false,
          oc000: /OC000|change conflicts/i.test(e.message),
          err: e.message.split("\n")[0], ms: Date.now() - t0,
        };
      } finally {
        c.release();
      }
    }),
  );

  const winners = results.filter((r) => r.won);
  const oc000 = results.filter((r) => r.oc000).length;
  const zeroRow = results.filter((r) => !r.won && !r.oc000 && !r.err).length;
  const otherErr = results.filter((r) => r.err && !r.oc000);

  // ---- 4. strong-consistency read from BOTH regions ----
  const [r1, r2] = await Promise.all([
    e1.query(`SELECT buyer_id, status, region FROM seats WHERE id=$1`, [seatId]),
    e2.query(`SELECT buyer_id, status, region FROM seats WHERE id=$1`, [seatId]),
  ]);

  console.log("\n========== REAL AURORA DSQL · CROSS-REGION PROOF ==========");
  console.log(`buyers (both regions):     ${K}`);
  console.log(`winners:                   ${winners.length}   ${winners.length === 1 ? "✓ exactly one" : "✗ EXPECTED 1"}`);
  console.log(`OC000 conflicts:           ${oc000}`);
  console.log(`no-op (lost the row):      ${zeroRow}`);
  console.log(`oversold (double-sell):    ${winners.length - 1 > 0 ? winners.length - 1 : 0}   ${winners.length <= 1 ? "✓ ZERO" : "✗"}`);
  console.log(`winning region:            ${winners[0]?.region ?? "—"}`);
  console.log("\nstrong-consistent read of the same seat from both endpoints:");
  console.log(`  us-east-1 → status=${r1.rows[0].status}, buyer=${String(r1.rows[0].buyer_id).slice(0, 8)}…, region=${r1.rows[0].region}`);
  console.log(`  us-east-2 → status=${r2.rows[0].status}, buyer=${String(r2.rows[0].buyer_id).slice(0, 8)}…, region=${r2.rows[0].region}`);
  const consistent =
    r1.rows[0].buyer_id === r2.rows[0].buyer_id && r1.rows[0].status === r2.rows[0].status;
  console.log(`  → identical across regions: ${consistent ? "✓ YES (RPO 0, stale read 0)" : "✗ NO"}`);
  if (otherErr.length) console.log(`\nnote: ${otherErr.length} non-OC000 errors, e.g. ${otherErr[0].err}`);
  console.log("===========================================================");

  const pass = winners.length === 1 && consistent;
  console.log(pass ? "\nRESULT: PASS — zero oversell on real multi-region DSQL." : "\nRESULT: CHECK ABOVE");
  process.exitCode = pass ? 0 : 1;
} finally {
  await e1.end();
  await e2.end();
}
