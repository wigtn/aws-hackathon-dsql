import { NextRequest, NextResponse } from "next/server";
import { verifyAllocations } from "@/lib/fairness";
import { getData } from "@/lib/data";

// GET /api/fairness?eventId=&tamper=N
// Hash-chained allocation ledger + verification, projected from the seat ledger
// (strongly-consistent on the DSQL plane → identical on every instance). `tamper`
// (a seq) demonstrates tamper-detection without mutating the source.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const tamperRaw = req.nextUrl.searchParams.get("tamper");
  const tamperAt = tamperRaw ? Number(tamperRaw) : undefined;
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const allocs = await getData().fairnessAllocations(eventId);
  const report = verifyAllocations(eventId, allocs, tamperAt);
  return NextResponse.json({
    claim:
      "Allocated in strict global commit order on one strongly-consistent ledger — no region, bot, or insider lane.",
    note: "projected live from the DSQL seat ledger (the authoritative commit order)",
    tampered_at: tamperAt ?? null,
    ...report,
  });
}
