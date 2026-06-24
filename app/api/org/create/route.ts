import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { EventCategory } from "@/lib/sim/types";

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
  const capacity = Math.max(1, Math.min(500, Number(body.capacity) || 50));
  const price = Math.max(1, Math.min(100000, Number(body.price) || 50));
  const opens_at =
    Number.isFinite(body.opens_at) && Number(body.opens_at) > 0
      ? Number(body.opens_at)
      : undefined;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const ev = await getData().createDrop({
    title,
    category,
    capacity,
    price,
    organizer_name: body.organizer_name,
    opens_at,
  });
  return NextResponse.json({
    ok: true,
    event_id: ev.id,
    title: ev.title,
    sale_opens_at: ev.sale_opens_at,
  });
}
