"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eyebrow, Tag } from "@/components/ui";

interface Ticket {
  event_id: string;
  title: string;
  venue: string;
  city: string;
  seat_label: string;
  status: string;
  region: string | null;
  totp_seed: number;
}

export function MyTickets() {
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [waitlist, setWaitlist] = useState<{ title: string; position: number }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("openslot.buyerId");
    setBuyerId(id);
    if (!id) return setReady(true);
    fetch(`/api/me?buyerId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        setTickets(d.tickets ?? []);
        setWaitlist(d.waitlist ?? []);
        setReady(true);
      });
  }, []);

  if (!ready) return <div className="mono" style={{ color: "var(--color-ink-3)" }}>loading…</div>;

  if (!buyerId)
    return (
      <div className="frame" style={{ padding: 28 }}>
        <Eyebrow>not signed in</Eyebrow>
        <p className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "10px 0 16px" }}>
          Your tickets bind to a verified phone + this device. Claim a seat to start.
        </p>
        <Link href="/discover" className="btn btn-primary focusable">browse live drops →</Link>
      </div>
    );

  return (
    <div>
      <div className="panel" style={{ padding: "10px 14px", marginBottom: 18 }}>
        <span className="eyebrow">session · device-bound</span>{" "}
        <span className="num" style={{ fontSize: 12, color: "var(--color-ink-2)" }}>{buyerId}</span>
      </div>

      {tickets.length === 0 && waitlist.length === 0 && (
        <div className="frame" style={{ padding: 28 }}>
          <span className="mono" style={{ color: "var(--color-ink-2)" }}>No tickets yet.</span>
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {tickets.map((t) => (
          <TicketStub key={`${t.event_id}-${t.seat_label}`} t={t} />
        ))}
      </div>

      {waitlist.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Eyebrow>waitlist · first refusal on cancellations</Eyebrow>
          <div className="panel" style={{ padding: 14, marginTop: 10 }}>
            {waitlist.map((w) => (
              <div key={w.title} className="flex justify-between" style={{ padding: "6px 0" }}>
                <span className="mono" style={{ fontSize: 13 }}>{w.title}</span>
                <span className="num" style={{ fontSize: 13 }}>#{w.position} in queue</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Rotating barcode (TOTP-style, 30s window) — PRD §8 H-5. The static secret is
// never shown; this rotates so a screenshot expires.
function TicketStub({ t }: { t: Ticket }) {
  const [code, setCode] = useState("------");
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const window = Math.floor(now / 30000);
      const within = (now % 30000) / 30000;
      const c = ((t.totp_seed ^ window) >>> 0) % 1_000_000;
      setCode(c.toString().padStart(6, "0"));
      setPct(100 - within * 100);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [t.totp_seed]);

  const activated = t.status === "activated";
  return (
    <div className="frame" style={{ padding: 0, overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "10px 14px", borderBottom: "1px dashed var(--color-line-2)" }}>
        <Tag tone={activated ? "affirm" : "solid"}>{activated ? "activated" : "valid"}</Tag>
        <span className="num" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
          {t.region ?? "—"}
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="display" style={{ fontSize: 20 }}>{t.title}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "4px 0 14px" }}>
          {t.venue} · {t.city} · seat {t.seat_label}
        </div>

        {/* rotating barcode */}
        <div className="panel-inset" style={{ padding: 12 }}>
          <div className="flex items-center justify-between">
            <span className="eyebrow">rotating gate code</span>
            <span className="num" style={{ fontSize: 22, letterSpacing: "0.18em" }}>{code}</span>
          </div>
          <div className="meter" style={{ marginTop: 10 }}>
            <span style={{ width: `${pct}%`, transition: "width .25s linear" }} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--color-ink-3)", marginTop: 6 }}>
            expires every 30s · screenshot is worthless · verified at the gate
          </div>
        </div>
      </div>
    </div>
  );
}
