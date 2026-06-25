"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [load]);

  if (!snap)
    return (
      <div className="pn">
        <span className="mono" style={{ color: "var(--pk-ink2)" }}>loading seats…</span>
      </div>
    );

  const isHero = snap.capacity === 1;
  const live = snap.sale_opens_at <= Date.now();
  const soldOut = snap.remaining_open === 0;
  const filled = snap.capacity - snap.remaining_open;
  const sections = Array.from(new Set(snap.seats.map((s) => s.section)));

  return (
    <div>
      {/* status row */}
      <div className="pn" style={{ marginBottom: 16 }}>
        <div className="seatstat">
          <span className="s"><i /> {snap.counts.open ?? 0} open</span>
          <span className="s"><i className="held" /> {snap.counts.held ?? 0} on hold</span>
          <span className="s"><i className="sold" /> {(snap.counts.confirmed ?? 0) + (snap.counts.sold ?? 0)} sold</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="num" style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 18 }}>{filled}/{snap.capacity}</span>
            <span className="cmeter" style={{ width: 120 }}>
              <span className="fill" style={{ width: `${(filled / Math.max(1, snap.capacity)) * 100}%` }} />
            </span>
          </span>
        </div>
      </div>

      {isHero ? (
        <div className="pn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="lbl" style={{ color: "var(--pk-ink2)" }}>One seat · the whole world</div>
            <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 44, textTransform: "uppercase", letterSpacing: "-.03em", lineHeight: 1, margin: "8px 0 8px" }}>
              {soldOut ? "Claimed" : "1 seat open"}
            </div>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--pk-ink2)", maxWidth: 340, lineHeight: 1.55 }}>
              {soldOut
                ? "Claimed once — and that's final, everywhere, instantly."
                : "Whoever confirms first gets it. No one else can double-book it."}
            </div>
          </div>
          <button
            className={`btn ${soldOut ? "btn-ink" : "btn-purple"} focusable`}
            disabled={soldOut || !live}
            onClick={() => router.push(`/claim/${eventId}`)}
            style={{ fontSize: 14, padding: "15px 26px", opacity: soldOut || !live ? 0.5 : 1 }}
          >
            {soldOut ? "Sold out" : live ? "Get this seat →" : "Not on sale yet"}
          </button>
        </div>
      ) : (
        <div className="pn">
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <span className="lbl" style={{ color: "var(--pk-ink2)" }}>Stage</span>
            <span className="lbl" style={{ color: "var(--pk-ink2)" }}>{snap.remaining_open} of {snap.capacity} open</span>
          </div>
          <div style={{ height: 4, background: "var(--purple)", marginBottom: 8, borderRadius: 2 }} />

          {sections.map((sec) => (
            <div key={sec}>
              <div className="section-h">{sec}</div>
              <div className="seatrow">
                {snap.seats
                  .filter((s) => s.section === sec)
                  .map((s) => {
                    const claimable = s.status === "open" && live;
                    return (
                      <div
                        key={s.seat_no}
                        className="pseat focusable"
                        data-status={s.status}
                        data-selected={selected === s.seat_no}
                        onClick={() => claimable && setSelected(selected === s.seat_no ? null : s.seat_no)}
                        title={`${s.section} ${s.row_label}${s.seat_no} · ${s.status}`}
                      >
                        {selected === s.seat_no ? "✓" : s.seat_no}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--pink-line)", flexWrap: "wrap", gap: 12 }}>
            <div className="mono" style={{ fontSize: 13, color: "var(--pk-ink2)" }}>
              {selected ? (
                <>selected seat <span className="num" style={{ color: "var(--purple)", fontWeight: 600 }}>#{selected}</span></>
              ) : soldOut ? (
                "Sold out — join the waitlist"
              ) : (
                "Pick any open seat, or let us assign one"
              )}
            </div>
            <button
              className="btn btn-purple focusable"
              disabled={!live || soldOut}
              onClick={() => router.push(`/claim/${eventId}${selected ? `?seat=${selected}` : ""}`)}
              style={{ opacity: !live || soldOut ? 0.5 : 1 }}
            >
              {soldOut ? "Join waitlist" : "Get tickets →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
