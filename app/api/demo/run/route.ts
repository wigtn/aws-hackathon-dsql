import { NextRequest, NextResponse } from "next/server";
import { SeatLedger } from "@/lib/sim/engine";
import { runStampede } from "@/lib/sim/demo";
import { Slot } from "@/lib/sim/types";
import { REGION_MODE } from "@/lib/db";

// POST /api/demo/run  { capacity, buyers, seed }
// Builds an ISOLATED, freshly-seeded ledger (reproducible by seed) and fires a
// two-region stampede at it. Returns the full metric set for the hero dashboard.
// This is the Best-Technical money shot (PRD §10): oversold MUST be 0.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const capacity = Math.max(1, Math.min(200, Number(body.capacity) || 1));
  const buyers = Math.max(2, Math.min(2000, Number(body.buyers) || 500));
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : 42;

  const ledger = new SeatLedger();
  const slot: Slot = {
    id: "demo-slot",
    event_id: "demo",
    capacity,
    sale_opens_at: Date.now() - 1000,
  };
  const sections =
    capacity <= 1
      ? [{ section: "GA", rows: 1 }]
      : [
          { section: "FLOOR", rows: Math.ceil(capacity / 3) },
          { section: "LWR", rows: Math.ceil(capacity / 3) },
          { section: "UPR", rows: Math.ceil(capacity / 3) },
        ];
  ledger.seed(slot, sections);

  const result = runStampede(ledger, {
    slotId: slot.id,
    capacity,
    buyers,
    seed,
    jitterWindowMs: 50,
  });

  return NextResponse.json({
    config: {
      regions: ["us-east-1 (N. Virginia)", "us-east-2 (Ohio)"],
      witness: "us-west-2 (Oregon) · quorum tiebreaker, no endpoint",
      isolation: "snapshot · OCC (OC000 on conflict)",
      // This endpoint is ALWAYS a deterministic in-memory load generator (it
      // models DSQL OCC at barrel-synchronized max contention). The live data
      // plane backing the real app is reported separately; the real cross-region
      // OC000 proof on Aurora DSQL is scripts/dsql-setup.mjs (FR-A2).
      engine: "simulation (in-memory load generator)",
      live_data_plane: REGION_MODE,
      real_proof: "scripts/dsql-setup.mjs (live multi-region Aurora DSQL)",
    },
    result,
  });
}
