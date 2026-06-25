// ============================================================================
// Data plane abstraction. Every API route goes through getData(), which returns
// either the in-memory SIMULATION backend or the real Aurora DSQL backend based
// on DATA_PLANE (set by env). Same interface, swappable — so the deployed app
// runs on real multi-region DSQL with no route changes, and the serverless
// in-memory state problem disappears (DSQL is the shared store). PRD §5 / LAB-42.
// ============================================================================
import {
  store,
  eventById as simEventById,
  slotForEvent as simSlotForEvent,
  createDrop as simCreateDrop,
} from "@/lib/sim/store";
import { discover as simDiscover, DiscoveryParams, DiscoveryResult } from "@/lib/discovery";
import { ClaimResult, EventRow, RegionId, SeatRow, SeatStatus, Slot } from "@/lib/sim/types";
import type { SeatLayout } from "@/lib/seatlayout";
import { DATA_PLANE } from "@/lib/db";
import { dsqlData } from "@/lib/db/dsql-data";
import { fingerprint, type Allocation } from "@/lib/fairness";

// Public seat shape — NO buyer_id / reserved_for (PII). Surfaces only what the
// seat map and organizer floor need: status + occupied/reserved booleans (FR-A4).
export interface PublicSeat {
  seat_no: number;
  section: string;
  row_label: string;
  status: SeatStatus;
  occupied: boolean;
  reserved: boolean;
}

export function toPublicSeat(s: SeatRow, now = Date.now()): PublicSeat {
  return {
    seat_no: s.seat_no,
    section: s.section,
    row_label: s.row_label,
    status: s.status,
    occupied: s.buyer_id != null,
    reserved: s.reserved_for != null && (s.reserved_until ?? 0) > now,
  };
}

export interface Snapshot {
  capacity: number;
  remaining_open: number;
  counts: Record<SeatStatus, number>;
  seats: PublicSeat[];
  sale_opens_at: number;
}

export interface Metrics {
  event_id: string;
  title: string;
  organizer: string;
  price: number;
  capacity: number;
  taken: number;
  remaining: number;
  sell_through: number;
  gross_revenue: number;
  region: Record<string, number>;
  region_mode?: "multi" | "single" | "simulation"; // FR-A1: honest topology (set by the route)
  counts: Record<SeatStatus, number>;
  defended: {
    oversell_blocked: number;
    oversell_defended_usd: number;
    bots_blocked: number;
    resale_repatriated_usd: number;
    total_defended_usd: number;
    modeled: true;
  };
}

export interface MyTicket {
  event_id: string;
  title: string;
  venue: string;
  city: string;
  seat_no: number;
  seat_label: string;
  status: string;
  region: string | null;
  totp_seed: number;
}

export interface CreateDropInput {
  title: string;
  category: EventRow["category"];
  capacity: number;
  price: number;
  organizer_name?: string;
  opens_at?: number;
  // Location set by the organizer (PRD §4.2): venue name + city + a map pin.
  // Without these a drop is invisible to PostGIS radius discovery, so the
  // create flow now captures them instead of hardcoding a default city.
  venue?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  // Seat model the organizer chose (GA / sections / grid). When present it
  // determines the generated seats + capacity; the layout is purely cosmetic —
  // every seat is still one DSQL row, so the oversell guarantee is unchanged.
  layout?: SeatLayout;
}

export interface Data {
  plane: "simulation" | "aurora-dsql";
  listEvents(): Promise<EventRow[]>;
  eventById(id: string): Promise<EventRow | undefined>;
  slotForEvent(id: string): Promise<Slot | undefined>;
  createDrop(input: CreateDropInput): Promise<EventRow>;
  snapshot(eventId: string): Promise<Snapshot | null>;
  claim(eventId: string, buyerId: string, region: RegionId): Promise<ClaimResult>;
  confirm(eventId: string, seatNo: number, buyerId: string): Promise<boolean>;
  cancelReoffer(eventId: string, seatNo: number, buyerId: string): Promise<{ ok: boolean; reoffered_to: string | null }>;
  waitlistJoin(eventId: string, buyerId: string): Promise<{ ok: boolean; position: number }>;
  sweep(eventId: string): Promise<{ holds: number; offers: number }>;
  // Bounded live-stock lookup for a known set of event ids — used by the real
  // PG discovery path so it joins stock for the ranked top-K only, never the
  // whole catalog (review M2).
  remainingFor(eventIds: string[]): Promise<Record<string, number>>;
  // Fairness allocations read from the seat ledger in commit order (the chain
  // source of truth — consistent across instances on the DSQL plane).
  fairnessAllocations(eventId: string): Promise<Allocation[]>;
  metrics(eventId: string): Promise<Metrics | null>;
  myTickets(buyerId: string): Promise<{ tickets: MyTicket[]; waitlist: { event_id: string; title: string; position: number }[] }>;
  discover(p: DiscoveryParams): Promise<DiscoveryResult[]>;
}

// ---- shared, backend-independent computations -----------------------------
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}

export function computeDefended(ev: EventRow, taken: number): Metrics["defended"] {
  const oversellBlocked = Math.round(taken * 0.7);
  const oversellDefended = Math.round(oversellBlocked * ev.price * 1.3);
  const scalpedSeats = Math.round(taken * 0.25);
  const resaleRepatriated = Math.round(scalpedSeats * ev.price * (ev.resale_markup - 1));
  return {
    oversell_blocked: oversellBlocked,
    oversell_defended_usd: oversellDefended,
    bots_blocked: Math.round(taken * 1.8),
    resale_repatriated_usd: resaleRepatriated,
    total_defended_usd: oversellDefended + resaleRepatriated,
    modeled: true,
  };
}

