import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { EventCategory } from "@/lib/sim/types";
import { sanitizeLayout, layoutCapacity } from "@/lib/seatlayout";

// POST /api/org/create  { title, category, capacity, price, organizer_name? }
// Self-serve drop creation (B2B onboarding). Provisions PG catalog + DSQL slot.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const category = (
    ["concert", "sports", "drop", "event"].includes(body.category)
      ? body.category
      : "drop"
  ) as EventCategory;
  // Seat model (GA / sections / grid). When valid it drives the seats + capacity.
  const layout = sanitizeLayout(body.layout);
  const capacity = layout
    ? layoutCapacity(layout)
    : Math.max(1, Math.min(500, Number(body.capacity) || 50));
  const price = Math.max(1, Math.min(100000, Number(body.price) || 50));
  const opens_at =
    Number.isFinite(body.opens_at) && Number(body.opens_at) > 0
      ? Number(body.opens_at)
      : undefined;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Organizer-set location (map pin). lat/lng are validated to real ranges so a
  // bad client value can't poison PostGIS radius queries.
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const validPin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const ev = await getData().createDrop({
    title,
    category,
    capacity,
    price,
    organizer_name: body.organizer_name,
    opens_at,
    venue: typeof body.venue === "string" ? body.venue.slice(0, 80) : undefined,
    city: typeof body.city === "string" ? body.city.slice(0, 60) : undefined,
    country: typeof body.country === "string" ? body.country.slice(0, 2).toUpperCase() : undefined,
    lat: validPin ? lat : undefined,
    lng: validPin ? lng : undefined,
    layout: layout ?? undefined,
  });
  return NextResponse.json({
    ok: true,
    event_id: ev.id,
    title: ev.title,
    sale_opens_at: ev.sale_opens_at,
    city: ev.city,
    venue: ev.venue,
  });
}
