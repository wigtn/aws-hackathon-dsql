import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { RegionId } from "@/lib/sim/types";

// POST /api/claim  { action, eventId, buyerId, region?, seatNo? }
// One route, several ledger actions, backed by getData() (sim or real DSQL).
// buyer_id is taken from the body here for the demo; in production it is SEALED
// into the session token, never client input (PRD §17 C-5).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, eventId, buyerId, region, seatNo } = body as {
    action: "claim" | "confirm" | "cancel" | "waitlist" | "sweep";
    eventId: string;
    buyerId: string;
    region?: RegionId;
    seatNo?: number;
  };

  const data = getData();
  const slot = await data.slotForEvent(eventId);
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
      const r = await data.claim(eventId, buyerId, region ?? "us-east-1");
      const httpStatus = r.ok ? 200 : r.error === "SOLD_OUT" ? 410 : 409;
      return NextResponse.json(r, { status: httpStatus });
    }
    case "confirm": {
      if (!buyerId || typeof seatNo !== "number")
        return NextResponse.json({ error: "buyerId and seatNo required" }, { status: 400 });
      const ok = await data.confirm(eventId, seatNo, buyerId);
      return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
    }
    case "cancel": {
      if (!buyerId || typeof seatNo !== "number")
        return NextResponse.json({ error: "buyerId and seatNo required" }, { status: 400 });
      const r = await data.cancelReoffer(eventId, seatNo, buyerId);
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    case "waitlist": {
      if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });
      const r = await data.waitlistJoin(eventId, buyerId);
      return NextResponse.json(r);
    }
    case "sweep": {
      // hold/offer cleanup is a cron job, not a public mutation (FR-A5/M5).
      const secret = process.env.OPENSLOT_CRON_SECRET;
      if (secret && req.headers.get("x-openslot-cron") !== secret)
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const swept = await data.sweep(eventId);
      return NextResponse.json({ ok: true, ...swept });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

// GET /api/claim?eventId=  → live seat snapshot for the event/seat-map view.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const data = getData();
  const snap = await data.snapshot(eventId);
  if (!snap) return NextResponse.json({ error: "unknown event" }, { status: 404 });
  return NextResponse.json({
    slot_id: `slot-${eventId}`,
    capacity: snap.capacity,
    sale_opens_at: snap.sale_opens_at,
    remaining_open: snap.remaining_open,
    counts: snap.counts,
    seats: snap.seats,
  });
}
