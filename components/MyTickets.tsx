"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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

  if (!ready) return <div className="mono" style={{ color: "var(--pk-ink2)" }}>loading…</div>;

  if (!buyerId)
    return (
      <div className="pn">
        <div className="ph"><h3>Not signed in</h3></div>
        <p className="mono" style={{ fontSize: 13, color: "var(--pk-ink2)", margin: "0 0 16px" }}>
          Your tickets bind to a verified phone + this device. Get a ticket to start.
        </p>
        <Link href="/discover" className="btn btn-ink-fill focusable">Browse events →</Link>
      </div>
    );

  return (
    <div>
      {tickets.length === 0 && waitlist.length === 0 && (
        <div className="pn"><span className="mono" style={{ color: "var(--pk-ink2)" }}>No tickets yet.</span></div>
      )}

      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {tickets.map((t) => (
          <TicketStub key={`${t.event_id}-${t.seat_label}`} t={t} />
        ))}
      </div>

      {waitlist.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="lbl" style={{ color: "var(--pk-ink2)", marginBottom: 10 }}>Waitlist · first refusal on cancellations</div>
          <div className="pn">
            <ul className="brk">
              {waitlist.map((w) => (
                <li key={w.title}><span className="mono">{w.title}</span><span className="num">#{w.position} in queue</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Rotating gate code (TOTP-style, 30s window). The static secret is never shown;
// it rotates so a screenshot expires.
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
    <div className="ticket">
      <div className="tt">
        <span className="badge">{activated ? "activated ✓" : "valid ✓"}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--pk-ink2)" }}>confirmed</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 21, textTransform: "uppercase", letterSpacing: "-.02em", lineHeight: 1.05 }}>{t.title}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--pk-ink2)", margin: "8px 0 16px" }}>
          {t.venue} · {t.city} · seat {t.seat_label}
        </div>

        {/* rotating gate code */}
        <div style={{ border: "1.5px solid var(--pk-ink)", borderRadius: 10, padding: 14, background: "var(--cream2)" }}>
          <div className="flex items-center justify-between">
            <span className="lbl" style={{ color: "var(--pk-ink2)" }}>Gate code</span>
            <span className="code">{code}</span>
          </div>
          <div className="cmeter" style={{ marginTop: 12 }}>
            <span className="fill" style={{ width: `${pct}%`, display: "block", height: "100%", transition: "width .25s linear" }} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 8 }}>
            Refreshes every 30s · a screenshot won&apos;t work · scanned at the gate
          </div>
        </div>
      </div>
    </div>
  );
}
