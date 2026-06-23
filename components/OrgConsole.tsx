"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Eyebrow, Tag, Meter } from "@/components/ui";

interface EvOpt {
  id: string;
  title: string;
  capacity: number;
}
interface Seat {
  seat_no: number;
  section: string;
  row_label: string;
  status: string;
  reserved_for: string | null;
}
interface Snapshot {
  capacity: number;
  remaining_open: number;
  counts: Record<string, number>;
  seats: Seat[];
}

export function OrgConsole({ events }: { events: EvOpt[] }) {
  const sellable = events.filter((e) => e.capacity > 1);
  const [eventId, setEventId] = useState(sellable[0]?.id ?? events[0].id);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const owned = useRef<Map<number, string>>(new Map()); // seat_no -> sim buyer

  const load = useCallback(async () => {
    const res = await fetch(`/api/claim?eventId=${eventId}`, { cache: "no-store" });
    if (res.ok) setSnap(await res.json());
  }, [eventId]);

  useEffect(() => {
    owned.current = new Map();
    setQueue([]);
    setLog([]);
    load();
    const id = setInterval(load, 1200);
    return () => clearInterval(id);
  }, [load, eventId]);

  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 8));

  async function fillSome(n: number) {
    setBusy(true);
    for (let i = 0; i < n; i++) {
      const buyer = `sim-${Math.floor(Math.random() * 1e6)}`;
      const region = i % 2 ? "us-east-2" : "us-east-1";
      const res = await fetch("/api/claim", {
        method: "POST",
        body: JSON.stringify({ action: "claim", eventId, buyerId: buyer, region }),
      });
      const d = await res.json();
      if (d.ok) {
        owned.current.set(d.seat_no, buyer);
        await fetch("/api/claim", {
          method: "POST",
          body: JSON.stringify({ action: "confirm", eventId, buyerId: buyer, seatNo: d.seat_no }),
        });
      }
    }
    say(`${n} buyers claimed + confirmed across both regions`);
    await load();
    setBusy(false);
  }

  async function addWaitlister() {
    const buyer = `fan-${queue.length + 1}`;
    await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "waitlist", eventId, buyerId: buyer }),
    });
    setQueue((q) => [...q, buyer]);
    say(`${buyer} joined the waitlist at #${queue.length + 1}`);
  }

  async function cancelAndReoffer() {
    const entry = [...owned.current.entries()][0];
    if (!entry) return say("no confirmed seat to cancel — fill some first");
    const [seatNo, buyer] = entry;
    const res = await fetch("/api/claim", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", eventId, buyerId: buyer, seatNo }),
    });
    const d = await res.json();
    owned.current.delete(seatNo);
    if (d.reoffered_to) {
      setQueue((q) => q.filter((x) => x !== d.reoffered_to));
      say(`seat #${seatNo} released → LOCKED offer to ${d.reoffered_to} (#1). bots can't grab it.`);
    } else {
      say(`seat #${seatNo} released → open (no one waiting)`);
    }
    await load();
  }

  const filled = snap ? snap.capacity - snap.remaining_open : 0;

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
      {/* live floor */}
      <div>
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mono focusable"
            style={{ fontSize: 14, padding: "9px 12px", border: "1px solid var(--color-ink)", background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · cap {e.capacity}</option>
            ))}
          </select>
          {snap && snap.remaining_open === 0 && <Tag tone="signal">sold out</Tag>}
        </div>

        {snap && (
          <>
            <div className="frame" style={{ padding: 16, marginBottom: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <Eyebrow>live floor · DSQL ledger</Eyebrow>
                <span className="num" style={{ fontSize: 13 }}>{filled}/{snap.capacity} filled</span>
              </div>
              <Meter value={filled} max={snap.capacity} hot={snap.remaining_open === 0} />
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: "repeat(auto-fill,minmax(26px,1fr))", marginTop: 16 }}
              >
                {snap.seats.map((s) => (
                  <div
                    key={s.seat_no}
                    className="seat"
                    data-status={s.reserved_for ? "held" : s.status}
                    style={{ fontSize: 8 }}
                    title={s.reserved_for ? `locked offer → ${s.reserved_for}` : `${s.section} ${s.row_label} · ${s.status}`}
                  >
                    {s.reserved_for ? "★" : ""}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn focusable" disabled={busy} onClick={() => fillSome(8)}>+ 8 buyers</button>
              <button className="btn focusable" disabled={busy} onClick={() => fillSome(snap.remaining_open)}>
                fill to sold out
              </button>
              <button className="btn focusable" onClick={addWaitlister}>+ waitlister</button>
              <button className="btn btn-signal focusable" onClick={cancelAndReoffer}>
                cancel a seat → re-offer
              </button>
            </div>
          </>
        )}
      </div>

      {/* fair re-release rail */}
      <aside>
        <div className="frame" style={{ padding: 16, marginBottom: 14 }}>
          <Eyebrow>waitlist · {queue.length}</Eyebrow>
          {queue.length === 0 ? (
            <p className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 8 }}>
              empty — add fans, then cancel a seat to watch the #1 get a locked offer.
            </p>
          ) : (
            <ol style={{ marginTop: 8, listStyle: "none" }}>
              {queue.map((b, i) => (
                <li key={b} className="flex justify-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--color-line)" }}>
                  <span className="num" style={{ fontSize: 12 }}>#{i + 1}</span>
                  <span className="mono" style={{ fontSize: 12, color: i === 0 ? "var(--color-signal)" : "var(--color-ink-2)" }}>
                    {b}{i === 0 ? " ← first refusal" : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <Eyebrow>event log</Eyebrow>
          <div style={{ marginTop: 8 }}>
            {log.length === 0 ? (
              <span className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>—</span>
            ) : (
              log.map((l, i) => (
                <div key={i} className="mono" style={{ fontSize: 11.5, color: i === 0 ? "var(--color-ink)" : "var(--color-ink-3)", padding: "3px 0" }}>
                  → {l}
                </div>
              ))
            )}
          </div>
        </div>

        <p className="mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 12, lineHeight: 1.6 }}>
          A cancelled seat is never thrown back into the open pool for the fastest
          bot. It&apos;s released and <strong>locked</strong> to the #1 waitlister via
          reserved_for + reserved_until — fair by construction.
        </p>
      </aside>
    </div>
  );
}
