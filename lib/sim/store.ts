// ============================================================================
// Global singleton store. Holds the discovery-plane events (Aurora PostgreSQL)
// and the seat ledger (Aurora DSQL). Persists across requests within a server
// process — sufficient for the demo. Seeds are deterministic.
// ============================================================================

import { SeatLedger } from "./engine";
import { EventRow, Slot, WaitlistEntry } from "./types";
// Embedding space lives in one framework-free module shared with the PG
// provisioning script, so seeded vectors and live queries can't drift (M3).
import { embedQuery } from "@/lib/embedding.mjs";
// Seed companies + their drops live in one registry (lib/orgs.ts) — the B2B
// model: a few real-feeling event businesses, each owning its own drops.
import { seedEvents, seedCapacities } from "@/lib/orgs";

export { embedQuery };

const now = () => Date.now();

interface StoreShape {
  events: EventRow[];
  slots: Map<string, Slot>; // event_id -> slot
  ledger: SeatLedger;
  waitlist: Map<string, WaitlistEntry[]>; // slot_id -> entries
  otp: Map<string, string>; // phone -> code
  seededAt: number;
}

function buildStore(): StoreShape {
  const t = now();
  const ledger = new SeatLedger();
  const slots = new Map<string, Slot>();
  const waitlist = new Map<string, WaitlistEntry[]>();

  // Seed catalog is derived from the company registry (lib/orgs.ts): a few
  // event businesses, each owning its own drops, anchored to the current clock.
  const events: EventRow[] = seedEvents(t);
  const caps = seedCapacities();

  for (const ev of events) {
    const slot: Slot = {
      id: `slot-${ev.id}`,
      event_id: ev.id,
      capacity: caps[ev.id] ?? 30,
      sale_opens_at: ev.sale_opens_at,
    };
    slots.set(ev.id, slot);
    const sections =
      slot.capacity <= 1
        ? [{ section: "GA", rows: 1 }]
        : [
            { section: "FLOOR", rows: 6 },
            { section: "LWR", rows: 8 },
            { section: "UPR", rows: 10 },
          ];
    ledger.seed(slot, sections);
    waitlist.set(slot.id, []);
  }

  return { events, slots, ledger, waitlist, otp: new Map(), seededAt: t };
}

// stash on globalThis so HMR / multiple route modules share one instance
const g = globalThis as unknown as { __openslot?: StoreShape };
export function store(): StoreShape {
  if (!g.__openslot) g.__openslot = buildStore();
  return g.__openslot;
}
export function reseed(): StoreShape {
  g.__openslot = buildStore();
  return g.__openslot;
}

// Self-serve drop creation — the B2B onboarding path. An organizer defines a
// drop; we provision the PG catalog row (discovery) + the DSQL slot/seats
// (ledger). Mirrors the cross-DB onboarding saga of PRD §4.3.
export function createDrop(input: {
  title: string;
  category: EventRow["category"];
  capacity: number;
  price: number;
  organizer_name?: string;
  opens_at?: number; // epoch ms; default = immediately
  venue?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
}): EventRow {
  const s = store();
  const t = Date.now();
  const opensAt =
    typeof input.opens_at === "number" && input.opens_at > 0
      ? input.opens_at
      : t - 1000; // immediate
  const slug = (input.title || "drop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  // ID scheme parity with the DSQL backend (avoids length-based collisions)
  const id = `ev-custom-${t.toString(36)}-${slug || "drop"}`;
  // Location comes from the organizer's map pin; fall back to a Seoul default
  // only when nothing was provided (keeps older callers working).
  const lat = Number.isFinite(input.lat) ? (input.lat as number) : 37.5563;
  const lng = Number.isFinite(input.lng) ? (input.lng as number) : 126.976;
  const ev: EventRow = {
    id,
    organizer_id: "org-you",
    organizer_name: input.organizer_name || "Your venue",
    title: input.title || "Untitled drop",
    subtitle: "Your drop · just created",
    category: input.category,
    venue: input.venue?.trim() || "Your venue",
    city: input.city?.trim() || "Seoul",
    country: input.country?.trim() || "KR",
    lat,
    lng,
    sale_opens_at: opensAt,
    embedding: embedQuery(`${input.title} ${input.category}`),
    price: Math.max(1, input.price),
    resale_markup: 3.5,
  };
  s.events.unshift(ev);
  const slot: Slot = {
    id: `slot-${id}`,
    event_id: id,
    capacity: Math.max(1, Math.min(500, input.capacity)),
    sale_opens_at: ev.sale_opens_at,
  };
  s.slots.set(id, slot);
  const sections =
    slot.capacity <= 1
      ? [{ section: "GA", rows: 1 }]
      : [
          { section: "FLOOR", rows: Math.ceil(slot.capacity / 3) },
          { section: "LWR", rows: Math.ceil(slot.capacity / 3) },
          { section: "UPR", rows: Math.ceil(slot.capacity / 3) },
        ];
  s.ledger.seed(slot, sections);
  s.waitlist.set(slot.id, []);
  return ev;
}

export function eventById(id: string) {
  return store().events.find((e) => e.id === id);
}
export function slotForEvent(id: string) {
  return store().slots.get(id);
}
