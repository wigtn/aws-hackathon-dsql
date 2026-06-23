import { NextRequest, NextResponse } from "next/server";
import { slotForEvent, store } from "@/lib/sim/store";
import { RegionId } from "@/lib/sim/types";

// POST /api/claim  { action, eventId, buyerId, region?, seatNo? }
// One route, several ledger actions. buyer_id is taken from the body here for
// the demo; in production it is SEALED into the session token, never client
// input (PRD §17 C-5). All mutations carry an ownership predicate (§17 C-6).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, eventId, buyerId, region, seatNo } = body as {
    action: "claim" | "confirm" | "cancel" | "waitlist" | "sweep";
    eventId: string;
    buyerId: string;
    region?: RegionId;
    seatNo?: number;
  };

  const s = store();
  const slot = slotForEvent(eventId);
  if (!slot) return NextResponse.json({ error: "unknown event" }, { status: 404 });

  const now = Date.now();
  if (slot.sale_opens_at > now && action === "claim") {
    return NextResponse.json(
      { ok: false, error: "NOT_OPEN", opens_in_ms: slot.sale_opens_at - now },
      { status: 409 },
    );
  }

  switch (action) {
    case "claim": {
      if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });
      const r = s.ledger.claim(slot.id, buyerId, region ?? "us-east-1", Math.random, now);
      const httpStatus = r.ok ? 200 : r.error === "SOLD_OUT" ? 410 : 409;
      return NextResponse.json(r, { status: httpStatus });
    }
    case "confirm": {
      const ok = s.ledger.confirm(slot.id, seatNo!, buyerId, now);
      return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
    }
    case "cancel": {
      const wl = s.waitlist.get(slot.id) ?? [];
      const next = wl.shift() ?? null; // #1 in queue gets the locked offer
      const ok = s.ledger.cancelAndReoffer(
        slot.id,
        seatNo!,
        buyerId,
        next?.buyer_id ?? null,
        300_000,
        now,
      );
      return NextResponse.json(
        { ok, reoffered_to: ok ? next?.buyer_id ?? null : null },
        { status: ok ? 200 : 409 },
      );
    }
    case "waitlist": {
      const wl = s.waitlist.get(slot.id) ?? [];
      wl.push({
        id: `wl-${wl.length + 1}`,
        slot_id: slot.id,
        buyer_id: buyerId,
        position: wl.length + 1,
        offer_seat_no: null,
        offer_expires_at: null,
        created_at: now,
      });
      s.waitlist.set(slot.id, wl);
      return NextResponse.json({ ok: true, position: wl.length });
    }
    case "sweep": {
      const swept = s.ledger.sweep(slot.id, now);
      return NextResponse.json({ ok: true, ...swept });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

// GET /api/claim?eventId=  → live seat snapshot for the event/seat-map view.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const slot = slotForEvent(eventId);
  if (!slot) return NextResponse.json({ error: "unknown event" }, { status: 404 });
  const s = store();
  return NextResponse.json({
    slot_id: slot.id,
    capacity: slot.capacity,
    sale_opens_at: slot.sale_opens_at,
    remaining_open: s.ledger.remainingOpen(slot.id),
    counts: s.ledger.statusCounts(slot.id),
    seats: s.ledger.snapshot(slot.id),
  });
}
