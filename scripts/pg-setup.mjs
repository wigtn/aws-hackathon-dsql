// ============================================================================
// Aurora PostgreSQL — DISCOVERY plane setup + proof (FR-C1 / LAB-39).
// Enables the two extensions Aurora DSQL CANNOT run — PostGIS + pgvector — then
// proves them on real infrastructure: a GiST-indexed ST_DWithin radius filter
// and an HNSW-indexed vector <=> cosine ranking over the live event catalog.
// This is the second AWS-DB screenshot and the literal justification for the
// dual-DB design (CLAUDE.md §4, PRD §5).
//
// Run:  AURORA_PG_URL='postgresql://USER:PASS@HOST:5432/postgres' node scripts/pg-setup.mjs
// (Provision the cluster first — see docs/AWS.md "Aurora PostgreSQL".)
// ============================================================================
import pg from "pg";
// Same embedding logic the app uses — shared module, not a copy (review M3),
// so PROOF B ranks with exactly the live query vectors.
import { embed, embedQuery } from "../lib/embedding.mjs";

const URL = process.env.AURORA_PG_URL;
if (!URL) {
  console.error("AURORA_PG_URL not set. See docs/AWS.md → Aurora PostgreSQL.");
  process.exit(2);
}

const vec = (arr) => `[${arr.join(",")}]`;

// ---- catalog — same ids/coords/weights as the seat plane (join-compatible) ---
const MIN = 60_000;
const now = Date.now();
const CATALOG = [
  { id: "ev-eras-seoul", organizer_id: "org-tne", organizer_name: "Transcend Live", title: "AURORA NIGHTS — The Final Show", subtitle: "Seoul · last-seat release", category: "concert", venue: "Goyang Stadium", city: "Seoul", country: "KR", lat: 37.6708, lng: 126.7794, opens: now - 5 * MIN, price: 180, resale_markup: 4.5, w: { pop: 2, arena: 1.5, global: 1, weekend: 1 } },
  { id: "ev-kpop-world", organizer_id: "org-hybe", organizer_name: "Hallyu Touring", title: "SKYLINE HORIZON World Tour", subtitle: "Global on-sale · 18 cities", category: "concert", venue: "KSPO Dome", city: "Seoul", country: "KR", lat: 37.5202, lng: 127.1262, opens: now - 1 * MIN, price: 120, resale_markup: 5.0, w: { kpop: 2, global: 1.5, arena: 1 } },
  { id: "ev-labubu", organizer_id: "org-popmart", organizer_name: "Charm Lab", title: "LUMA · Blind-Box Restock", subtitle: "Limited drop · 1 per buyer", category: "drop", venue: "Online + Hongdae flagship", city: "Seoul", country: "KR", lat: 37.5563, lng: 126.9236, opens: now - 2 * MIN, price: 45, resale_markup: 6.0, w: { collectible: 2, gaming: 0.6, weekend: 1, global: 1 } },
  { id: "ev-snkrs", organizer_id: "org-nike", organizer_name: "DropZone", title: "PHANTOM 92 · Vault Release", subtitle: "Global drop · regional allocation", category: "drop", venue: "DropZone App", city: "Global", country: "US", lat: 40.7128, lng: -74.006, opens: now - 3 * MIN, price: 200, resale_markup: 3.5, w: { sneakers: 2, collectible: 1.2, global: 1.5 } },
  { id: "ev-indie", organizer_id: "org-club", organizer_name: "Club Plankton", title: "Slow Static + The Hours", subtitle: "Indie night · Itaewon", category: "concert", venue: "Club Plankton", city: "Seoul", country: "KR", lat: 37.5345, lng: 126.9946, opens: now + 20 * MIN, price: 35, resale_markup: 2.5, w: { indie: 2, rock: 1, club: 1.5, weekend: 1.5 } },
  { id: "ev-cup-final", organizer_id: "org-fa", organizer_name: "Continental Cup", title: "Continental Cup — Final", subtitle: "Knockout · category 1", category: "sports", venue: "Seoul World Cup Stadium", city: "Seoul", country: "KR", lat: 37.5683, lng: 126.8973, opens: now + 30 * MIN, price: 90, resale_markup: 4.0, w: { sports: 2, arena: 1.5, global: 1 } },
];

const pool = new pg.Pool({ connectionString: URL, ssl: { rejectUnauthorized: false }, max: 5, connectionTimeoutMillis: 15_000 });

