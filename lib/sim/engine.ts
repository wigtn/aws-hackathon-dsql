// ============================================================================
// OpenSlot simulation engine — a faithful in-memory model of the Aurora DSQL
// seat ledger. It exists so the hero cross-region stampede demo runs LIVE with
// zero provisioned AWS, while reproducing the exact semantics we claim:
//
//   • row-per-seat contention (PRD §17 C-1/C-3, AWS "spread updates" guidance)
//   • optimistic concurrency control: commit-time conflict → OC000 (PRD §4.1)
//   • snapshot read-set + version check-and-set  → double-sell is impossible
//   • multi-region: synchronous serialization across endpoints, one logical DB
//   • cross-region commit latency (~2 RTT) as an HONEST, modeled cost (PRD §5)
//   • exactly-N capacity, false-full guard, fair re-release on cancel (§3)
//
// When DSQL_ENDPOINT is set, lib/db swaps these calls for the real adapter; the
// SQL there is a 1:1 translation of the check-and-set below.
// ============================================================================

import {
  ClaimResult,
  RegionId,
  SeatRow,
  SeatStatus,
  SENTINEL_BUYER,
  Slot,
} from "./types";

// ---- deterministic PRNG (seedable → reproducible demos, PRD §9) ------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Modeled one-way commit cost by region pair. Cross-region writes pay synchronous
// replication (~2 RTT). These are illustrative ms, the shape is what matters.
const REGION_BASE_MS: Record<RegionId, number> = {
  "us-east-1": 18,
  "us-east-2": 22,
};
const CROSS_REGION_RTT_MS = 34; // virginia <-> ohio synchronous quorum hop

// ---------------------------------------------------------------------------
// SeatLedger — the strongly-consistent store. Single logical DB: a write from
// any region is immediately visible to reads from every region.
// ---------------------------------------------------------------------------
export class SeatLedger {
  private seats = new Map<string, SeatRow>(); // key: `${slot_id}:${seat_no}`
  private bySlot = new Map<string, number[]>(); // slot_id -> seat_no list
  private holdMs: number;

  constructor(holdMs = 120_000) {
    this.holdMs = holdMs;
  }

  private key(slotId: string, seatNo: number) {
    return `${slotId}:${seatNo}`;
  }

  seed(slot: Slot, sections: { section: string; rows: number }[]) {
    let no = 0;
    const list: number[] = [];
    const rowsPerSection = Math.ceil(slot.capacity / sections.length);
    for (const s of sections) {
      for (let r = 0; r < rowsPerSection && no < slot.capacity; r++) {
        no++;
        const rowLabel = String.fromCharCode(65 + (r % 26));
        const seat: SeatRow = {
          id: `${slot.id}-seat-${no}`,
          slot_id: slot.id,
          seat_no: no,
          section: s.section,
          row_label: rowLabel,
          buyer_id: null,
          status: "open",
          version: 1,
          region: null,
          reserved_for: null,
          reserved_until: null,
          hold_expires_at: null,
          claimed_at: null,
        };
        this.seats.set(this.key(slot.id, no), seat);
        list.push(no);
      }
    }
    this.bySlot.set(slot.id, list);
  }

  get(slotId: string, seatNo: number): SeatRow | undefined {
    return this.seats.get(this.key(slotId, seatNo));
  }

  seatsOf(slotId: string): SeatRow[] {
    return (this.bySlot.get(slotId) ?? []).map(
      (n) => this.seats.get(this.key(slotId, n))!,
    );
  }

  /** True remaining open count — the only valid sold-out oracle (PRD §17 C-3). */
  remainingOpen(slotId: string, now = Date.now()): number {
    return this.seatsOf(slotId).filter((s) => this.isClaimable(s, null, now))
      .length;
  }

  private isClaimable(s: SeatRow, buyerId: string | null, now: number): boolean {
    const reservedBlocks =
      s.reserved_for !== null &&
      s.reserved_for !== buyerId &&
      (s.reserved_until ?? 0) > now;
    return s.status === "open" && s.buyer_id === null && !reservedBlocks;
  }

