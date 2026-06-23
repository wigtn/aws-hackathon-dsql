"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tag, Meter } from "@/components/ui";

interface Seat {
  seat_no: number;
  section: string;
  row_label: string;
  status: string;
}
interface Snapshot {
  capacity: number;
  remaining_open: number;
  counts: Record<string, number>;
  seats: Seat[];
  sale_opens_at: number;
}

export function SeatMap({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/claim?eventId=${eventId}`, { cache: "no-store" });
    if (res.ok) setSnap(await res.json());
  }, [eventId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 1500); // live ledger poll
    return () => clearInterval(id);
  }, [load]);

  if (!snap)
    return (
      <div className="frame" style={{ padding: 28 }}>
        <span className="mono" style={{ color: "var(--color-ink-3)" }}>
          loading seat ledger…
        </span>
      </div>
    );

  const isHero = snap.capacity === 1;
  const live = snap.sale_opens_at <= Date.now();
  const soldOut = snap.remaining_open === 0;

  // group seats by section for the relational seat-map render (PRD §17 C-1)
  const sections = Array.from(new Set(snap.seats.map((s) => s.section)));

  return (
    <div>
      {/* status ledger row */}
      <div
        className="panel flex flex-wrap items-center gap-x-8 gap-y-2"
        style={{ padding: "12px 16px", marginBottom: 16 }}
      >
        {(["open", "held", "confirmed", "sold"] as const).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className={`seat`} data-status={k === "confirmed" ? "confirmed" : k} style={{ width: 14, height: 14, padding: 0 }} />
            <span className="eyebrow">{k}</span>
            <span className="num" style={{ fontSize: 13 }}>
              {snap.counts[k === "sold" ? "sold" : k] ?? 0}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }} className="flex items-center gap-3">
          <span className="eyebrow">filled</span>
          <div style={{ width: 120 }}>
            <Meter value={snap.capacity - snap.remaining_open} max={snap.capacity} hot={soldOut} />
          </div>
          <span className="num" style={{ fontSize: 13 }}>
            {snap.capacity - snap.remaining_open}/{snap.capacity}
          </span>
        </div>
      </div>

      {isHero ? (
        // Hero last-seat: a single dramatic unit, not a grid.
        <div
          className="frame"
          style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              one seat · the whole world
            </div>
            <div className="display" style={{ fontSize: 40 }}>
              {soldOut ? "Claimed." : "1 seat open"}
            </div>
            <div className="mono" style={{ fontSize: 13, color: "var(--color-ink-3)", marginTop: 6 }}>
              {soldOut
                ? "strong-consistent across both regions — instantly."
                : "first commit wins. the loser sees OC000, not a double sale."}
            </div>
          </div>
          <button
            className={`btn ${soldOut ? "" : "btn-signal"} focusable`}
            disabled={soldOut || !live}
            onClick={() => router.push(`/claim/${eventId}`)}
            style={{ fontSize: 15, padding: "16px 26px" }}
          >
            {soldOut ? "sold out" : live ? "claim the seat →" : "not on sale yet"}
          </button>
        </div>
      ) : (
        <div className="frame" style={{ padding: 18 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <span className="eyebrow">stage</span>
            <span className="eyebrow">{snap.remaining_open} of {snap.capacity} open</span>
          </div>
          <div
            style={{
              height: 4,
              background: "var(--color-ink)",
              marginBottom: 20,
              borderRadius: 2,
            }}
          />
          {sections.map((sec) => (
            <div key={sec} style={{ marginBottom: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {sec}
              </div>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))" }}
              >
                {snap.seats
                  .filter((s) => s.section === sec)
                  .map((s) => {
                    const claimable = s.status === "open" && live;
                    return (
                      <div
                        key={s.seat_no}
                        className="seat focusable"
                        data-status={s.status}
                        data-selected={selected === s.seat_no}
                        onClick={() => claimable && setSelected(s.seat_no)}
                        title={`${s.section} ${s.row_label}${s.seat_no} · ${s.status}`}
                      >
                        {s.seat_no}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          <div
            className="flex items-center justify-between"
            style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--color-line)" }}
          >
            <div className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
              {selected ? (
                <>selected seat <span className="num">#{selected}</span></>
              ) : soldOut ? (
                <Tag tone="signal">sold out — join the waitlist</Tag>
              ) : (
                "pick any open seat, or let us assign one"
              )}
            </div>
            <button
              className="btn btn-primary focusable"
              disabled={!live || soldOut}
              onClick={() =>
                router.push(`/claim/${eventId}${selected ? `?seat=${selected}` : ""}`)
              }
            >
              {soldOut ? "waitlist" : "claim →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
