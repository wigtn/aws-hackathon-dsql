// ============================================================================
// Organization registry + seed catalog. OpenSlot is a B2B product: the paying
// customer is the EVENT BUSINESS (organizer). This module is the single source
// of truth for the demo's seed companies and the drops each company runs.
//
// Design: a small set of real-feeling companies, each owning one or more drops
// appropriate to that company. The seat ledger (DSQL) and the discovery catalog
// (PG) are both derived from SEED_DROPS — change it here and both planes follow
// (lib/sim/store.ts builds the ledger; lib/db/dsql-data.ts seeds DSQL from the
// same store). Organizer-created drops (createDrop) reuse the same EventRow
// shape, attributed to the onboarded org instead of a seed company.
// ============================================================================
import { embed } from "@/lib/embedding.mjs";
import type { EventCategory, EventRow } from "@/lib/sim/types";

const MIN = 60_000;

export interface Organization {
  id: string;
  name: string;
  category: EventCategory;
  /** Home market — the default venue location for this company's drops. */
  city: string;
  country: string;
  lat: number;
  lng: number;
  blurb: string;
}

// A drop authored by one of the seed companies. `opensInMin` is relative to
// process start (re-anchored on each cold start, see store/dsql-data) so the
// "live vs upcoming" split and the countdown UI never drift into the past.
export interface SeedDrop {
  id: string;
  org_id: string;
  title: string;
  subtitle: string;
  /** Specific venue for this drop; falls back to the org's home city/coords. */
  venue: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  capacity: number;
  price: number;
  resale_markup: number;
  /** epoch-ms offset from now; negative = already live, positive = upcoming. */
  opensInMin: number;
  embedding: number[];
  hero_seat_no?: number;
}

// ---- seed companies (a few, deliberately distinct) -------------------------
export const SEED_ORGS: Organization[] = [
  {
    id: "org-hallyu",
    name: "Hallyu Touring",
    category: "concert",
    city: "Seoul",
    country: "KR",
    lat: 37.5202,
    lng: 127.1262,
    blurb: "Global K-pop tour promoter — stadium on-sales across 18 cities.",
  },
  {
    id: "org-popmart",
    name: "Charm Lab",
    category: "drop",
    city: "Seoul",
    country: "KR",
    lat: 37.5563,
    lng: 126.9236,
    blurb: "Designer collectible drops — limited series, one per buyer.",
  },
  {
    id: "org-plankton",
    name: "Club Plankton",
    category: "concert",
    city: "Seoul",
    country: "KR",
    lat: 37.5345,
    lng: 126.9946,
    blurb: "Itaewon indie live house — weekend shows, fair entry.",
  },
  {
    id: "org-snkrs",
    name: "DropZone",
    category: "drop",
    city: "New York",
    country: "US",
    lat: 40.7128,
    lng: -74.006,
    blurb: "Global sneaker launches — regional allocation, anti-bot.",
  },
];

// ---- seed drops, grouped by company ----------------------------------------
// Hallyu Touring runs TWO drops (a multi-seat arena on-sale + a last-seat
// release) to show the company → many-drops relationship in the org console.
export const SEED_DROPS: SeedDrop[] = [
  {
    id: "ev-kpop-world",
    org_id: "org-hallyu",
    title: "SKYLINE HORIZON World Tour",
    subtitle: "Global on-sale · 18 cities",
    venue: "KSPO Dome",
    capacity: 60,
    price: 120,
    resale_markup: 5.0,
    opensInMin: -1, // LIVE — claimable seat grid + org demo hero
    embedding: embed({ kpop: 2, global: 1.5, arena: 1 }),
  },
  {
    id: "ev-eras-seoul",
    org_id: "org-hallyu",
    title: "AURORA NIGHTS — The Final Show",
    subtitle: "Seoul · last-seat release",
    venue: "Goyang Stadium",
    city: "Goyang",
    lat: 37.6708,
    lng: 126.7794,
    capacity: 1,
    price: 180,
    resale_markup: 4.5,
    opensInMin: -5, // LIVE
    embedding: embed({ pop: 2, arena: 1.5, global: 1, weekend: 1 }),
    hero_seat_no: 1,
  },
  {
    id: "ev-labubu",
    org_id: "org-popmart",
    title: "LUMA · Blind-Box Restock",
    subtitle: "Limited drop · 1 per buyer",
    venue: "Online + Hongdae flagship",
    capacity: 1,
    price: 45,
    resale_markup: 6.0,
    opensInMin: -2, // LIVE
    embedding: embed({ collectible: 2, gaming: 0.6, weekend: 1, global: 1 }),
  },
  {
    id: "ev-snkrs",
    org_id: "org-snkrs",
    title: "PHANTOM 92 · Vault Release",
    subtitle: "Global drop · regional allocation",
    venue: "DropZone App",
    city: "Global",
    capacity: 40,
    price: 200,
    resale_markup: 3.5,
    opensInMin: -3, // LIVE — second multi-seat floor
    embedding: embed({ sneakers: 2, collectible: 1.2, global: 1.5 }),
  },
  {
    id: "ev-indie",
    org_id: "org-plankton",
    title: "Slow Static + The Hours",
    subtitle: "Indie night · Itaewon",
    venue: "Club Plankton",
    capacity: 24,
    price: 35,
    resale_markup: 2.5,
    opensInMin: 20, // upcoming — countdown UI + pgvector "indie near me" demo
    embedding: embed({ indie: 2, rock: 1, club: 1.5, weekend: 1.5 }),
  },
];

export function orgById(id: string): Organization | undefined {
  return SEED_ORGS.find((o) => o.id === id);
}

// Build the concrete EventRow set from the seed catalog, anchored to `nowMs`.
// Venue location falls back to the company's home coordinates when a drop does
// not override them — so geo (PostGIS) discovery is meaningful per company.
export function seedEvents(nowMs: number): EventRow[] {
  return SEED_DROPS.map((d) => {
    const org = orgById(d.org_id)!;
    return {
      id: d.id,
      organizer_id: org.id,
      organizer_name: org.name,
      title: d.title,
      subtitle: d.subtitle,
      category: org.category,
      venue: d.venue,
      city: d.city ?? org.city,
      country: d.country ?? org.country,
      lat: d.lat ?? org.lat,
      lng: d.lng ?? org.lng,
      sale_opens_at: nowMs + d.opensInMin * MIN,
      embedding: d.embedding,
      price: d.price,
      resale_markup: d.resale_markup,
      ...(d.hero_seat_no != null ? { hero_seat_no: d.hero_seat_no } : {}),
    };
  });
}

export function seedCapacities(): Record<string, number> {
  return Object.fromEntries(SEED_DROPS.map((d) => [d.id, d.capacity]));
}
