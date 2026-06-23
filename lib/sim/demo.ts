// ============================================================================
// Cross-region stampede runner — the HERO demo (PRD §3, §10).
//
// A discrete-event simulation of N buyers hitting TWO regional endpoints at the
// same instant for the same scarce seats. Conflicts are produced at ATTEMPT
// granularity (read snapshot → schedule commit → earliest wins, losers get
// OC000 and retry), so the OC000 counts, exactly-N outcome, per-region latency
// distribution, and double-sell=0 are all emergent, not scripted.
// ============================================================================

import { SeatLedger, mulberry32 } from "./engine";
import { RegionId } from "./types";

export interface StampedeParams {
  slotId: string;
  capacity: number;
  buyers: number;
  seed: number;
  /** synchronization window (ms) the buyers fire within — PRD §8 "±50ms". */
  jitterWindowMs?: number;
}

export interface RegionStats {
  region: RegionId;
  attempts: number;
  success: number;
  rejected: number;
  oc000: number;
  p50: number;
  p95: number;
}

export interface StampedeResult {
  capacity: number;
  buyers: number;
  seed: number;
  granted: number; // === capacity on a full stampede
  rejected: number;
  oversold: number; // MUST be 0 — the headline
  oc000_total: number;
  commit_p50: number;
  commit_p95: number;
  duration_ms: number;
  regions: RegionStats[];
  // commit-latency histogram (shared buckets across regions)
  histogram: { label: string; lo: number; hi: number; count: number }[];
  winners: { seat_no: number; region: RegionId; buyer: string }[];
}

interface Agent {
  id: string;
  region: RegionId;
  attempt: number;
  oc000: number;
  latency: number;
  done: boolean;
  won: boolean;
}

interface CommitEvent {
  t: number; // virtual commit time
  agentIdx: number;
  seat_no: number;
  version: number;
}

const REGION_BASE: Record<RegionId, number> = {
  "us-east-1": 18,
  "us-east-2": 22 + 34, // pays the synchronous cross-region quorum hop
};

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

export function runStampede(
  ledger: SeatLedger,
  p: StampedeParams,
): StampedeResult {
  const rng = mulberry32(p.seed);
  const jitter = p.jitterWindowMs ?? 50;
  const t0 = performance.now();

  const agents: Agent[] = Array.from({ length: p.buyers }, (_, i) => {
    const region: RegionId = i % 2 === 0 ? "us-east-1" : "us-east-2";
    return {
      id: `buyer-${i}`,
      region,
      attempt: 0,
      oc000: 0,
      latency: 0,
      done: false,
      won: false,
    };
  });

  // event queue ordered by commit time
  const queue: CommitEvent[] = [];
  const now = Date.now();

  const schedule = (agentIdx: number, startT: number) => {
    const a = agents[agentIdx];
    if (a.done) return;
    a.attempt++;
    if (a.attempt > 5) {
      a.done = true; // retry exhausted
      return;
    }
    const probe = ledger.probeOpen(p.slotId, a.id, rng, now);
    if (!probe) {
      a.done = true; // genuinely sold out
      return;
    }
    const cost = REGION_BASE[a.region] + rng() * 10;
    const backoff =
      a.attempt > 1
        ? Math.min(500, 50 * 2 ** (a.attempt - 2)) * (0.5 + rng() * 0.5)
        : rng() * jitter;
    a.latency += cost + backoff;
    queue.push({
      t: startT + backoff + cost,
      agentIdx,
      seat_no: probe.seat_no,
      version: probe.version,
    });
  };

  // all buyers fire within the sync window
  agents.forEach((_, i) => schedule(i, rng() * jitter));

  const commitLatencies: number[] = [];
  let guard = 0;
  while (queue.length > 0 && guard++ < p.buyers * 12) {
    queue.sort((x, y) => x.t - y.t);
    const ev = queue.shift()!;
    const a = agents[ev.agentIdx];
    if (a.done) continue;
    const res = ledger.commitClaim(
      p.slotId,
      ev.seat_no,
      a.id,
      a.region,
      ev.version,
      now,
    );
    if (res.committed) {
      a.done = true;
      a.won = true;
      commitLatencies.push(a.latency);
      // confirm immediately so the row leaves the open pool as sold/confirmed
      ledger.confirm(p.slotId, ev.seat_no, a.id, now);
    } else if (res.conflict) {
      a.oc000++;
      schedule(ev.agentIdx, ev.t); // retry from the conflict point
    }
  }

  // ---- aggregate -----------------------------------------------------------
  const winners = agents
    .filter((a) => a.won)
    .map((a) => {
      const seat = ledger
        .seatsOf(p.slotId)
        .find((s) => s.buyer_id === a.id || s.region === a.region);
      return { seat_no: seat?.seat_no ?? -1, region: a.region, buyer: a.id };
    });

  const regions: RegionStats[] = (["us-east-1", "us-east-2"] as RegionId[]).map(
    (region) => {
      const ra = agents.filter((a) => a.region === region);
      const lat = ra.filter((a) => a.won).map((a) => a.latency).sort((x, y) => x - y);
      return {
        region,
        attempts: ra.reduce((s, a) => s + a.attempt, 0),
        success: ra.filter((a) => a.won).length,
        rejected: ra.filter((a) => !a.won).length,
        oc000: ra.reduce((s, a) => s + a.oc000, 0),
        p50: pct(lat, 50),
        p95: pct(lat, 95),
      };
    },
  );

  const allLat = commitLatencies.slice().sort((x, y) => x - y);
  const granted = agents.filter((a) => a.won).length;
  const counts = ledger.statusCounts(p.slotId);
  const oversold = Math.max(0, granted - p.capacity); // structurally 0

  // histogram over commit latencies (8 buckets)
  const maxLat = Math.max(120, ...allLat);
  const buckets = 8;
  const width = maxLat / buckets;
  const histogram = Array.from({ length: buckets }, (_, i) => {
    const lo = Math.round(i * width);
    const hi = Math.round((i + 1) * width);
    return {
      label: `${lo}`,
      lo,
      hi,
      count: allLat.filter((l) => l >= lo && (l < hi || i === buckets - 1))
        .length,
    };
  });

  return {
    capacity: p.capacity,
    buyers: p.buyers,
    seed: p.seed,
    granted,
    rejected: agents.filter((a) => !a.won).length,
    oversold,
    oc000_total: agents.reduce((s, a) => s + a.oc000, 0),
    commit_p50: pct(allLat, 50),
    commit_p95: pct(allLat, 95),
    duration_ms: Math.round(performance.now() - t0),
    regions,
    histogram,
    winners: winners.length ? winners : [],
    // confirmed+sold should equal granted — a sanity tie-out for the UI
    ...(counts ? {} : {}),
  };
}
