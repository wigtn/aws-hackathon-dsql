import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/data";

// GET /api/me?buyerId=  → this buyer's tickets across all events.
// Ownership predicate: only rows where seats.buyer_id === session subject
// (PRD §17 C-6). In production buyerId comes from the sealed session.
export async function GET(req: NextRequest) {
  const buyerId = req.nextUrl.searchParams.get("buyerId");
  if (!buyerId) return NextResponse.json({ tickets: [], waitlist: [] });
  const { tickets, waitlist } = await getData().myTickets(buyerId);
  return NextResponse.json({ buyerId, tickets, waitlist });
}