  // 1-per-buyer is an APP-LEVEL guard, not a partial unique index (DSQL has no
  // partial indexes — PRD §17 C-2). "Active" = held|confirmed|activated.
  private buyerHasActiveSeat(slotId: string, buyerId: string): boolean {
    return this.seatsOf(slotId).some(
      (s) =>
        s.buyer_id === buyerId &&
        (s.status === "held" ||
          s.status === "confirmed" ||
          s.status === "activated"),
    );
  }

  /**
   * A single OCC claim attempt against ONE candidate seat (read-set = 1 row).
   * Mirrors the DSQL:
   *   UPDATE seats SET buyer_id=?, status='held', version=version+1 ...
   *   WHERE id=? AND version=? AND buyer_id IS NULL AND status='open'
   * Returns committed=false (with conflict=true) when another tx won the row.
   */
  private tryCommit(
    slotId: string,
    seatNo: number,
    buyerId: string,
    region: RegionId,
    snapshotVersion: number,
    now: number,
  ): { committed: boolean; conflict: boolean } {
    const s = this.seats.get(this.key(slotId, seatNo));
    if (!s) return { committed: false, conflict: false };
    // check-and-set on the read-set version → this is what makes double-sell
    // structurally impossible.
    if (s.version !== snapshotVersion) return { committed: false, conflict: true };
    if (!this.isClaimable(s, buyerId, now))
      return { committed: false, conflict: true };
    s.buyer_id = buyerId;
    s.status = "held";
    s.version += 1;
    s.region = region;
    s.hold_expires_at = now + this.holdMs;
    s.claimed_at = now;
    return { committed: true, conflict: false };
  }

  /**
   * Probe-then-claim with bounded OCC retry (PRD §17 C-3, H-4).
   * Picks a RANDOM open seat by PK, reads its version, attempts check-and-set.
   * Up to 5 attempts with jittered backoff. Distinguishes RETRY_EXHAUSTED (seats
   * may remain — "congested, retry") from true SOLD_OUT.
   */
  claim(
    slotId: string,
    buyerId: string,
    region: RegionId,
    rng: () => number = Math.random,
    now = Date.now(),
  ): ClaimResult {
    let oc000 = 0;
    let latency = 0;
    const base = REGION_BASE_MS[region];

    if (this.buyerHasActiveSeat(slotId, buyerId)) {
      return {
        ok: false,
        region,
        attempts: 0,
        oc000: 0,
        latency_ms: 0,
        error: "ALREADY_HELD",
      };
    }

    for (let attempt = 1; attempt <= 5; attempt++) {
      const open = this.seatsOf(slotId).filter((s) =>
        this.isClaimable(s, buyerId, now),
      );
      if (open.length === 0) {
        return {
          ok: false,
          region,
          attempts: attempt,
          oc000,
          latency_ms: latency,
          error: "SOLD_OUT",
          remaining_open: 0,
        };
      }
      // random PK probe — spreads contention across rows (AWS hot-key guidance)
      const cand = open[Math.floor(rng() * open.length)];
      const commitCost = base + (region === "us-east-2" ? CROSS_REGION_RTT_MS : 0);
      latency += commitCost + Math.floor(rng() * 8);
      const res = this.tryCommit(
        slotId,
        cand.seat_no,
        buyerId,
        region,
        cand.version,
        now,
      );
      if (res.committed) {
        return {
          ok: true,
          seat_no: cand.seat_no,
          region,
          attempts: attempt,
          oc000,
          latency_ms: latency,
          remaining_open: this.remainingOpen(slotId, now),
        };
      }
      if (res.conflict) {
        oc000++;
        // jittered exponential backoff 50–500ms (modeled into latency)
        latency += Math.min(500, 50 * 2 ** (attempt - 1)) * (0.5 + rng() * 0.5);
      }
    }
    return {
      ok: false,
      region,
      attempts: 5,
      oc000,
      latency_ms: latency,
      error: "RETRY_EXHAUSTED",
      remaining_open: this.remainingOpen(slotId, now),
    };
  }

