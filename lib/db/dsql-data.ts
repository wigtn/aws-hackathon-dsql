// ============================================================================
// Real Aurora DSQL backend for the Data interface. Same operations the
// simulation models, expressed as SQL against the multi-region seat ledger.
// Activated when DATA_PLANE === "aurora" (lib/data.getData). LAB-42.
// ============================================================================
import { q, PRIMARY } from "./dsql";
import { isOccError } from "@/lib/occ";
import { fingerprint, type Allocation } from "@/lib/fairness";
import { store, embedQuery } from "@/lib/sim/store";
import { haversineKm } from "@/lib/discovery";
import { ClaimResult, EventRow, RegionId, SeatRow, SeatStatus } from "@/lib/sim/types";
import type { DiscoveryParams, DiscoveryResult } from "@/lib/discovery";
import type { CreateDropInput, Data, Metrics, MyTicket, PublicSeat, Snapshot } from "@/lib/data";

// ---- local helpers (kept here to avoid a runtime import cycle with data.ts) -
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}
function defended(ev: EventRow, taken: number): Metrics["defended"] {
  const oversellBlocked = Math.round(taken * 0.7);
  const oversellDefended = Math.round(oversellBlocked * ev.price * 1.3);
  const resaleRepatriated = Math.round(Math.round(taken * 0.25) * ev.price * (ev.resale_markup - 1));
  return {
    oversell_blocked: oversellBlocked,
    oversell_defended_usd: oversellDefended,
    bots_blocked: Math.round(taken * 1.8),
    resale_repatriated_usd: resaleRepatriated,
    total_defended_usd: oversellDefended + resaleRepatriated,
    modeled: true,
  };
}
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * (b[i] ?? 0);
  return dot;
}
function genSeats(slotId: string, capacity: number) {
  const sections = capacity <= 1 ? ["GA"] : ["FLOOR", "LWR", "UPR"];
  const rowsPer = Math.ceil(capacity / sections.length);
  const out: { id: string; seat_no: number; section: string; row_label: string }[] = [];
  let no = 0;
  for (const section of sections) {
    for (let r = 0; r < rowsPer && no < capacity; r++) {
      no++;
      out.push({ id: `${slotId}-seat-${no}`, seat_no: no, section, row_label: String.fromCharCode(65 + (r % 26)) });
    }
  }
  return out;
}
function rowToEvent(r: Record<string, unknown>): EventRow {
  return {
    id: r.id as string,
    organizer_id: r.organizer_id as string,
    organizer_name: r.organizer_name as string,
    title: r.title as string,
    subtitle: r.subtitle as string,
    category: r.category as EventRow["category"],
    venue: r.venue as string,
    city: r.city as string,
    country: r.country as string,
    lat: Number(r.lat),
    lng: Number(r.lng),
    sale_opens_at: Number(r.sale_opens_at),
    embedding: JSON.parse((r.embedding as string) || "[]"),
    price: Number(r.price),
    resale_markup: Number(r.resale_markup),
  };
}
const CLAIMABLE = `status='open' AND buyer_id IS NULL AND (reserved_for IS NULL OR reserved_for=$BUYER OR reserved_until < $NOW)`;

