import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/sim/store";

// GET /api/me?buyerId=  → this buyer's tickets across all events.
// Ownership predicate: only rows where seats.buyer_id === session subject
// (PRD §17 C-6). In production buyerId comes from the sealed session, never the
// query string; here it stands in for that subject.
export async function GET(req: NextRequest) {
  const buyerId = req.nextUrl.searchParams.get("buyerId");
  if (!buyerId) return NextResponse.json({ tickets: [], waitlist: [] });

  const s = store();
  const tickets = [];
  const waitlist = [];

  for (const ev of s.events) {
    const slot = s.slots.get(ev.id);
    if (!slot) continue;
    for (const seat of s.ledger.seatsOf(slot.id)) {
      if (
        seat.buyer_id === buyerId &&
        ["held", "confirmed", "activated", "sold"].includes(seat.status)
      ) {
        tickets.push({
          event_id: ev.id,
          title: ev.title,
          venue: ev.venue,
          city: ev.city,
          seat_no: seat.seat_no,
          seat_label: `${seat.section} ${seat.row_label}${seat.seat_no}`,
          status: seat.status,
          region: seat.region,
          // per-ticket TOTP seed (server-derived; never the plaintext secret)
          totp_seed: hashSeed(`${ev.id}:${seat.seat_no}:${buyerId}`),
        });
      }
    }
    const wl = s.waitlist.get(slot.id) ?? [];
    const mine = wl.find((w) => w.buyer_id === buyerId);
    if (mine) waitlist.push({ event_id: ev.id, title: ev.title, position: mine.position });
  }

  return NextResponse.json({ buyerId, tickets, waitlist });
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}
