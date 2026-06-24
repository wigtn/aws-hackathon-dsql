import { NextRequest, NextResponse } from "next/server";
import { verifyChain } from "@/lib/fairness";

// GET /api/fairness?eventId=&tamper=N
// Returns the hash-chained allocation ledger + a verification result. `tamper`
// (a seq) demonstrates tamper-detection without mutating the stored ledger.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const tamperRaw = req.nextUrl.searchParams.get("tamper");
  const tamperAt = tamperRaw ? Number(tamperRaw) : undefined;
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const report = verifyChain(eventId, tamperAt);
  return NextResponse.json({
    claim:
      "Allocated in strict global commit order on one strongly-consistent ledger — no region, bot, or insider lane.",
    note: "audit projection (production persists to the DSQL append-only events_log)",
    tampered_at: tamperAt ?? null,
    ...report,
  });
}
