import { NextRequest, NextResponse } from "next/server";
import { eventById, slotForEvent, store } from "@/lib/sim/store";

// GET /api/org/metrics?eventId=  → B2B operator metrics for one drop.
// The organizer-facing view: revenue, sell-through, region split, and the
// MODELED "revenue defended" (oversell + resale) that quantifies why a business
// pays for OpenSlot. Defended figures are clearly labeled as estimates.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const ev = eventById(eventId);
  const slot = slotForEvent(eventId);
  if (!ev || !slot)
    return NextResponse.json({ error: "unknown event" }, { status: 404 });

  const s = store();
  const seats = s.ledger.seatsOf(slot.id);
  const counts = s.ledger.statusCounts(slot.id);
  const taken = counts.held + counts.confirmed + counts.activated + counts.sold;
  const remaining = s.ledger.remainingOpen(slot.id);
  const sellThrough = slot.capacity > 0 ? taken / slot.capacity : 0;

  // region split among taken seats (which endpoint won the write)
  const region: Record<string, number> = { "us-east-1": 0, "us-east-2": 0 };
  for (const seat of seats) {
    if (seat.buyer_id && seat.region) region[seat.region] = (region[seat.region] ?? 0) + 1;
  }

  const gross = taken * ev.price;

  // ---- modeled "revenue defended" (estimates, labeled in UI) --------------
  // Oversell defended: in a naive last-writer-wins system, peak contention would
  // let a fraction of sales double-sell → each is a refund + chargeback + goodwill
  // cost. We model that avoided cost. (Real conflict counts come from the rush
  // simulator / /demo.)
  const oversellBlocked = Math.round(taken * 0.7);
  const oversellDefended = Math.round(oversellBlocked * ev.price * 1.3);
  // Resale repatriated: assume ~25% of inventory would be scalped at resale_markup;
  // identity/device binding + fair re-release keeps that margin in the primary sale.
  const scalpedSeats = Math.round(taken * 0.25);
  const resaleRepatriated = Math.round(
    scalpedSeats * ev.price * (ev.resale_markup - 1),
  );
  const botsBlocked = Math.round(taken * 1.8);

  return NextResponse.json({
    event_id: ev.id,
    title: ev.title,
    organizer: ev.organizer_name,
    price: ev.price,
    capacity: slot.capacity,
    taken,
    remaining,
    sell_through: sellThrough,
    gross_revenue: gross,
    region,
    counts,
    defended: {
      oversell_blocked: oversellBlocked,
      oversell_defended_usd: oversellDefended,
      bots_blocked: botsBlocked,
      resale_repatriated_usd: resaleRepatriated,
      total_defended_usd: oversellDefended + resaleRepatriated,
      modeled: true,
    },
  });
}
