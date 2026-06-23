// ============================================================================
// Optimistic-concurrency retry wrapper — the production Aurora DSQL path.
// PRD §4.1 H-4 + CLAUDE.md §3.2. Classifies and retries BOTH conflict codes:
//   OC000  change conflicts with another transaction  (data conflict)
//   OC001  schema has been updated by another transaction (DDL conflict)
// Jittered exponential backoff, max 5 attempts, fresh transaction each retry.
//
// In simulation mode the SeatLedger embodies these semantics directly; this
// wrapper is what wraps real `pg` transactions when DSQL_ENDPOINT is set.
// ============================================================================

export type OccCode = "OC000" | "OC001";

export class OccConflict extends Error {
  constructor(public code: OccCode) {
    super(`${code}: change conflicts with another transaction, please retry`);
    this.name = "OccConflict";
  }
}

export function isOccError(err: unknown): OccCode | null {
  const code = (err as { code?: string; message?: string })?.code;
  const msg = (err as { message?: string })?.message ?? "";
  if (code === "OC000" || /\(OC000\)/.test(msg)) return "OC000";
  if (code === "OC001" || /\(OC001\)/.test(msg)) return "OC001";
  return null;
}

export interface RetryOutcome<T> {
  value: T;
  attempts: number;
  oc000: number;
  oc001: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` (a single DSQL transaction) under bounded OCC retry. `fn` MUST be
 * idempotent / re-runnable: each retry opens a fresh transaction and re-reads
 * its snapshot (live-lock avoidance — PRD §4.1 H-4).
 */
export async function withOccRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { max?: number; baseMs?: number; capMs?: number } = {},
): Promise<RetryOutcome<T>> {
  const max = opts.max ?? 5;
  const base = opts.baseMs ?? 50;
  const cap = opts.capMs ?? 500;
  let oc000 = 0;
  let oc001 = 0;

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const value = await fn(attempt);
      return { value, attempts: attempt, oc000, oc001 };
    } catch (err) {
      const code = isOccError(err);
      if (!code) throw err; // not a conflict → real error, bubble up
      if (code === "OC000") oc000++;
      else oc001++;
      if (attempt === max) {
        // surrender as a domain signal, not an HTTP 500 (PRD §4.1 H-4)
        const e = new OccConflict(code);
        (e as OccConflict & { exhausted: boolean }).exhausted = true;
        throw e;
      }
      const backoff = Math.min(cap, base * 2 ** (attempt - 1));
      await sleep(backoff * (0.5 + Math.random() * 0.5)); // full jitter
    }
  }
  // unreachable
  throw new OccConflict("OC000");
}