try {
  // ---- 1. extensions — the whole reason this engine exists alongside DSQL ----
  console.log("→ enabling extensions (postgis, vector) …");
  await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  const ext = await pool.query(
    "SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis','vector') ORDER BY extname",
  );
  for (const e of ext.rows) console.log(`   ✓ ${e.extname} ${e.extversion}`);

  // ---- 2. schema: geography point + 12-dim vector, GiST + HNSW indexes -------
  console.log("→ creating events table + spatial/vector indexes …");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id             text PRIMARY KEY,
      organizer_id   text,
      organizer_name text,
      title          text,
      subtitle       text,
      category       text,
      venue          text,
      city           text,
      country        text,
      lat            double precision,
      lng            double precision,
      venue_geom     geography(Point, 4326),
      sale_opens_at  bigint,
      price          int,
      resale_markup  double precision,
      embedding      vector(12),
      created_at     bigint
    )`);
  await pool.query("CREATE INDEX IF NOT EXISTS ix_events_geom ON events USING GIST (venue_geom)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_events_embedding ON events USING hnsw (embedding vector_cosine_ops)");
  console.log("   ✓ GiST(venue_geom) + HNSW(embedding vector_cosine_ops)");

  // ---- 3. seed the catalog (idempotent) -------------------------------------
  console.log(`→ seeding ${CATALOG.length} events …`);
  for (const e of CATALOG) {
    await pool.query(
      `INSERT INTO events
         (id, organizer_id, organizer_name, title, subtitle, category, venue, city, country,
          lat, lng, venue_geom, sale_opens_at, price, resale_markup, embedding, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               ST_SetSRID(ST_MakePoint($11,$10),4326)::geography,
               $12,$13,$14,$15::vector,$16)
       ON CONFLICT (id) DO UPDATE SET
         venue_geom=EXCLUDED.venue_geom, embedding=EXCLUDED.embedding,
         sale_opens_at=EXCLUDED.sale_opens_at, title=EXCLUDED.title`,
      [e.id, e.organizer_id, e.organizer_name, e.title, e.subtitle, e.category, e.venue, e.city, e.country,
        e.lat, e.lng, e.opens, e.price, e.resale_markup, vec(embed(e.w)), now],
    );
  }

  // ---- 4. PROOF A — PostGIS radius (50 km around central Seoul) --------------
  const SEOUL = { lat: 37.5563, lng: 126.976 };
  const pt = `ST_SetSRID(ST_MakePoint(${SEOUL.lng},${SEOUL.lat}),4326)::geography`;
  const geo = await pool.query(
    `SELECT title, city,
            ROUND((ST_Distance(venue_geom, ${pt}) / 1000)::numeric, 1) AS km
       FROM events
      WHERE ST_DWithin(venue_geom, ${pt}, 50000)
      ORDER BY km ASC`,
  );
  console.log("\n========== PROOF A · PostGIS ST_DWithin (≤ 50 km of Seoul) ==========");
  for (const r of geo.rows) console.log(`  ${String(r.km).padStart(5)} km  ${r.title}  [${r.city}]`);
  const geoIds = geo.rows.map((r) => r.title);
  const excludesNYC = !geoIds.some((t) => t.includes("PHANTOM")); // the NYC drop is out of range

  // ---- 5. PROOF B — pgvector semantic rank (the app's own query) -------------
  const QUERY = "indie show this weekend near me";
  const qv = vec(embedQuery(QUERY));
  const sem = await pool.query(
    `SELECT title,
            ROUND((1 - (embedding <=> $1::vector))::numeric, 3) AS similarity
       FROM events
      ORDER BY embedding <=> $1::vector ASC
      LIMIT 5`,
    [qv],
  );
  console.log(`\n========== PROOF B · pgvector cosine rank — "${QUERY}" ==========`);
  for (const r of sem.rows) console.log(`  ${String(r.similarity).padStart(6)}  ${r.title}`);
  const top1 = sem.rows[0]?.title ?? "";
  const semOk = top1.includes("Slow Static");

  // ---- 6. verdict ------------------------------------------------------------
  console.log("\n====================================================================");
  console.log(`PostGIS radius excludes out-of-range (NYC drop): ${excludesNYC ? "✓" : "✗"}`);
  console.log(`pgvector ranks the indie show #1 for the indie query: ${semOk ? "✓" : "✗"}`);
  const pass = excludesNYC && semOk && ext.rows.length === 2;
  console.log(pass
    ? "\nRESULT: PASS — real PostGIS + pgvector on Aurora PostgreSQL. Screenshot this."
    : "\nRESULT: CHECK ABOVE");
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  // surface which step failed (extension denied, no network, …) instead of a
  // bare rejection — keeps the screenshot run debuggable (review m4)
  console.error(`\nRESULT: ERROR — ${e.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