// ---- simulation backend (delegates to the in-memory store/engine) ----------
const sim: Data = {
  plane: "simulation",
  async listEvents() {
    return store().events;
  },
  async eventById(id) {
    return simEventById(id);
  },
  async slotForEvent(id) {
    return simSlotForEvent(id);
  },
  async createDrop(input) {
    return simCreateDrop(input);
  },
  async snapshot(eventId) {
    const slot = simSlotForEvent(eventId);
    if (!slot) return null;
    const s = store();
    const now = Date.now();
    return {
      capacity: slot.capacity,
      remaining_open: s.ledger.remainingOpen(slot.id),
      counts: s.ledger.statusCounts(slot.id),
      seats: s.ledger.snapshot(slot.id).map((seat) => toPublicSeat(seat, now)),
      sale_opens_at: slot.sale_opens_at,
    };
  },
  async claim(eventId, buyerId, region) {
    const slot = simSlotForEvent(eventId)!;
    return store().ledger.claim(slot.id, buyerId, region);
  },
  async confirm(eventId, seatNo, buyerId) {
    const slot = simSlotForEvent(eventId)!;
    return store().ledger.confirm(slot.id, seatNo, buyerId);
  },
  async cancelReoffer(eventId, seatNo, buyerId) {
    const s = store();
    const slot = simSlotForEvent(eventId)!;
    const wl = s.waitlist.get(slot.id) ?? [];
    const next = wl.shift() ?? null;
    const ok = s.ledger.cancelAndReoffer(slot.id, seatNo, buyerId, next?.buyer_id ?? null);
    return { ok, reoffered_to: ok ? next?.buyer_id ?? null : null };
  },
  async waitlistJoin(eventId, buyerId) {
    const s = store();
    const slot = simSlotForEvent(eventId)!;
    const wl = s.waitlist.get(slot.id) ?? [];
    wl.push({
      id: `wl-${wl.length + 1}`, slot_id: slot.id, buyer_id: buyerId,
      position: wl.length + 1, offer_seat_no: null, offer_expires_at: null, created_at: Date.now(),
    });
    s.waitlist.set(slot.id, wl);
    return { ok: true, position: wl.length };
  },
  async sweep(eventId) {
    const slot = simSlotForEvent(eventId)!;
    return store().ledger.sweep(slot.id);
  },
  async remainingFor(eventIds) {
    const s = store();
    const out: Record<string, number> = {};
    for (const id of eventIds) {
      const slot = simSlotForEvent(id);
      out[id] = slot ? s.ledger.remainingOpen(slot.id) : 0;
    }
    return out;
  },
  async fairnessAllocations(eventId) {
    const slot = simSlotForEvent(eventId);
    if (!slot) return [];
    return store()
      .ledger.seatsOf(slot.id)
      .filter((s) => s.buyer_id && s.claimed_at != null)
      .sort((a, b) => a.claimed_at! - b.claimed_at! || a.seat_no - b.seat_no)
      .map((s) => ({
        seat_no: s.seat_no,
        region: s.region ?? "us-east-1",
        buyer_fingerprint: fingerprint(s.buyer_id!),
        committed_at: s.claimed_at!,
      }));
  },
  async metrics(eventId) {
    const ev = simEventById(eventId);
    const slot = simSlotForEvent(eventId);
    if (!ev || !slot) return null;
    const s = store();
    const counts = s.ledger.statusCounts(slot.id);
    const taken = counts.held + counts.confirmed + counts.activated + counts.sold;
    const remaining = s.ledger.remainingOpen(slot.id);
    const region: Record<string, number> = { "us-east-1": 0, "us-east-2": 0 };
    for (const seat of s.ledger.seatsOf(slot.id)) {
      if (seat.buyer_id && seat.region) region[seat.region] = (region[seat.region] ?? 0) + 1;
    }
    return {
      event_id: ev.id, title: ev.title, organizer: ev.organizer_name, price: ev.price,
      capacity: slot.capacity, taken, remaining,
      sell_through: slot.capacity > 0 ? taken / slot.capacity : 0,
      gross_revenue: taken * ev.price, region, counts, defended: computeDefended(ev, taken),
    };
  },
  async myTickets(buyerId) {
    const s = store();
    const tickets: MyTicket[] = [];
    const waitlist: { event_id: string; title: string; position: number }[] = [];
    for (const ev of s.events) {
      const slot = s.slots.get(ev.id);
      if (!slot) continue;
      for (const seat of s.ledger.seatsOf(slot.id)) {
        if (seat.buyer_id === buyerId && ["held", "confirmed", "activated", "sold"].includes(seat.status)) {
          tickets.push({
            event_id: ev.id, title: ev.title, venue: ev.venue, city: ev.city,
            seat_no: seat.seat_no, seat_label: `${seat.section} ${seat.row_label}${seat.seat_no}`,
            status: seat.status, region: seat.region, totp_seed: hashSeed(`${ev.id}:${seat.seat_no}:${buyerId}`),
          });
        }
      }
      const mine = (s.waitlist.get(slot.id) ?? []).find((w) => w.buyer_id === buyerId);
      if (mine) waitlist.push({ event_id: ev.id, title: ev.title, position: mine.position });
    }
    return { tickets, waitlist };
  },
  async discover(p) {
    return simDiscover(p);
  },
};

export function getData(): Data {
  return DATA_PLANE === "aurora" ? dsqlData : sim;
}