  /** Confirm a held seat → for capacity=1 hero seats this becomes terminal sold. */
  confirm(slotId: string, seatNo: number, buyerId: string, now = Date.now()) {
    const s = this.get(slotId, seatNo);
    if (!s || s.buyer_id !== buyerId || s.status !== "held") return false;
    if ((s.hold_expires_at ?? 0) < now) return false; // hold expired (M-1 guard)
    const cap = this.seatsOf(slotId).length;
    s.status = cap === 1 ? "sold" : "confirmed";
    s.version += 1;
    s.hold_expires_at = null;
    return true;
  }

  /**
   * Cancel + fair re-release (PRD §3, §17). Seat → released (buyer = sentinel,
   * NOT null — we never depend on NULL-uniqueness, §17 C-2), then locked-offered
   * to waitlist #1 via reserved_for + reserved_until.
   */
  cancelAndReoffer(
    slotId: string,
    seatNo: number,
    buyerId: string,
    offerTo: string | null,
    offerWindowMs = 300_000,
    now = Date.now(),
  ): boolean {
    const s = this.get(slotId, seatNo);
    if (!s || s.buyer_id !== buyerId) return false;
    s.buyer_id = SENTINEL_BUYER;
    s.status = "released";
    s.version += 1;
    s.hold_expires_at = null;
    s.claimed_at = null;
    if (offerTo) {
      // re-open the row but lock it for the #1 waitlister only.
      s.status = "open";
      s.buyer_id = null;
      s.reserved_for = offerTo;
      s.reserved_until = now + offerWindowMs;
    } else {
      s.status = "open";
      s.buyer_id = null;
    }
    return true;
  }

  /** Cron-style sweep: expire stale holds and stale offers back to open pool. */
  sweep(slotId: string, now = Date.now()): { holds: number; offers: number } {
    let holds = 0;
    let offers = 0;
    for (const s of this.seatsOf(slotId)) {
      if (s.status === "held" && (s.hold_expires_at ?? 0) < now) {
        s.status = "open";
        s.buyer_id = null;
        s.hold_expires_at = null;
        s.version += 1;
        holds++;
      }
      if (s.reserved_until !== null && s.reserved_until < now) {
        s.reserved_for = null;
        s.reserved_until = null;
        offers++;
      }
    }
    return { holds, offers };
  }

  // ---- primitives exposed for the discrete-event stampede runner ----------
  /** Read-set probe: pick a random claimable seat and capture its version. */
  probeOpen(
    slotId: string,
    buyerId: string,
    rng: () => number,
    now: number,
  ): { seat_no: number; version: number } | null {
    const open = this.seatsOf(slotId).filter((s) =>
      this.isClaimable(s, buyerId, now),
    );
    if (open.length === 0) return null;
    const s = open[Math.floor(rng() * open.length)];
    return { seat_no: s.seat_no, version: s.version };
  }

  /** Public check-and-set used by the runner at attempt granularity. */
  commitClaim(
    slotId: string,
    seatNo: number,
    buyerId: string,
    region: RegionId,
    snapshotVersion: number,
    now: number,
  ): { committed: boolean; conflict: boolean } {
    return this.tryCommit(slotId, seatNo, buyerId, region, snapshotVersion, now);
  }

  snapshot(slotId: string): SeatRow[] {
    return this.seatsOf(slotId).map((s) => ({ ...s }));
  }

  statusCounts(slotId: string): Record<SeatStatus, number> {
    const acc = {
      open: 0,
      held: 0,
      confirmed: 0,
      activated: 0,
      released: 0,
      sold: 0,
    } as Record<SeatStatus, number>;
    for (const s of this.seatsOf(slotId)) acc[s.status]++;
    return acc;
  }
}
