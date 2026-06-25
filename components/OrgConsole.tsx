"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { MapPicker } from "@/components/MapPicker";
import type { SeatLayout } from "@/lib/seatlayout";

type SeatModel = SeatLayout["kind"]; // "ga" | "sections" | "grid"

// Quick-jump cities for the drop location picker (organizer can still drag the
// pin anywhere). Coords match the seed companies so created + seed drops share
// one coordinate space for PostGIS "near me" discovery.
const CITY_PRESETS: { label: string; city: string; country: string; lat: number; lng: number }[] = [
  { label: "Seoul", city: "Seoul", country: "KR", lat: 37.5563, lng: 126.976 },
  { label: "New York", city: "New York", country: "US", lat: 40.7128, lng: -74.006 },
  { label: "Los Angeles", city: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437 },
  { label: "London", city: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { label: "Tokyo", city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
];

interface EvOpt {
  id: string;
  title: string;
  capacity: number;
  price: number;
  organizer?: string;
}
interface Seat {
  seat_no: number;
  section: string;
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

// org floor renders the real venue shape (stage + sections), not a flat grid —
// reuses the buyer seat-map's .pseat language. A reserved-for-#1 seat reads as
// "held" so the fair re-offer is visible on the floor.
function seatStatus(s: Seat): string {
  return s.reserved && s.status === "open" ? "held" : s.status;
}

export function OrgConsole({ events: initial }: { events: EvOpt[] }) {
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [eventId, setEventId] = useState(
    initial.find((e) => e.capacity > 1)?.id ?? initial[0]?.id ?? "",
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

  // an organizer only manages THEIR OWN drops (per-organizer filtering).
  // No org session (didn't onboard) → show all (demo convenience).
  const visible = orgName ? events.filter((e) => e.organizer === orgName) : events;
  useEffect(() => {
    const v = orgName ? events.filter((e) => e.organizer === orgName) : events;
    if (v.length && !v.some((e) => e.id === eventId)) setEventId(v[0].id);
  }, [orgName, events, eventId]);

  const load = useCallback(async () => {
    if (!eventId) {
      setSnap(null);
      setMetrics(null);
      return;
    }
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
            <h1>{ev?.title ?? (visible.length ? "Your on-sale" : "No drops yet")}</h1>
            <div className="sub" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span className="live">
                <span className="dot" /> {soldOut ? "Sold out" : visible.length ? "On-sale: Live" : "Create your first drop"}
              </span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="focusable"
                disabled={visible.length === 0}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 12.5, padding: "8px 12px",
                  borderRadius: 8, border: "1.5px solid rgba(255,255,255,.5)",
                  background: "transparent", color: "var(--cream)",
                }}
              >
                {visible.length === 0 ? (
                  <option style={{ color: "#161019" }}>— no drops yet —</option>
                ) : (
                  visible.map((e) => (
                    <option key={e.id} value={e.id} style={{ color: "#161019" }}>
                      {e.title} · {usd(e.price)} · {e.capacity} seats
                    </option>
                  ))
                )}
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
              {snap && snap.capacity === 1 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0 4px" }}>
                  <div className="pseat" data-status={seatStatus((snap.seats[0] ?? { seat_no: 1, section: "GA", status: "open", reserved: false }) as Seat)} style={{ width: 56, height: 56, fontSize: 13 }} />
                  <div className="mono" style={{ fontSize: 12.5, color: "var(--pk-ink2)", lineHeight: 1.55 }}>
                    {soldOut ? "The one seat is claimed — final, everywhere, instantly." : "One seat · whoever confirms first gets it. No double-book."}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between" style={{ margin: "2px 0 8px" }}>
                    <span className="lbl" style={{ color: "var(--pk-ink2)" }}>Stage</span>
                    <span className="lbl" style={{ color: "var(--pk-ink2)" }}>{snap?.remaining_open ?? 0} open</span>
                  </div>
                  <div style={{ height: 4, background: "var(--purple)", marginBottom: 6, borderRadius: 2 }} />
                  {Array.from(new Set((snap?.seats ?? []).map((s) => s.section))).map((sec) => (
                    <div key={sec}>
                      <div className="section-h">{sec}</div>
                      <div className="seatrow">
                        {(snap?.seats ?? [])
                          .filter((s) => s.section === sec)
                          .slice(0, 60)
                          .map((s) => (
                            <div key={s.seat_no} className="pseat" data-status={seatStatus(s)} title={`${sec} ${s.seat_no} · ${s.status}`} />
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="seatstat" style={{ marginTop: 16 }}>
                <span className="s"><i /> open</span>
                <span className="s"><i className="held" /> on hold</span>
                <span className="s"><i className="sold" /> sold</span>
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
    { label: "arena concert", category: "concert", price: 120, model: "sections" as SeatModel, sections: [{ name: "FLOOR", count: 80 }, { name: "LOWER", count: 140 }, { name: "UPPER", count: 180 }] },
    { label: "limited drop", category: "drop", price: 60, model: "ga" as SeatModel, gaCap: 1 },
    { label: "sports final", category: "sports", price: 95, model: "sections" as SeatModel, sections: [{ name: "NORTH", count: 120 }, { name: "SOUTH", count: 120 }, { name: "VIP", count: 60 }] },
    { label: "club night", category: "concert", price: 35, model: "ga" as SeatModel, gaCap: 120 },
  ];
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState(0);
  const [price, setPrice] = useState(120);
  // seat model — GA (count only) / sections (named tiers) / grid (rows × seats)
  const [model, setModel] = useState<SeatModel>("sections");
  const [gaCap, setGaCap] = useState(120);
  const [sections, setSections] = useState<{ name: string; count: number }[]>([
    { name: "FLOOR", count: 80 }, { name: "LOWER", count: 140 }, { name: "UPPER", count: 180 },
  ]);
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(20);

  function applyPreset(i: number) {
    const p = PRESETS[i];
    setPreset(i);
    setPrice(p.price);
    setModel(p.model);
    if (p.model === "ga" && p.gaCap != null) setGaCap(p.gaCap);
    if (p.model === "sections" && p.sections) setSections(p.sections);
  }
  const [openMode, setOpenMode] = useState<"now" | "1m" | "5m" | "custom">("now");
  const [customDt, setCustomDt] = useState("");
  const [busy, setBusy] = useState(false);
  // drop location — venue text + city + a map pin (default Seoul)
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState(CITY_PRESETS[0].city);
  const [country, setCountry] = useState(CITY_PRESETS[0].country);
  const [lat, setLat] = useState(CITY_PRESETS[0].lat);
  const [lng, setLng] = useState(CITY_PRESETS[0].lng);

  function jumpCity(p: (typeof CITY_PRESETS)[number]) {
    setCity(p.city);
    setCountry(p.country);
    setLat(p.lat);
    setLng(p.lng);
  }

  function opensAtMs(): number | undefined {
    const now = Date.now();
    if (openMode === "1m") return now + 60_000;
    if (openMode === "5m") return now + 300_000;
    if (openMode === "custom" && customDt) return new Date(customDt).getTime();
    return undefined;
  }

  // capacity + layout are derived from the chosen seat model
  const cleanSections = sections.map((s) => ({ name: s.name.trim() || "SEC", count: Math.max(1, Number(s.count) || 1) }));
  const layout: SeatLayout =
    model === "ga" ? { kind: "ga", capacity: gaCap } :
    model === "grid" ? { kind: "grid", rows, cols } :
    { kind: "sections", sections: cleanSections };
  const capacity = model === "ga" ? gaCap : model === "grid" ? rows * cols : cleanSections.reduce((a, s) => a + s.count, 0);
  const overCap = capacity > 500;

  async function submit() {
    if (!title.trim() || overCap) return;
    setBusy(true);
    const opens_at = opensAtMs();
    const res = await fetch("/api/org/create", {
      method: "POST",
      body: JSON.stringify({ title, category: PRESETS[preset].category, price, opens_at, organizer_name: orgName ?? undefined, venue, city, country, lat, lng, layout }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) onCreated(d.event_id, { id: d.event_id, title: d.title, capacity, price, organizer: orgName ?? undefined });
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
      style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--pk-ink) 45%, transparent)", display: "grid", placeItems: "center", zIndex: 50, padding: 20, overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--cream)", border: "2px solid var(--pk-ink)", borderRadius: 14, padding: 24, width: 520, maxWidth: "100%", maxHeight: "calc(100dvh - 40px)", overflowY: "auto" }}>
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
            <button key={p.label} onClick={() => applyPreset(i)} className="focusable" style={{ padding: 10, textAlign: "left", cursor: "pointer", borderRadius: 8, border: `1.5px solid ${preset === i ? "var(--purple)" : "var(--pink-line)"}`, background: preset === i ? "var(--purple)" : "var(--cream)", color: preset === i ? "#fff" : "var(--pk-ink)" }}>
              <div className="mono" style={{ fontSize: 13 }}>{p.label}</div>
              <div className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>{p.model === "ga" ? `GA · ${p.gaCap}` : "reserved"} · ${p.price}</div>
            </button>
          ))}
        </div>

        {/* seat model — GA / sections / grid. Layout is cosmetic; every seat is
            still one ledger row, so zero-oversell holds for any model. */}
        <label className="eyebrow" style={{ display: "block", marginTop: 14, marginBottom: 6 }}>seat model</label>
        <div className="flex flex-wrap gap-2">
          {([["ga", "General admission"], ["sections", "Sections"], ["grid", "Rows × seats"]] as [SeatModel, string][]).map(([k, lbl]) => (
            <button key={k} onClick={() => setModel(k)} className="mono focusable" style={{ fontSize: 12, padding: "7px 12px", cursor: "pointer", borderRadius: 7, border: `1.5px solid ${model === k ? "var(--purple)" : "var(--pink-line)"}`, background: model === k ? "var(--purple)" : "var(--cream)", color: model === k ? "#fff" : "var(--pk-ink2)" }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          {model === "ga" && (
            <div>
              <label className="eyebrow">capacity (general admission)</label>
              <input type="number" value={gaCap} min={1} max={500} onChange={(e) => setGaCap(Math.max(1, Number(e.target.value) || 1))} className="num focusable" style={inp} />
            </div>
          )}
          {model === "grid" && (
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label className="eyebrow">rows</label>
                <input type="number" value={rows} min={1} max={50} onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))} className="num focusable" style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="eyebrow">seats / row</label>
                <input type="number" value={cols} min={1} max={40} onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))} className="num focusable" style={inp} />
              </div>
            </div>
          )}
          {model === "sections" && (
            <div className="grid gap-2">
              {sections.map((sec, i) => (
                <div key={i} className="flex gap-2" style={{ alignItems: "center" }}>
                  <input value={sec.name} placeholder="section" onChange={(e) => setSections((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="focusable" style={{ ...inp, marginTop: 0, flex: 1.4 }} />
                  <input type="number" value={sec.count} min={1} onChange={(e) => setSections((arr) => arr.map((x, j) => j === i ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x))} className="num focusable" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <button onClick={() => setSections((arr) => arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)} className="mono focusable" title="remove" style={{ border: "1.5px solid var(--pink-line)", background: "var(--cream)", borderRadius: 7, cursor: "pointer", padding: "8px 11px", color: "var(--pk-ink2)" }}>✕</button>
                </div>
              ))}
              {sections.length < 8 && (
                <button onClick={() => setSections((arr) => [...arr, { name: "", count: 50 }])} className="mono focusable" style={{ border: "1.5px dashed var(--pink-line)", background: "transparent", borderRadius: 7, cursor: "pointer", padding: "8px 11px", color: "var(--pk-ink2)", fontSize: 12 }}>+ add section</button>
              )}
            </div>
          )}
          <p className="mono" style={{ fontSize: 10.5, color: overCap ? "var(--vermilion,#df3b16)" : "var(--pk-ink2)", marginTop: 6 }}>
            = <span className="num">{capacity}</span> seats total{overCap ? " · over the 500-seat demo limit" : model === "ga" ? " · no seat map, just a live count" : ""}
          </p>
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="eyebrow">price (USD)</label>
          <input type="number" value={price} min={1} onChange={(e) => setPrice(Number(e.target.value))} className="num focusable" style={inp} />
        </div>

        <label className="eyebrow" style={{ display: "block", marginTop: 14, marginBottom: 6 }}>location</label>
        <div className="flex flex-wrap gap-3">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="venue (e.g. KSPO Dome)" className="focusable" style={{ ...inp, marginTop: 0, flex: 1.4, minWidth: 160 }} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="city" className="focusable" style={{ ...inp, marginTop: 0, flex: 1, minWidth: 120 }} />
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
          {CITY_PRESETS.map((p) => (
            <button key={p.label} onClick={() => jumpCity(p)} className="mono focusable" style={{ fontSize: 11.5, padding: "5px 10px", cursor: "pointer", borderRadius: 7, border: `1.5px solid ${city === p.city ? "var(--purple)" : "var(--pink-line)"}`, background: city === p.city ? "var(--purple)" : "var(--cream)", color: city === p.city ? "#fff" : "var(--pk-ink2)" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <MapPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} height={180} />
        </div>
        <p className="mono" style={{ fontSize: 10.5, color: "var(--pk-ink2)", marginTop: 6 }}>
          Drag or click the pin — this is where fans find your drop “near me”. <span className="num">{lat.toFixed(3)}, {lng.toFixed(3)}</span>
        </p>

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
