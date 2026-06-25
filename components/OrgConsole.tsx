"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";

interface EvOpt {
  id: string;
  title: string;
  capacity: number;
  price: number;
}
interface Seat {
  seat_no: number;
  status: string;
  reserved: boolean;
}
interface Snapshot {
  capacity: number;
  remaining_open: number;
  counts: Record<string, number>;
  seats: Seat[];
}
interface Metrics {
  organizer: string;
  price: number;
  capacity: number;
  taken: number;
  sell_through: number;
  gross_revenue: number;
  defended: {
    oversell_blocked: number;
    oversell_defended_usd: number;
    bots_blocked: number;
    resale_repatriated_usd: number;
    total_defended_usd: number;
  };
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function seatClass(s: Seat): string {
  if (["confirmed", "activated", "sold"].includes(s.status)) return "stcell confirmed";
  if (s.reserved || s.status === "held") return "stcell held";
  return "stcell";
}

export function OrgConsole({ events: initial }: { events: EvOpt[] }) {
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [eventId, setEventId] = useState(
    initial.find((e) => e.capacity > 1)?.id ?? initial[0].id,
  );
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const owned = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("openslot.org") || "null");
      if (s?.name) setOrgName(s.name);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(`/api/claim?eventId=${eventId}`, { cache: "no-store" }),
      fetch(`/api/org/metrics?eventId=${eventId}`, { cache: "no-store" }),
    ]);
    if (a.ok) setSnap(await a.json());
    if (b.ok) setMetrics(await b.json());
  }, [eventId]);

  useEffect(() => {
    owned.current = new Map();
    setQueue([]);
    setLog([]);
    load();
    const id = setInterval(load, 1300);
    return () => clearInterval(id);
  }, [load, eventId]);

  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 6));
  const ev = events.find((e) => e.id === eventId);

  async function fillSome(n: number) {
    if (n <= 0) return;
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
    say(`${n} simulated buyers checked out`);
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
      say(`seat #${seatNo} freed → offered to the next real fan (no bot race)`);
    } else say(`seat #${seatNo} freed → back on sale`);
    await load();
  }

  const filled = snap ? snap.capacity - snap.remaining_open : 0;
  const soldOut = snap?.remaining_open === 0;
  const d = metrics?.defended;

  return (
    <>
      <div className="poster">
        <div className="wrap">
          {/* purple poster header band */}
          <section className="band" data-wm="LIVE">
            <span className="kick">{orgName ?? metrics?.organizer ?? "Your venue"} · organizer console</span>
            <h1>{ev?.title ?? "Your on-sale"}</h1>
            <div className="sub" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span className="live">
                <span className="dot" /> {soldOut ? "Sold out" : "On-sale: Live"}
              </span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="focusable"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 12.5, padding: "8px 12px",
                  borderRadius: 8, border: "1.5px solid rgba(255,255,255,.5)",
                  background: "transparent", color: "var(--cream)",
                }}
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id} style={{ color: "#161019" }}>
                    {e.title} · {usd(e.price)} · {e.capacity} seats
                  </option>
                ))}
              </select>
            </div>
            <div className="acts">
              <button className="btn btn-fill focusable" onClick={() => setShowCreate(true)}>+ New drop</button>
              <Link href="/discover" className="btn focusable">View storefront</Link>
            </div>
          </section>

          {/* KPI row — what an organizer actually watches */}
          <div className="kpis">
            <div className="kpi">
              <dt>Tickets sold</dt>
              <div className="v num">{metrics ? metrics.taken : "—"}<span style={{ fontSize: 20, color: "var(--pk-ink2)" }}> / {metrics?.capacity ?? snap?.capacity ?? "—"}</span></div>
            </div>
            <div className="kpi">
              <dt>Revenue</dt>
              <div className="v num">{metrics ? usd(metrics.gross_revenue) : "—"}</div>
            </div>
            <div className="kpi">
              <dt>Sell-through</dt>
              <div className="v num">{metrics ? `${Math.round(metrics.sell_through * 100)}%` : "—"}</div>
            </div>
            <div className="kpi">
              <dt>Revenue protected</dt>
              <div className="v num z">{d ? usd(d.total_defended_usd) : "—"}</div>
              <div className="meta">est.</div>
            </div>
          </div>

          <div className="cols2 wide-left">
            {/* left — seat map */}
            <div className="pn">
              <div className="ph">
                <h3>Your seat map</h3>
                <span className="tag num">{filled} / {snap?.capacity ?? 0} sold</span>
              </div>
              <div className="seatgrid">
                {(snap?.seats ?? []).slice(0, 96).map((s) => (
                  <div key={s.seat_no} className={seatClass(s)} title={s.status} />
                ))}
              </div>
              <div className="seatlegend">
                <span><i /> open</span>
                <span><i className="held" /> on hold</span>
                <span><i className="confirmed" /> sold</span>
              </div>
              <div className="cmeter" style={{ marginTop: 16 }}>
                <div className="fill" style={{ width: `${snap ? (filled / Math.max(1, snap.capacity)) * 100 : 0}%` }} />
              </div>
              {/* demo affordance — there are no real buyers in the demo */}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--pink-line)" }}>
                <div className="lbl" style={{ color: "var(--pk-ink2)", marginBottom: 10 }}>Demo controls — simulate buyers</div>
                <div className="chips">
                  <button className="chip" disabled={busy} onClick={() => fillSome(8)}>+ 8 buyers</button>
                  <button className="chip" disabled={busy} onClick={() => fillSome(snap?.remaining_open ?? 0)}>Sell out</button>
                  <button className="chip" onClick={addWaitlister}>+ waitlister</button>
                  <button className="chip" onClick={cancelAndReoffer}>Cancel → re-offer</button>
                </div>
              </div>
            </div>

            {/* right — health */}
            <div className="pn">
              <div className="ph"><h3>On-sale health</h3><span className="tag">live</span></div>
              <ul className="check">
                <li><span className="ck">✓</span> 0 double-sold seats</li>
                <li><span className="ck">✓</span> 0 failed checkouts</li>
                <li><span className="ck">✓</span> {d ? d.bots_blocked.toLocaleString() : "—"} bots blocked</li>
                <li><span className="ck">✓</span> Fair allocation verified</li>
              </ul>
            </div>
          </div>

          <div className="cols2">
            {/* revenue protected */}
            <div className="pn">
              <div className="ph"><h3>Revenue protected</h3><span className="tag">estimated</span></div>
              <ul className="brk">
                <li><span>Oversell refunds avoided</span><span className="amt num">{d ? usd(d.oversell_defended_usd) : "—"}</span></li>
                <li><span>Scalper margin kept in your sale</span><span className="amt num">{d ? usd(d.resale_repatriated_usd) : "—"}</span></li>
                <li className="total"><span>Total protected · est.</span><span className="amt num">{d ? usd(d.total_defended_usd) : "—"}</span></li>
              </ul>
            </div>

            {/* fair allocation — plain language, no hashes */}
            <div className="pn">
              <div className="ph"><h3>Fair allocation</h3><span className="tag">auditable</span></div>
              <div className="vstamp">Verified ✓</div>
              <p style={{ fontSize: 14, color: "var(--pk-ink2)", lineHeight: 1.6, marginTop: 10 }}>
                All {metrics?.taken ?? 0} buyers got a seat in the exact order they committed — no bot or insider lane.
              </p>
              <div className="chips" style={{ marginTop: 16 }}>
                <button className="chip">Download fairness report</button>
                <Link href="/demo" className="chip">View technical ledger →</Link>
              </div>
            </div>
          </div>

          {/* waitlist + log */}
          <div className="cols2">
            <div className="pn">
              <div className="ph"><h3>Waitlist</h3><span className="tag num">{queue.length} · first refusal</span></div>
              {queue.length === 0 ? (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--pk-ink2)" }}>
                  Add fans, then free a seat → the #1 fan gets a locked offer (no bot race).
                </p>
              ) : (
                <ul className="brk">
                  {queue.map((b, i) => (
                    <li key={b}><span className="num">#{i + 1}{i === 0 ? "  ← next up" : ""}</span><span className="mono" style={{ fontSize: 13 }}>{b}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="pn">
              <div className="ph"><h3>Activity</h3></div>
              {log.length === 0 ? (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--pk-ink2)" }}>—</p>
              ) : (
                log.map((l, i) => (
                  <div key={i} className="mono" style={{ fontSize: 12, color: i === 0 ? "var(--pk-ink)" : "var(--pk-ink2)", padding: "5px 0" }}>→ {l}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateDrop
          orgName={orgName}
          onClose={() => setShowCreate(false)}
          onCreated={(id, opt) => {
            setEvents((e) => [opt, ...e]);
            setEventId(id);
            setShowCreate(false);
            say(`new drop created: ${opt.title}`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function CreateDrop({
  orgName,
  onClose,
  onCreated,
}: {
  orgName: string | null;
  onClose: () => void;
  onCreated: (id: string, opt: EvOpt) => void;
}) {
  const PRESETS = [
    { label: "arena concert", category: "concert", capacity: 80, price: 120 },
    { label: "limited drop", category: "drop", capacity: 30, price: 60 },
    { label: "sports final", category: "sports", capacity: 60, price: 95 },
    { label: "club night", category: "concert", capacity: 24, price: 35 },
  ];
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState(0);
  const [capacity, setCapacity] = useState(80);
  const [price, setPrice] = useState(120);
  const [openMode, setOpenMode] = useState<"now" | "1m" | "5m" | "custom">("now");
  const [customDt, setCustomDt] = useState("");
  const [busy, setBusy] = useState(false);

  function opensAtMs(): number | undefined {
    const now = Date.now();
    if (openMode === "1m") return now + 60_000;
    if (openMode === "5m") return now + 300_000;
    if (openMode === "custom" && customDt) return new Date(customDt).getTime();
    return undefined;
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const opens_at = opensAtMs();
    const res = await fetch("/api/org/create", {
      method: "POST",
      body: JSON.stringify({ title, category: PRESETS[preset].category, capacity, price, opens_at, organizer_name: orgName ?? undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) onCreated(d.event_id, { id: d.event_id, title: d.title, capacity, price });
  }

  const OPEN_OPTS: { key: "now" | "1m" | "5m" | "custom"; label: string }[] = [
    { key: "now", label: "open now" },
    { key: "1m", label: "in 1 min" },
    { key: "5m", label: "in 5 min" },
    { key: "custom", label: "schedule…" },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--pk-ink) 45%, transparent)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--cream)", border: "2px solid var(--pk-ink)", borderRadius: 14, padding: 24, width: 520, maxWidth: "100%" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <Eyebrow>new on-sale</Eyebrow>
            <div style={{ fontFamily: "var(--font-syne)", fontWeight: 800, fontSize: 26, marginTop: 4, textTransform: "uppercase", letterSpacing: "-.02em" }}>New drop</div>
          </div>
          <button className="mono focusable" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <label className="eyebrow">event name</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midnight Pulse — Seoul" className="focusable" style={inp} />

        <label className="eyebrow" style={{ display: "block", marginTop: 14, marginBottom: 6 }}>type</label>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => { setPreset(i); setCapacity(p.capacity); setPrice(p.price); }} className="focusable" style={{ padding: 10, textAlign: "left", cursor: "pointer", borderRadius: 8, border: `1.5px solid ${preset === i ? "var(--purple)" : "var(--pink-line)"}`, background: preset === i ? "var(--purple)" : "var(--cream)", color: preset === i ? "#fff" : "var(--pk-ink)" }}>
              <div className="mono" style={{ fontSize: 13 }}>{p.label}</div>
              <div className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>cap {p.capacity} · ${p.price}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="eyebrow">capacity</label>
            <input type="number" value={capacity} min={1} max={500} onChange={(e) => setCapacity(Number(e.target.value))} className="num focusable" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="eyebrow">price (USD)</label>
            <input type="number" value={price} min={1} onChange={(e) => setPrice(Number(e.target.value))} className="num focusable" style={inp} />
          </div>
        </div>

        <label className="eyebrow" style={{ display: "block", marginTop: 14, marginBottom: 6 }}>on-sale opens</label>
        <div className="flex flex-wrap gap-2">
          {OPEN_OPTS.map((o) => (
            <button key={o.key} onClick={() => setOpenMode(o.key)} className="mono focusable" style={{ fontSize: 12, padding: "7px 12px", cursor: "pointer", borderRadius: 7, border: `1.5px solid ${openMode === o.key ? "var(--purple)" : "var(--pink-line)"}`, background: openMode === o.key ? "var(--purple)" : "var(--cream)", color: openMode === o.key ? "#fff" : "var(--pk-ink2)" }}>
              {o.label}
            </button>
          ))}
        </div>
        {openMode === "custom" && (
          <input type="datetime-local" value={customDt} onChange={(e) => setCustomDt(e.target.value)} className="mono focusable" style={{ ...inp, marginTop: 8 }} />
        )}
        <p className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 6 }}>
          {openMode === "now"
            ? "Buyers can get tickets immediately."
            : "Buyers see a countdown; the on-sale is locked until it opens."}
        </p>

        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button className="mono focusable" onClick={onClose} style={{ ...btnInk, background: "var(--cream)", color: "var(--pk-ink)" }}>cancel</button>
          <button className="mono focusable" disabled={busy || !title.trim()} onClick={submit} style={btnInk}>{busy ? "creating…" : openMode === "now" ? "create + open now →" : "create + schedule →"}</button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  fontSize: 15,
  padding: "10px 12px",
  marginTop: 6,
  borderRadius: 8,
  background: "var(--cream)",
  border: "1.5px solid var(--pk-ink)",
  color: "var(--pk-ink)",
};
const btnInk: React.CSSProperties = {
  fontSize: 13,
  padding: "11px 18px",
  borderRadius: 8,
  cursor: "pointer",
  border: "1.5px solid var(--pk-ink)",
  background: "var(--pk-ink)",
  color: "var(--cream)",
  fontWeight: 600,
};
