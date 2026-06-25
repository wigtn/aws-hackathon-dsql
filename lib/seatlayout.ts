// ============================================================================
// Seat layout → seat rows. The layout an organizer picks is PURELY a
// presentation/config layer: every seat becomes one row in the DSQL ledger, so
// the zero-oversell (OCC) guarantee is identical for GA, sections, or a grid.
// This module is the single generator both the simulation store and the real
// DSQL adapter use to turn a chosen layout into concrete seat specs.
// ============================================================================

export type SeatLayout =
  | { kind: "ga"; capacity: number }
  | { kind: "sections"; sections: { name: string; count: number }[] }
  | { kind: "grid"; rows: number; cols: number };

export interface SeatSpec {
  id: string;
  seat_no: number;
  section: string;
  row_label: string;
}

const MAX_TOTAL = 500; // demo bound (matches the createDrop capacity clamp)
const SEATS_PER_ROW = 12; // for labeling rows within a section
const rowLabel = (idx: number) =>
  (idx >= 26 ? String.fromCharCode(64 + Math.floor(idx / 26)) : "") +
  String.fromCharCode(65 + (idx % 26));

/** Clamp a (possibly client-supplied) layout to safe demo bounds. */
export function sanitizeLayout(raw: unknown): SeatLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (l.kind === "ga") {
    const capacity = clamp(Number(l.capacity) || 1, 1, MAX_TOTAL);
    return { kind: "ga", capacity };
  }
  if (l.kind === "grid") {
    let rows = clamp(Math.round(Number(l.rows) || 1), 1, 50);
    let cols = clamp(Math.round(Number(l.cols) || 1), 1, 40);
    while (rows * cols > MAX_TOTAL) cols > rows ? cols-- : rows--;
    return { kind: "grid", rows, cols };
  }
  if (l.kind === "sections" && Array.isArray(l.sections)) {
    const sections: { name: string; count: number }[] = [];
    let total = 0;
    for (const s of (l.sections as unknown[]).slice(0, 8)) {
      const so = s as Record<string, unknown>;
      const name = String(so.name ?? "").trim().slice(0, 16) || "SEC";
      let count = clamp(Math.round(Number(so.count) || 1), 1, MAX_TOTAL);
      if (total + count > MAX_TOTAL) count = MAX_TOTAL - total;
      if (count <= 0) break;
      sections.push({ name, count });
      total += count;
    }
    return sections.length ? { kind: "sections", sections } : null;
  }
  return null;
}

export function layoutCapacity(layout: SeatLayout): number {
  if (layout.kind === "ga") return layout.capacity;
  if (layout.kind === "grid") return layout.rows * layout.cols;
  return layout.sections.reduce((a, s) => a + s.count, 0);
}

/** Expand a layout into concrete, globally-numbered seat specs for a slot. */
export function seatSpecsFromLayout(slotId: string, layout: SeatLayout): SeatSpec[] {
  const out: SeatSpec[] = [];
  let no = 0;
  const push = (section: string, label: string) => {
    no++;
    out.push({ id: `${slotId}-seat-${no}`, seat_no: no, section, row_label: label });
  };
  if (layout.kind === "ga") {
    for (let i = 0; i < layout.capacity; i++) push("GA", "GA");
  } else if (layout.kind === "grid") {
    for (let r = 0; r < layout.rows; r++) {
      const label = rowLabel(r);
      for (let c = 0; c < layout.cols; c++) push("MAIN", label);
    }
  } else {
    for (const sec of layout.sections) {
      const name = (sec.name || "SEC").toUpperCase();
      for (let i = 0; i < sec.count; i++) push(name, rowLabel(Math.floor(i / SEATS_PER_ROW)));
    }
  }
  return out;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}
