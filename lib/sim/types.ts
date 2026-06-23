// Shared domain types. These mirror the Aurora DSQL "ledger plane" tables in
// PRD §4.1 (row-per-seat) and the Aurora PostgreSQL "discovery plane" §4.2.
// The simulation engine and the real DSQL/PG adapters both speak these shapes.

export type SeatStatus =
  | "open"
  | "held"
  | "confirmed"
  | "activated"
  | "released"
  | "sold"; // terminal sold (capacity=1 hero seat after confirm)

export const SENTINEL_BUYER = "00000000-0000-0000-0000-000000000000";

export type RegionId = "us-east-1" | "us-east-2";
export const WITNESS_REGION = "us-west-2";

export const REGION_LABEL: Record<RegionId, string> = {
  "us-east-1": "N. Virginia",
  "us-east-2": "Ohio",
};

// One physical seat row. The unit of contention. (PRD §17 C-1: everything is seats.)
export interface SeatRow {
  id: string;
  slot_id: string;
  seat_no: number;
  section: string;
  row_label: string;
  buyer_id: string | null;
  status: SeatStatus;
  /** OCC version. Bumped on every committed mutation; the read-set fingerprint. */
  version: number;
  region: RegionId | null;
  reserved_for: string | null;
  reserved_until: number | null; // epoch ms
  hold_expires_at: number | null;
  claimed_at: number | null;
}

export interface Slot {
  id: string;
  event_id: string;
  capacity: number;
  sale_opens_at: number;
}

export type EventCategory = "concert" | "sports" | "drop" | "event";

// Discovery-plane event (Aurora PostgreSQL): geo + vector live here, never DSQL.
export interface EventRow {
  id: string;
  organizer_id: string;
  organizer_name: string;
  title: string;
  subtitle: string;
  category: EventCategory;
  venue: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  sale_opens_at: number;
  embedding: number[]; // pgvector(1024) → small stub dim here
  hero_seat_no?: number;
  price: number; // face value (USD) — organizer revenue basis
  resale_markup: number; // typical scalper markup multiple (e.g. 3.5x) for defended-revenue model
}

export interface WaitlistEntry {
  id: string;
  slot_id: string;
  buyer_id: string;
  position: number;
  offer_seat_no: number | null;
  offer_expires_at: number | null;
  created_at: number;
}

// ---- claim outcomes --------------------------------------------------------

export type ClaimErrorCode =
  | "OC000" // optimistic-concurrency conflict (retryable)
  | "SOLD_OUT" // genuinely 0 open seats
  | "RETRY_EXHAUSTED" // 5 retries hit, but seats may remain (false-full guard)
  | "ALREADY_HELD" // 1-per-buyer app-level guard (PRD §17 C-2)
  | "NOT_OPEN";

export interface ClaimResult {
  ok: boolean;
  seat_no?: number;
  region: RegionId;
  attempts: number;
  oc000: number; // how many OC000 conflicts this claim absorbed
  latency_ms: number;
  error?: ClaimErrorCode;
  remaining_open?: number;
}
