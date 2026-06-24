// ============================================================================
// Verifiable fair on-sale (LAB-53 / Originality). Every allocation is appended
// to a hash-chained, append-only ledger: a tamper-evident, time-ordered record
// proving each seat was granted in strict GLOBAL commit order on one
// strongly-consistent ledger — no region, bot, or insider got a privileged lane.
//
// This is only meaningful BECAUSE Aurora DSQL gives a single authoritative
// commit order across regions; async multi-region replication cannot. So it
// turns the Technical guarantee into a product claim regulators/artists can
// audit (2026 anti-scalping legislation). Tampering with any entry breaks the
// chain from that point on — visible in the verifier.
//
// NOTE (honesty): this in-memory ledger is an audit *projection* rebuilt from
// claims within a process. In production it persists to the append-only
// events_log on DSQL (PRD §4.1). The hashing/verification is identical.
// ============================================================================
import { createHash } from "node:crypto";

export interface FairnessEntry {
  seq: number;
  event_id: string;
  seat_no: number;
  region: string;
  buyer_fingerprint: string; // sha256(buyerId)[:12] — no PII
  committed_at: number;
  prev_hash: string;
  hash: string;
}

const GENESIS = "0".repeat(64);

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function entryHash(e: Omit<FairnessEntry, "hash">): string {
  return sha256(
    [e.prev_hash, e.seq, e.event_id, e.seat_no, e.region, e.buyer_fingerprint, e.committed_at].join("|"),
  );
}

// module-global so all routes in a process share one ledger (HMR-safe)
const g = globalThis as unknown as { __openslot_fairness?: Map<string, FairnessEntry[]> };
function ledger(): Map<string, FairnessEntry[]> {
  if (!g.__openslot_fairness) g.__openslot_fairness = new Map();
  return g.__openslot_fairness;
}

/** Append one allocation to the chain (called on every successful claim). */
export function recordAllocation(
  eventId: string,
  seatNo: number,
  buyerId: string,
  region: string,
  now = Date.now(),
): FairnessEntry {
  const chain = ledger().get(eventId) ?? [];
  const prev = chain[chain.length - 1];
  const base: Omit<FairnessEntry, "hash"> = {
    seq: chain.length + 1,
    event_id: eventId,
    seat_no: seatNo,
    region,
    buyer_fingerprint: sha256(buyerId).slice(0, 12),
    committed_at: now,
    prev_hash: prev ? prev.hash : GENESIS,
  };
  const entry: FairnessEntry = { ...base, hash: entryHash(base) };
  chain.push(entry);
  ledger().set(eventId, chain);
  return entry;
}

export interface FairnessReport {
  count: number;
  verified: boolean;
  broken_at: number | null; // seq where the chain first fails, if any
  regions: Record<string, number>; // allocations per region (global fairness)
  entries: FairnessEntry[];
}

/**
 * Recompute and verify the whole chain. If `tamperAt` (a seq) is provided, we
 * mutate a COPY of that entry to demonstrate detection — the stored ledger is
 * never modified.
 */
export function verifyChain(eventId: string, tamperAt?: number): FairnessReport {
  const original = ledger().get(eventId) ?? [];
  // work on a copy; optionally corrupt one entry's seat_no to demo tampering
  const chain: FairnessEntry[] = original.map((e) =>
    tamperAt && e.seq === tamperAt ? { ...e, seat_no: e.seat_no + 1 } : { ...e },
  );

  let verified = true;
  let brokenAt: number | null = null;
  let prevHash = GENESIS;
  const regions: Record<string, number> = {};
  for (const e of chain) {
    regions[e.region] = (regions[e.region] ?? 0) + 1;
    const expected = entryHash({ ...e, prev_hash: prevHash });
    if (e.prev_hash !== prevHash || expected !== e.hash) {
      if (verified) brokenAt = e.seq;
      verified = false;
    }
    prevHash = e.hash;
  }
  return { count: chain.length, verified, broken_at: brokenAt, regions, entries: chain };
}

export function resetFairness(eventId: string) {
  ledger().delete(eventId);
}
