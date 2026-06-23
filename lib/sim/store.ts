// ============================================================================
// Global singleton store. Holds the discovery-plane events (Aurora PostgreSQL)
// and the seat ledger (Aurora DSQL). Persists across requests within a server
// process — sufficient for the demo. Seeds are deterministic.
// ============================================================================

import { SeatLedger } from "./engine";
import { EventRow, Slot, WaitlistEntry } from "./types";

// tiny semantic space — stands in for pgvector(1024). Each axis is a concept.
const AXES = [
  "kpop",
  "rock",
  "indie",
  "pop",
  "sports",
  "sneakers",
  "collectible",
  "gaming",
  "arena",
  "club",
  "weekend",
  "global",
] as const;
type Axis = (typeof AXES)[number];

function embed(weights: Partial<Record<Axis, number>>): number[] {
  const v = AXES.map((a) => weights[a] ?? 0);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export function embedQuery(q: string): number[] {
  const t = q.toLowerCase();
  const w: Partial<Record<Axis, number>> = {};
  const add = (a: Axis, n = 1) => (w[a] = (w[a] ?? 0) + n);
  if (/(k-?pop|bts|stray|seventeen|아이돌|케이팝)/.test(t)) add("kpop", 2), add("global");
  if (/(rock|band|guitar|metal)/.test(t)) add("rock", 2);
  if (/(indie|underground|small|alt)/.test(t)) add("indie", 2), add("club");
  if (/(pop|stadium tour|eras)/.test(t)) add("pop", 2), add("arena");
  if (/(sport|final|match|cup|league|nba|soccer|축구)/.test(t)) add("sports", 2);
  if (/(sneaker|snkrs|nike|jordan|yeezy|드롭|drop)/.test(t)) add("sneakers", 2), add("collectible");
  if (/(labubu|pop ?mart|figure|toy|collectible|tcg|pokemon|포켓몬)/.test(t)) add("collectible", 2), add("gaming");
  if (/(ps5|console|gpu|gaming|game)/.test(t)) add("gaming", 2);
  if (/(weekend|tonight|this week|주말|오늘)/.test(t)) add("weekend", 1.5);
  if (/(arena|stadium|dome)/.test(t)) add("arena", 1);
  if (/(club|venue|bar)/.test(t)) add("club", 1);
  if (Object.keys(w).length === 0) add("pop"), add("global");
  return embed(w);
}

const HOUR = 3_600_000;
const MIN = 60_000;
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

  const events: EventRow[] = [
    {
      id: "ev-eras-seoul",
      organizer_id: "org-tne",
      organizer_name: "Transcend Live",
      title: "ERAS — The Final Night",
      subtitle: "Seoul · last-seat release",
      category: "concert",
      venue: "Goyang Stadium",
      city: "Seoul",
      country: "KR",
      lat: 37.6708,
      lng: 126.7794,
      sale_opens_at: t - 5 * MIN, // LIVE now
      embedding: embed({ pop: 2, arena: 1.5, global: 1, weekend: 1 }),
      hero_seat_no: 1,
    },
    {
      id: "ev-kpop-world",
      organizer_id: "org-hybe",
      organizer_name: "Hallyu Touring",
      title: "STRAY HORIZON World Tour",
      subtitle: "Global on-sale · 18 cities",
      category: "concert",
      venue: "KSPO Dome",
      city: "Seoul",
      country: "KR",
      lat: 37.5202,
      lng: 127.1262,
      sale_opens_at: t - 1 * MIN, // LIVE — claimable seat grid + org demo
      embedding: embed({ kpop: 2, global: 1.5, arena: 1 }),
    },
    {
      id: "ev-labubu",
      organizer_id: "org-popmart",
      organizer_name: "POP MART",
      title: "LABUBU · Macaron Series Restock",
      subtitle: "Limited drop · 1 per buyer",
      category: "drop",
      venue: "Online + Hongdae flagship",
      city: "Seoul",
      country: "KR",
      lat: 37.5563,
      lng: 126.9236,
      sale_opens_at: t - 2 * MIN, // LIVE
      embedding: embed({ collectible: 2, gaming: 0.6, weekend: 1, global: 1 }),
    },
    {
      id: "ev-snkrs",
      organizer_id: "org-nike",
      organizer_name: "SNKRS",
      title: "Air Jordan 1 'Lost & Found'",
      subtitle: "Global drop · regional allocation",
      category: "drop",
      venue: "SNKRS App",
      city: "Global",
      country: "US",
      lat: 40.7128,
      lng: -74.006,
      sale_opens_at: t - 3 * MIN, // LIVE — second multi-seat floor
      embedding: embed({ sneakers: 2, collectible: 1.2, global: 1.5 }),
    },
    {
      id: "ev-indie",
      organizer_id: "org-club",
      organizer_name: "Club Plankton",
      title: "Slow Static + The Hours",
      subtitle: "Indie night · Itaewon",
      category: "concert",
      venue: "Club Plankton",
      city: "Seoul",
      country: "KR",
      lat: 37.5345,
      lng: 126.9946,
      sale_opens_at: t + 20 * MIN, // upcoming — countdown UI
      embedding: embed({ indie: 2, rock: 1, club: 1.5, weekend: 1.5 }),
    },
    {
      id: "ev-cup-final",
      organizer_id: "org-fa",
      organizer_name: "Continental Cup",
      title: "Continental Cup — Final",
      subtitle: "Knockout · category 1",
      category: "sports",
      venue: "Seoul World Cup Stadium",
      city: "Seoul",
      country: "KR",
      lat: 37.5683,
      lng: 126.8973,
      sale_opens_at: t + 30 * MIN,
      embedding: embed({ sports: 2, arena: 1.5, global: 1 }),
    },
  ];

  // capacity: hero = 1 seat (last-seat drama); others modest for live demo
  const caps: Record<string, number> = {
    "ev-eras-seoul": 1,
    "ev-kpop-world": 60,
    "ev-labubu": 1,
    "ev-snkrs": 40,
    "ev-indie": 24,
    "ev-cup-final": 48,
  };

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

export function eventById(id: string) {
  return store().events.find((e) => e.id === id);
}
export function slotForEvent(id: string) {
  return store().slots.get(id);
}