async function insertSeats(slotId: string, specs: ReturnType<typeof genSeats>) {
  for (let i = 0; i < specs.length; i += 400) {
    const chunk = specs.slice(i, i + 400);
    const vals: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((s, j) => {
      const b = j * 5;
      vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},'open',1)`);
      params.push(s.id, slotId, s.seat_no, s.section, s.row_label);
    });
    await q(PRIMARY, `INSERT INTO seats (id,slot_id,seat_no,section,row_label,status,version) VALUES ${vals.join(",")}`, params)
      .catch((e) => { if (!/duplicate|already exists|unique/i.test((e as Error).message)) throw e; });
  }
}
async function insertEvent(ev: EventRow) {
  await q(
    PRIMARY,
    `INSERT INTO events (id,organizer_id,organizer_name,title,subtitle,category,venue,city,country,lat,lng,sale_opens_at,price,resale_markup,embedding,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [ev.id, ev.organizer_id, ev.organizer_name, ev.title, ev.subtitle, ev.category, ev.venue, ev.city, ev.country, ev.lat, ev.lng, ev.sale_opens_at, ev.price, ev.resale_markup, JSON.stringify(ev.embedding), Date.now()],
  ).catch((e) => { if (!/duplicate|already exists/i.test(e.message)) throw e; });
}

// ---- one-time schema + seed (guarded; persists across cold starts) ----------
// FR-A3: NO destructive DROP here (scripts/dsql-migrate.mjs owns that, once).
// Multi-instance safe via a single-seeder election on seed_marker; a rejected
// init is never cached (else every later request fails forever).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isDup = (e: unknown) => /duplicate|already exists|unique/i.test((e as Error)?.message ?? "");

let readyPromise: Promise<void> | null = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = init().catch((e) => {
      readyPromise = null; // do not cache a rejection (FR-A3 永久독 방지)
      throw e;
    });
  }
  return readyPromise;
}
// FR-A1/F1: the demo catalog stores sale_opens_at as absolute ms computed from
// now-relative offsets at seed time. Because the seed is one-time, those times
// freeze and every "upcoming" drop drifts into the past (countdown UX dies, the
// pre-sale guard never fires). Re-anchor the seeded catalog to the current
// process clock on each cold start — bounded to the known ids, so organizer
// custom drops (real opens_at) are never touched.
async function reanchorCatalog() {
  const s = store();
  for (const ev of s.events) {
    const slot = s.slots.get(ev.id);
    await q(PRIMARY, "UPDATE events SET sale_opens_at=$1 WHERE id=$2", [ev.sale_opens_at, ev.id]).catch(() => {});
    if (slot) await q(PRIMARY, "UPDATE drop_slots SET sale_opens_at=$1 WHERE id=$2", [slot.sale_opens_at, slot.id]).catch(() => {});
  }
}

async function init() {
  try {
    const r = await q(PRIMARY, "SELECT count(*)::int AS n FROM events");
    if (r.rows[0].n > 0) {
      await reanchorCatalog(); // refresh frozen demo timestamps (F1)
      return;
    }
  } catch {
    /* events table absent → create everything below */
  }
  // idempotent schema (all IF NOT EXISTS; never drops)
  await q(PRIMARY, `CREATE TABLE IF NOT EXISTS seed_marker (id text PRIMARY KEY)`).catch(() => {});
  await q(PRIMARY, `CREATE TABLE IF NOT EXISTS events (
    id text PRIMARY KEY, organizer_id text, organizer_name text, title text, subtitle text,
    category text, venue text, city text, country text, lat double precision, lng double precision,
    sale_opens_at bigint, price int, resale_markup double precision, embedding text, created_at bigint)`);
  await q(PRIMARY, `CREATE TABLE IF NOT EXISTS drop_slots (
    id text PRIMARY KEY, event_id text, capacity int, sale_opens_at bigint)`);
  await q(PRIMARY, `CREATE TABLE IF NOT EXISTS waitlist (
    id text PRIMARY KEY, slot_id text, buyer_id text, position int, created_at bigint)`);
  await q(PRIMARY, `CREATE TABLE IF NOT EXISTS seats (
    id text PRIMARY KEY, slot_id text NOT NULL, seat_no int NOT NULL, section text, row_label text,
    buyer_id text, status text NOT NULL DEFAULT 'open', version int NOT NULL DEFAULT 1, region text,
    reserved_for text, reserved_until bigint, hold_expires_at bigint, claimed_at bigint)`);
  await q(PRIMARY, "CREATE UNIQUE INDEX ASYNC ux_seat_app ON seats (slot_id, seat_no)")
    .catch((e) => { if (!/already exists/i.test((e as Error).message)) throw e; });

  // single-seeder election: the instance that wins the PK INSERT seeds; others poll.
  let iAmSeeder = false;
  try {
    await q(PRIMARY, "INSERT INTO seed_marker (id) VALUES ('v1')");
    iAmSeeder = true;
  } catch (e) {
    if (!isDup(e)) throw e; // someone else seeding → fall through to poll
  }

  if (iAmSeeder) {
    const s = store();
    for (const ev of s.events) {
      await insertEvent(ev);
      const slot = s.slots.get(ev.id)!;
      await q(PRIMARY, "INSERT INTO drop_slots (id,event_id,capacity,sale_opens_at) VALUES ($1,$2,$3,$4)", [slot.id, ev.id, slot.capacity, slot.sale_opens_at]).catch((e) => { if (!isDup(e)) throw e; });
      await insertSeats(slot.id, genSeats(slot.id, slot.capacity));
    }
    return;
  }

  // not the seeder → poll until the seeder finishes (500ms × 30 = 15s)
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const r = await q(PRIMARY, "SELECT count(*)::int AS n FROM events");
      if (r.rows[0].n > 0) return;
    } catch {
      /* keep polling */
    }
  }
  throw new Error("DSQL seed timed out waiting for the seeder");
}

const SLOT = (eventId: string) => `slot-${eventId}`;

export const dsqlData: Data = {
  plane: "aurora-dsql",

  async listEvents() {
    await ensureReady();
    const r = await q(PRIMARY, "SELECT * FROM events ORDER BY created_at DESC");
    return r.rows.map(rowToEvent);
  },

  async eventById(id) {
    await ensureReady();
    const r = await q(PRIMARY, "SELECT * FROM events WHERE id=$1", [id]);
    return r.rows[0] ? rowToEvent(r.rows[0]) : undefined;
  },

  async slotForEvent(id) {
    await ensureReady();
    const r = await q(PRIMARY, "SELECT * FROM drop_slots WHERE event_id=$1", [id]);
    const row = r.rows[0];
    return row ? { id: row.id, event_id: row.event_id, capacity: Number(row.capacity), sale_opens_at: Number(row.sale_opens_at) } : undefined;
  },

  async createDrop(input) {
    await ensureReady();
    const slug = (input.title || "drop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
    const id = `ev-custom-${Date.now().toString(36)}-${slug || "drop"}`;
    // Location from the organizer's map pin; Seoul default only as a fallback.
    const lat = Number.isFinite(input.lat) ? (input.lat as number) : 37.5563;
    const lng = Number.isFinite(input.lng) ? (input.lng as number) : 126.976;
    const ev: EventRow = {
      id, organizer_id: "org-you", organizer_name: input.organizer_name || "Your venue",
      title: input.title || "Untitled drop", subtitle: "Your drop · just created", category: input.category,
      venue: input.venue?.trim() || "Your venue", city: input.city?.trim() || "Seoul",
      country: input.country?.trim() || "KR", lat, lng,
      sale_opens_at: typeof input.opens_at === "number" && input.opens_at > 0 ? input.opens_at : Date.now() - 1000,
      embedding: embedQuery(`${input.title} ${input.category}`),
      price: Math.max(1, input.price), resale_markup: 3.5,
    };
    const capacity = Math.max(1, Math.min(500, input.capacity));
    await insertEvent(ev);
    await q(PRIMARY, "INSERT INTO drop_slots (id,event_id,capacity,sale_opens_at) VALUES ($1,$2,$3,$4)", [SLOT(id), id, capacity, ev.sale_opens_at]);
    await insertSeats(SLOT(id), genSeats(SLOT(id), capacity));
    return ev;
  },

  async snapshot(eventId) {
    await ensureReady();
    const slot = await this.slotForEvent(eventId);
    if (!slot) return null;
    const now = Date.now();
    const r = await q(PRIMARY, "SELECT seat_no, section, row_label, status, buyer_id, reserved_for, reserved_until FROM seats WHERE slot_id=$1 ORDER BY seat_no", [slot.id]);
    const counts = { open: 0, held: 0, confirmed: 0, activated: 0, released: 0, sold: 0 } as Record<SeatStatus, number>;
    let remaining = 0;
    const seats: PublicSeat[] = r.rows.map((s) => {
      counts[s.status as SeatStatus] = (counts[s.status as SeatStatus] ?? 0) + 1;
      const reserved = s.reserved_for != null && Number(s.reserved_until) > now;
      if (s.status === "open" && !s.buyer_id && (s.reserved_for == null || Number(s.reserved_until) < now)) remaining++;
      // PII-masked: no buyer_id / reserved_for in the response (FR-A4)
      return {
        seat_no: Number(s.seat_no),
        section: s.section,
        row_label: s.row_label,
        status: s.status as SeatStatus,
        occupied: s.buyer_id != null,
        reserved,
      };
    });
    return { capacity: slot.capacity, remaining_open: remaining, counts, seats, sale_opens_at: slot.sale_opens_at };
  },

  async claim(eventId, buyerId, region) {
    await ensureReady();
    const slotId = SLOT(eventId);
    const now = Date.now();
    const t0 = Date.now();
    // app-level 1-per-buyer guard (DSQL has no partial unique index — PRD §17 C-2)
    const active = await q(region, `SELECT 1 FROM seats WHERE slot_id=$1 AND buyer_id=$2 AND status IN ('held','confirmed','activated','sold') LIMIT 1`, [slotId, buyerId]);
    if (active.rowCount) return { ok: false, region, attempts: 0, oc000: 0, latency_ms: 0, error: "ALREADY_HELD" };

    let oc000 = 0;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const probe = await q(region, `SELECT seat_no, version FROM seats WHERE slot_id=$1 AND ${CLAIMABLE.replace("$BUYER", "$2").replace("$NOW", "$3")} LIMIT 50`, [slotId, buyerId, now]);
      if (probe.rowCount === 0) return { ok: false, region, attempts: attempt, oc000, latency_ms: Date.now() - t0, error: "SOLD_OUT", remaining_open: 0 };
      const cand = probe.rows[Math.floor(Math.random() * probe.rows.length)];
      try {
        const upd = await q(region, `UPDATE seats SET buyer_id=$1, status='held', version=version+1, region=$2, claimed_at=$3, hold_expires_at=$4 WHERE slot_id=$5 AND seat_no=$6 AND version=$7 AND status='open' AND buyer_id IS NULL`, [buyerId, region, now, now + 120_000, slotId, cand.seat_no, cand.version]);
        if (upd.rowCount === 1) {
          // fairness chain is projected from the seats table on read — no
          // separate append needed (the ledger IS the authoritative order).
          const rem = await q(region, `SELECT count(*)::int AS n FROM seats WHERE slot_id=$1 AND status='open' AND buyer_id IS NULL`, [slotId]);
          return { ok: true, seat_no: Number(cand.seat_no), region, attempts: attempt, oc000, latency_ms: Date.now() - t0, remaining_open: rem.rows[0].n };
        }
      } catch (e) {
        if (isOccError(e)) oc000++;
        else throw e;
      }
    }
    return { ok: false, region, attempts: 5, oc000, latency_ms: Date.now() - t0, error: "RETRY_EXHAUSTED" };
  },

  async confirm(eventId, seatNo, buyerId) {
    await ensureReady();
    const slot = await this.slotForEvent(eventId);
    if (!slot) return false;
    const now = Date.now();
    const status = slot.capacity === 1 ? "sold" : "confirmed";
    const r = await q(PRIMARY, `UPDATE seats SET status=$1, version=version+1, hold_expires_at=NULL WHERE slot_id=$2 AND seat_no=$3 AND buyer_id=$4 AND status='held' AND hold_expires_at > $5`, [status, slot.id, seatNo, buyerId, now]);
    return r.rowCount === 1;
  },

  async cancelReoffer(eventId, seatNo, buyerId) {
    await ensureReady();
    const slotId = SLOT(eventId);
    const now = Date.now();
    const w = await q(PRIMARY, "SELECT id, buyer_id FROM waitlist WHERE slot_id=$1 ORDER BY position ASC LIMIT 1", [slotId]);
    const next = w.rows[0] ?? null;
    if (next) await q(PRIMARY, "DELETE FROM waitlist WHERE id=$1", [next.id]);
    const upd = await q(PRIMARY, `UPDATE seats SET status='open', buyer_id=NULL, reserved_for=$1, reserved_until=$2, version=version+1, hold_expires_at=NULL, claimed_at=NULL WHERE slot_id=$3 AND seat_no=$4 AND buyer_id=$5`, [next?.buyer_id ?? null, next ? now + 300_000 : null, slotId, seatNo, buyerId]);
    const ok = upd.rowCount === 1;
    return { ok, reoffered_to: ok && next ? (next.buyer_id as string) : null };
  },

  async waitlistJoin(eventId, buyerId) {
    await ensureReady();
    const slotId = SLOT(eventId);
    const c = await q(PRIMARY, "SELECT count(*)::int AS n FROM waitlist WHERE slot_id=$1", [slotId]);
    const position = c.rows[0].n + 1;
    await q(PRIMARY, "INSERT INTO waitlist (id,slot_id,buyer_id,position,created_at) VALUES ($1,$2,$3,$4,$5)", [`wl-${slotId}-${position}-${buyerId}`, slotId, buyerId, position, Date.now()]);
    return { ok: true, position };
  },

  async sweep(eventId) {
    await ensureReady();
    const slotId = SLOT(eventId);
    const now = Date.now();
    const h = await q(PRIMARY, `UPDATE seats SET status='open', buyer_id=NULL, hold_expires_at=NULL, version=version+1 WHERE slot_id=$1 AND status='held' AND hold_expires_at < $2`, [slotId, now]);
    const o = await q(PRIMARY, `UPDATE seats SET reserved_for=NULL, reserved_until=NULL WHERE slot_id=$1 AND reserved_until IS NOT NULL AND reserved_until < $2`, [slotId, now]);
    return { holds: h.rowCount ?? 0, offers: o.rowCount ?? 0 };
  },

  async remainingFor(eventIds: string[]): Promise<Record<string, number>> {
    await ensureReady();
    const out: Record<string, number> = {};
    if (!eventIds.length) return out;
    // one bounded query for exactly the ranked ids (≤ top-K), not the catalog
    const slotIds = eventIds.map((id) => SLOT(id));
    const cr = await q(PRIMARY, `SELECT slot_id, count(*)::int AS n FROM seats WHERE slot_id = ANY($1) AND status='open' AND buyer_id IS NULL GROUP BY slot_id`, [slotIds]);
    const bySlot = new Map<string, number>();
    for (const row of cr.rows) bySlot.set(String(row.slot_id), Number(row.n));
    for (const id of eventIds) out[id] = bySlot.get(SLOT(id)) ?? 0;
    return out;
  },

  async fairnessAllocations(eventId: string): Promise<Allocation[]> {
    await ensureReady();
    // strict commit order straight from the strongly-consistent seat ledger
    const r = await q(PRIMARY, `SELECT seat_no, region, buyer_id, claimed_at FROM seats WHERE slot_id=$1 AND buyer_id IS NOT NULL AND claimed_at IS NOT NULL ORDER BY claimed_at ASC, seat_no ASC`, [SLOT(eventId)]);
    return r.rows.map((row) => ({
      seat_no: Number(row.seat_no),
      region: String(row.region ?? "us-east-1"),
      buyer_fingerprint: fingerprint(String(row.buyer_id)),
      committed_at: Number(row.claimed_at),
    }));
  },

  async metrics(eventId) {
    await ensureReady();
    const ev = await this.eventById(eventId);
    const slot = await this.slotForEvent(eventId);
    if (!ev || !slot) return null;
    const now = Date.now();
    const cr = await q(PRIMARY, "SELECT status, count(*)::int AS n FROM seats WHERE slot_id=$1 GROUP BY status", [slot.id]);
    const counts = { open: 0, held: 0, confirmed: 0, activated: 0, released: 0, sold: 0 } as Record<SeatStatus, number>;
    for (const row of cr.rows) counts[row.status as SeatStatus] = row.n;
    const taken = counts.held + counts.confirmed + counts.activated + counts.sold;
    const rem = await q(PRIMARY, `SELECT count(*)::int AS n FROM seats WHERE slot_id=$1 AND status='open' AND buyer_id IS NULL AND (reserved_for IS NULL OR reserved_until < $2)`, [slot.id, now]);
    const reg = await q(PRIMARY, "SELECT region, count(*)::int AS n FROM seats WHERE slot_id=$1 AND buyer_id IS NOT NULL AND region IS NOT NULL GROUP BY region", [slot.id]);
    const region: Record<string, number> = { "us-east-1": 0, "us-east-2": 0 };
    for (const row of reg.rows) region[row.region] = row.n;
    return {
      event_id: ev.id, title: ev.title, organizer: ev.organizer_name, price: ev.price,
      capacity: slot.capacity, taken, remaining: rem.rows[0].n,
      sell_through: slot.capacity > 0 ? taken / slot.capacity : 0,
      gross_revenue: taken * ev.price, region, counts, defended: defended(ev, taken),
    };
  },

  async myTickets(buyerId) {
    await ensureReady();
    const t = await q(PRIMARY, `SELECT s.seat_no, s.section, s.row_label, s.status, s.region, ds.event_id, e.title, e.venue, e.city
      FROM seats s JOIN drop_slots ds ON s.slot_id=ds.id JOIN events e ON ds.event_id=e.id
      WHERE s.buyer_id=$1 AND s.status IN ('held','confirmed','activated','sold')`, [buyerId]);
    const tickets: MyTicket[] = t.rows.map((r) => ({
      event_id: r.event_id, title: r.title, venue: r.venue, city: r.city, seat_no: Number(r.seat_no),
      seat_label: `${r.section} ${r.row_label}${r.seat_no}`, status: r.status, region: r.region,
      totp_seed: hashSeed(`${r.event_id}:${r.seat_no}:${buyerId}`),
    }));
    const w = await q(PRIMARY, `SELECT w.position, ds.event_id, e.title FROM waitlist w
      JOIN drop_slots ds ON w.slot_id=ds.id JOIN events e ON ds.event_id=e.id WHERE w.buyer_id=$1`, [buyerId]);
    const waitlist = w.rows.map((r) => ({ event_id: r.event_id, title: r.title, position: Number(r.position) }));
    return { tickets, waitlist };
  },

  async discover(p: DiscoveryParams): Promise<DiscoveryResult[]> {
    await ensureReady();
    const now = Date.now();
    const er = await q(PRIMARY, "SELECT * FROM events");
    const events = er.rows.map(rowToEvent);
    const qvec = p.query?.trim() ? embedQuery(p.query) : null;
    const limit = p.limit ?? 20;
    let rows = events.map((event) => ({
      event,
      distance_km: p.lat != null && p.lng != null ? haversineKm(p.lat, p.lng, event.lat, event.lng) : null,
      score: qvec ? cosine(qvec, event.embedding) : 0,
    }));
    if (p.lat != null && p.lng != null && p.radiusKm) rows = rows.filter((r) => r.distance_km != null && r.distance_km <= p.radiusKm!);
    rows.sort((a, b) => {
      if (qvec) return b.score - a.score;
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      return a.event.sale_opens_at - b.event.sale_opens_at;
    });
    const top = rows.slice(0, limit);
    const slotIds = top.map((r) => SLOT(r.event.id));
    const counts = new Map<string, number>();
    if (slotIds.length) {
      const cr = await q(PRIMARY, `SELECT slot_id, count(*)::int AS n FROM seats WHERE slot_id = ANY($1) AND status='open' AND buyer_id IS NULL GROUP BY slot_id`, [slotIds]);
      for (const row of cr.rows) counts.set(row.slot_id, row.n);
    }
    return top.map((r) => {
      const remaining_open = counts.get(SLOT(r.event.id)) ?? 0;
      const status: DiscoveryResult["status"] = r.event.sale_opens_at <= now ? (remaining_open > 0 ? "live" : "ended") : "soon";
      return { ...r, remaining_open, status };
    });
  },
};
